'use client';

import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets, useSignAndSendTransaction } from '@privy-io/react-auth/solana';
import { withWaitLogger } from './waitLogger';
import { dispatchBalanceStale } from './eventTypes';
import * as SolanaTokens from '../../config/token_info/solana_tokens';
import type { ChatLimitOrderIntent } from './limitOrderTypes';

type TokenConfig = {
  symbol?: string;
  address?: string;
  decimals?: number;
};

const buildSolanaTokenMap = (): Record<string, TokenConfig> => {
  const map: Record<string, TokenConfig> = {};
  for (const value of Object.values(SolanaTokens as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const token = value as TokenConfig;
    if (typeof token.symbol === 'string' && token.address) {
      map[token.symbol.toUpperCase()] = token;
    }
  }
  return map;
};
const SOLANA_TOKEN_MAP = buildSolanaTokenMap();

const toRawAmount = (humanAmount: string, decimals: number): string => {
  const cleaned = String(humanAmount).trim().replace(/[^0-9.]/g, '');
  if (!cleaned) return '0';
  const [whole, frac = ''] = cleaned.split('.');
  const fracPadded = (frac + '0'.repeat(decimals)).slice(0, decimals);
  const wholeBig = BigInt(whole || '0');
  const fracBig = BigInt(fracPadded || '0');
  const multiplier = 10n ** BigInt(decimals);
  return (wholeBig * multiplier + fracBig).toString();
};

const toUnixSecondsString = (iso: string): string => {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) throw new Error(`Invalid expiry timestamp: ${iso}`);
  return Math.floor(ts / 1000).toString();
};

export type LimitOrderExecuteResult = {
  /** Order create-tx signature (Trigger V1 uses this as our local provider order id). */
  txHash: string;
  /** Order id from Jupiter (when present in response). */
  providerOrderId: string | null;
  /** What we wrote back to /api/limit-orders. */
  LOID: string | null;
  amountInRaw: string;
  amountOutRaw: string;
  kind: 'price' | 'time';
};

/**
 * Hook for placing Jupiter-routed limit / scheduled orders from a chat intent.
 *
 * - `LIMIT_ORDER_PRICE_INTENT` -> Jupiter Trigger API V1 createOrder. The implied
 *   price is encoded as `takingAmount` (what the user wants to receive). We compute
 *   it from `amount` + `targetPrice` + `quoteCurrency`.
 *
 * - `LIMIT_ORDER_TIME_INTENT` -> we only persist to `/api/limit-orders`. The
 *   server-side scheduler is a follow-up; until then, the chat memory will know
 *   the order exists and the user can ask "what's queued?". We do NOT touch the
 *   Trigger API for time orders.
 */
export function useJupiterTrigger() {
  const { authenticated, getAccessToken } = usePrivy();
  const { wallets, ready } = useWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();

  const isReady = Boolean(authenticated && ready && wallets?.length);

  const resolveToken = (symbol: string): TokenConfig | null => {
    const upper = symbol.trim().toUpperCase();
    return SOLANA_TOKEN_MAP[upper] ?? null;
  };

  const executeLimitOrder = async (
    intent: ChatLimitOrderIntent,
    opts: { CID?: string | null } = {}
  ): Promise<LimitOrderExecuteResult> => {
    if (!isReady || !wallets?.length) {
      throw new Error('No authenticated Solana wallet available. Connect a Solana wallet first.');
    }
    const wallet = wallets[0];
    const signer = wallet.address;
    try {
      new PublicKey(signer);
    } catch {
      throw new Error('Invalid Solana wallet address. Make sure your Solana wallet is connected.');
    }

    // Resolve tokens (always Solana for limit orders today).
    const sellCfg = resolveToken(intent.sell);
    const buyCfg = resolveToken(intent.buy);
    if (!sellCfg?.address || typeof sellCfg.decimals !== 'number') {
      throw new Error(`Sell token ${intent.sell} not configured for Solana.`);
    }
    if (!buyCfg?.address || typeof buyCfg.decimals !== 'number') {
      throw new Error(`Buy token ${intent.buy} not configured for Solana.`);
    }

    const amountInRaw = toRawAmount(intent.amount, sellCfg.decimals);
    if (amountInRaw === '0') throw new Error('Amount must be greater than 0.');

    const accessToken = await getAccessToken();
    const kind: 'price' | 'time' =
      intent.type === 'LIMIT_ORDER_TIME_INTENT' ? 'time' : 'price';

    // --- Time-triggered: persist only; scheduler runs the actual swap later. ---
    if (kind === 'time') {
      if (!intent.runAt) throw new Error('Time-triggered orders require runAt.');
      // For amountOutRaw on a scheduled market order we don't know yet; record 0
      // and let the scheduler/writeback patch it after fill.
      const amountOutRaw = '0';
      const writebackRes = await fetch('/api/limit-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          kind,
          side: intent.side,
          chain: 'SOLANA_MAINNET',
          walletAddress: signer,
          provider: 'Jupiter',
          sellToken: {
            symbol: intent.sell,
            contractAddress: sellCfg.address,
            decimals: sellCfg.decimals,
            amountRaw: amountInRaw,
          },
          buyToken: {
            symbol: intent.buy,
            contractAddress: buyCfg.address,
            decimals: buyCfg.decimals,
            amountRaw: amountOutRaw,
          },
          trigger: { runAt: intent.runAt },
          intentString: 'LIMIT_ORDER_TIME_INTENT',
          CID: opts.CID ?? null,
        }),
      });
      const writebackBody = await writebackRes.json().catch(() => ({}));
      if (!writebackRes.ok) {
        throw new Error(
          (writebackBody as { error?: string })?.error ?? 'Failed to schedule time-triggered order.'
        );
      }
      const LOID = (writebackBody as { order?: { LOID?: string } })?.order?.LOID ?? null;
      return {
        txHash: '',
        providerOrderId: null,
        LOID,
        amountInRaw,
        amountOutRaw,
        kind,
      };
    }

    // --- Price-triggered: build createOrder body. ---
    if (!intent.targetPrice) {
      throw new Error('Price-triggered orders require targetPrice.');
    }
    const price = Number(intent.targetPrice);
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(`Invalid targetPrice: ${intent.targetPrice}`);
    }
    // For SELL side: user gives `amount` of sell token and wants amount * price of quote (buy) token.
    // For BUY side:  user wants `amount` of buy token and is willing to pay amount * price of sell token.
    let amountOutRaw: string;
    if (intent.side === 'SELL') {
      const out = Number(intent.amount) * price;
      amountOutRaw = toRawAmount(out.toString(), buyCfg.decimals);
    } else {
      // For BUY, we already encoded sell amount; "amount" semantics swap.
      // We trust the model resolved this. If not, fall back to amount * price.
      const out = Number(intent.amount) * price;
      amountOutRaw = toRawAmount(out.toString(), buyCfg.decimals);
    }
    if (amountOutRaw === '0') throw new Error('Computed output amount is 0. Check targetPrice.');

    const createOrderBody: Record<string, unknown> = {
      inputMint: sellCfg.address,
      outputMint: buyCfg.address,
      maker: signer,
      payer: signer,
      params: {
        makingAmount: amountInRaw,
        takingAmount: amountOutRaw,
      },
      computeUnitPrice: 'auto',
    };
    if (intent.expiry) {
      try {
        createOrderBody.expiredAt = toUnixSecondsString(intent.expiry);
      } catch {
        // Non-fatal; just skip expiry.
      }
    }

    const proxyRes = await withWaitLogger(
      {
        file: 'altair_frontend1/src/lib/useJupiterTrigger.ts',
        target: '/api/jupiter/trigger/create-order',
        description: 'Jupiter Trigger create-order build tx',
      },
      () =>
        fetch('/api/jupiter/trigger/create-order', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          credentials: 'include',
          body: JSON.stringify(createOrderBody),
        })
    );
    if (!proxyRes.ok) {
      const errBody = (await proxyRes.json().catch(() => ({}))) as { error?: string };
      throw new Error(errBody?.error ?? 'Jupiter Trigger createOrder failed.');
    }
    const proxyPayload = (await proxyRes.json()) as {
      transaction?: string;
      serializedTransaction?: string;
      orderId?: string;
    };
    const txBase64 = proxyPayload.transaction ?? proxyPayload.serializedTransaction;
    if (!txBase64) throw new Error('No transaction returned by Jupiter Trigger.');

    const versionedTx = VersionedTransaction.deserialize(Buffer.from(txBase64, 'base64'));
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');

    try {
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      versionedTx.message.recentBlockhash = blockhash;
      versionedTx.signatures = versionedTx.signatures.map(() => new Uint8Array(64));
    } catch (err) {
      console.warn('[Trigger] getLatestBlockhash failed; using returned tx as-is', err);
    }

    let serialized = versionedTx.serialize();
    let txHash = '';
    try {
      const { signature } = await withWaitLogger(
        {
          file: 'altair_frontend1/src/lib/useJupiterTrigger.ts',
          target: 'Privy signAndSendTransaction',
          description: 'Jupiter Trigger create-order sign+send',
        },
        () =>
          signAndSendTransaction({
            transaction: serialized,
            wallet,
            chain: 'solana:mainnet',
          })
      );
      txHash = typeof signature === 'string' ? signature : bs58.encode(signature);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('signature')) {
        try {
          const { blockhash } = await connection.getLatestBlockhash('confirmed');
          versionedTx.message.recentBlockhash = blockhash;
          versionedTx.signatures = versionedTx.signatures.map(() => new Uint8Array(64));
        } catch {
          /* ignore */
        }
        serialized = versionedTx.serialize();
        const retry = await signAndSendTransaction({
          transaction: serialized,
          wallet,
          chain: 'solana:mainnet',
        });
        txHash = typeof retry.signature === 'string' ? retry.signature : bs58.encode(retry.signature);
      } else {
        throw err;
      }
    }

    // Funding for the order leaves the user's wallet immediately; mark balances stale.
    dispatchBalanceStale({
      chainKey: 'SOLANA_MAINNET',
      symbol: intent.sell.toUpperCase(),
      reason: 'swap',
      timestamp: Date.now(),
    });

    // Writeback. Trigger V1 typically doesn't return an orderId in the create response,
    // so we use the create-order tx signature as our local providerOrderId until V2.
    let LOID: string | null = null;
    try {
      const writebackRes = await fetch('/api/limit-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          kind,
          side: intent.side,
          chain: 'SOLANA_MAINNET',
          walletAddress: signer,
          provider: 'Jupiter',
          sellToken: {
            symbol: intent.sell,
            contractAddress: sellCfg.address,
            decimals: sellCfg.decimals,
            amountRaw: amountInRaw,
          },
          buyToken: {
            symbol: intent.buy,
            contractAddress: buyCfg.address,
            decimals: buyCfg.decimals,
            amountRaw: amountOutRaw,
          },
          trigger: {
            targetPrice: String(price),
            quoteCurrency: (intent.quoteCurrency ?? 'USDC').toUpperCase(),
            expiresAt: intent.expiry ?? null,
          },
          providerOrderId: proxyPayload.orderId ?? txHash,
          intentString: 'LIMIT_ORDER_PRICE_INTENT',
          CID: opts.CID ?? null,
        }),
      });
      const writebackBody = await writebackRes.json().catch(() => ({}));
      if (!writebackRes.ok) {
        console.warn('[Trigger] writeback non-OK:', writebackBody);
      } else {
        LOID = (writebackBody as { order?: { LOID?: string } })?.order?.LOID ?? null;
      }
    } catch (err) {
      console.warn('[Trigger] writeback request failed (non-fatal):', err);
    }

    return {
      txHash,
      providerOrderId: proxyPayload.orderId ?? null,
      LOID,
      amountInRaw,
      amountOutRaw,
      kind,
    };
  };

  return { executeLimitOrder, isReady };
}
