'use client';

import { Buffer } from 'buffer';
import { PublicKey, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets, useSignTransaction } from '@privy-io/react-auth/solana';
import { withWaitLogger } from './waitLogger';
import { dispatchBalanceStale } from './eventTypes';
import { useTriggerV2Auth } from './useTriggerV2Auth';
import * as SolanaTokens from '../../config/token_info/solana_tokens';
import type { ChatLimitOrderIntent } from './limitOrderTypes';

// ─── Token resolution (shared with V1) ──────────────────────────────────────

type TokenConfig = { symbol?: string; address?: string; decimals?: number };

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

// V2 requires every order to have a future `expiresAt` in milliseconds.
// If the user didn't specify, default to 7 days out (matches the jup.ag
// frontend default; balances fill probability vs cleanup of dead orders).
const DEFAULT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

const resolveExpiresAtMs = (intent: ChatLimitOrderIntent): number => {
  if (intent.expiry) {
    const ts = Date.parse(intent.expiry);
    if (Number.isFinite(ts) && ts > Date.now()) return ts;
  }
  return Date.now() + DEFAULT_EXPIRY_MS;
};

// Map "SELL X if price hits $P" → V2 trigger direction.
// SELL of token X with a target USD price → execute when X's price goes ABOVE
// targetPriceUsd (you want to sell high).
// BUY  of token X with a target USD price → execute when X's price goes BELOW
// targetPriceUsd (you want to buy low).
// The user can override via the intent if/when the prompt supports it.
const deriveTriggerCondition = (side: 'SELL' | 'BUY'): 'above' | 'below' =>
  side === 'SELL' ? 'above' : 'below';

// ─── Result shape (matches V1 for drop-in replacement) ──────────────────────

export type LimitOrderV2ExecuteResult = {
  /** On-chain deposit-tx signature returned by Jupiter when the order is created. */
  txHash: string;
  /** Real Jupiter orderId (V2 returns this up-front, unlike V1). */
  providerOrderId: string | null;
  /** Vault address that holds the deposited funds. */
  vaultPubkey: string | null;
  /** What we wrote back to /api/limit-orders. */
  LOID: string | null;
  amountInRaw: string;
  amountOutRaw: string;
  kind: 'price' | 'time';
};

/**
 * V2 replacement for `useJupiterTrigger.executeLimitOrder` price-order path.
 *
 * Flow (per price-order intent):
 *   1. Ensure a V2 JWT (cached 24h; first call prompts a one-shot signMessage).
 *   2. GET /api/jupiter/trigger-v2/vault — auto-registers the vault on first use.
 *      Jupiter requires the vault to exist before deposit/craft can be called.
 *   3. POST /api/jupiter/trigger-v2/deposit/craft → unsigned VersionedTransaction.
 *   4. Privy signs the deposit tx (regular tx-signing prompt).
 *   5. POST /api/jupiter/trigger-v2/orders/price with the signed deposit +
 *      order params (triggerCondition + triggerPriceUsd + expiresAtMs).
 *   6. Writeback to /api/limit-orders with `providerVersion: 'v2'` + the new
 *      V2 fields so the backend (and future V2 sync-fills) can route correctly.
 *
 * Time-triggered orders (`kind: 'time'`) still go through the V1-shaped
 * writeback-only path (the time scheduler doesn't depend on V1/V2). Callers
 * should keep using `useJupiterTrigger` for those, or this hook also forwards
 * time orders to a minimal writeback path for ergonomics.
 */
export function useJupiterTriggerV2() {
  const { authenticated, getAccessToken } = usePrivy();
  const { wallets, ready } = useWallets();
  const { signTransaction } = useSignTransaction();
  const { ensureJwt } = useTriggerV2Auth();

  const isReady = Boolean(authenticated && ready && wallets?.length);

  const resolveToken = (symbol: string): TokenConfig | null => {
    const upper = symbol.trim().toUpperCase();
    return SOLANA_TOKEN_MAP[upper] ?? null;
  };

  const executeLimitOrder = async (
    intent: ChatLimitOrderIntent,
    opts: { CID?: string | null } = {}
  ): Promise<LimitOrderV2ExecuteResult> => {
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

    // ── Time-triggered: writeback only (scheduler runs the actual swap later) ──
    if (kind === 'time') {
      if (!intent.runAt) throw new Error('Time-triggered orders require runAt.');
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
          // Time orders are V2-agnostic; keep providerVersion default ('v1') so
          // the scheduler doesn't try to call V2 endpoints.
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
            amountRaw: '0',
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
      return { txHash: '', providerOrderId: null, vaultPubkey: null, LOID, amountInRaw, amountOutRaw: '0', kind };
    }

    // ── Price-triggered: full V2 flow. ──
    if (!intent.targetPrice) {
      throw new Error('Price-triggered orders require targetPrice.');
    }
    const triggerPriceUsd = Number(intent.targetPrice);
    if (!Number.isFinite(triggerPriceUsd) || triggerPriceUsd <= 0) {
      throw new Error(`Invalid targetPrice: ${intent.targetPrice}`);
    }
    const expiresAtMs = resolveExpiresAtMs(intent);
    const triggerCondition = deriveTriggerCondition(intent.side);

    // For V2 we don't pre-compute takingAmount — Jupiter does that at fill time
    // based on triggerPriceUsd + slippage. Surface 0 to writeback for now; the
    // V2 sync-fills follow-up will patch with the actual realised amount.
    const amountOutRaw = '0';

    // Step 1: JWT.
    const jwt = await ensureJwt();

    // Step 2: Ensure the vault exists (auto-registers on first use).
    // Jupiter's deposit/craft endpoint requires a vault to already be registered
    // for the wallet — if we skip this, craft returns 403 "No vault registered".
    const vaultRes = await withWaitLogger(
      {
        file: 'altair_frontend1/src/lib/useJupiterTriggerV2.ts',
        target: '/api/jupiter/trigger-v2/vault',
        description: 'V2 get/register vault',
      },
      () =>
        fetch('/api/jupiter/trigger-v2/vault', {
          method: 'GET',
          headers: { Authorization: `Bearer ${jwt}` },
        })
    );
    if (!vaultRes.ok) {
      const errBody = (await vaultRes.json().catch(() => ({}))) as { error?: string };
      throw new Error(errBody?.error ?? 'Jupiter Trigger V2 vault registration failed.');
    }

    // Step 3: deposit/craft. This builds the unsigned VersionedTransaction
    // that moves `amountInRaw` of sellToken from the user's wallet into the
    // Privy-managed vault.
    const craftRes = await withWaitLogger(
      {
        file: 'altair_frontend1/src/lib/useJupiterTriggerV2.ts',
        target: '/api/jupiter/trigger-v2/deposit/craft',
        description: 'V2 craft deposit',
      },
      () =>
        fetch('/api/jupiter/trigger-v2/deposit/craft', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({
            inputMint: sellCfg.address,
            outputMint: buyCfg.address,
            userAddress: signer,
            amount: amountInRaw,
            orderType: 'price',
            orderSubType: 'single',
          }),
        })
    );
    if (!craftRes.ok) {
      const errBody = (await craftRes.json().catch(() => ({}))) as { error?: string };
      throw new Error(errBody?.error ?? 'Jupiter Trigger V2 deposit/craft failed.');
    }
    const craft = (await craftRes.json()) as {
      transaction?: string;
      requestId?: string;
      receiverAddress?: string;
    };
    if (!craft.transaction || !craft.requestId) {
      throw new Error('Trigger V2 deposit/craft returned an incomplete response.');
    }

    // Step 4: have Privy sign the unsigned deposit transaction. Privy's
    // `signTransaction` takes a serialized Uint8Array and returns one. We just
    // need to round-trip the bytes — we don't need to inspect the VersionedTx
    // structure ourselves.
    const unsignedTxBytes = Buffer.from(craft.transaction, 'base64');
    void VersionedTransaction; // kept import for future inspection / debugging
    const { signedTransaction } = await withWaitLogger(
      {
        file: 'altair_frontend1/src/lib/useJupiterTriggerV2.ts',
        target: 'Privy signTransaction (V2 deposit)',
        description: 'Sign deposit transaction',
      },
      () =>
        signTransaction({
          transaction: new Uint8Array(unsignedTxBytes),
          wallet,
          chain: 'solana:mainnet',
        })
    );
    const depositSignedTx = Buffer.from(signedTransaction).toString('base64');

    // Step 5: orders/price with the signed deposit. This is what actually
    // submits the deposit on-chain AND registers the limit order with Jupiter.
    const orderRes = await withWaitLogger(
      {
        file: 'altair_frontend1/src/lib/useJupiterTriggerV2.ts',
        target: '/api/jupiter/trigger-v2/orders/price',
        description: 'V2 create price order',
      },
      () =>
        fetch('/api/jupiter/trigger-v2/orders/price', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({
            orderType: 'single',
            depositRequestId: craft.requestId,
            depositSignedTx,
            userPubkey: signer,
            inputMint: sellCfg.address,
            inputAmount: amountInRaw,
            outputMint: buyCfg.address,
            triggerMint: sellCfg.address,
            triggerCondition,
            triggerPriceUsd,
            slippageBps: 100,
            expiresAt: expiresAtMs,
          }),
        })
    );
    if (!orderRes.ok) {
      const errBody = (await orderRes.json().catch(() => ({}))) as { error?: string };
      throw new Error(errBody?.error ?? 'Jupiter Trigger V2 orders/price failed.');
    }
    const order = (await orderRes.json()) as { id?: string; txSignature?: string };
    if (!order.id) throw new Error('Trigger V2 orders/price returned no order id.');

    const providerOrderId = order.id;
    const txHash = order.txSignature ?? '';
    const vaultPubkey = craft.receiverAddress ?? null;

    // Funds moved into the vault on-chain; mark balances stale so the wallet
    // panel re-fetches.
    dispatchBalanceStale({
      chainKey: 'SOLANA_MAINNET',
      symbol: intent.sell.toUpperCase(),
      reason: 'swap',
      timestamp: Date.now(),
    });

    // Step 6: writeback to /api/limit-orders with V2 fields.
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
          providerVersion: 'v2',
          depositRequestId: craft.requestId,
          vaultPubkey,
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
            // V2 native fields:
            triggerCondition,
            triggerPriceUsd,
            expiresAtMs,
            // V1-compatible fields (keeps the orders panel rendering unchanged):
            targetPrice: String(triggerPriceUsd),
            quoteCurrency: 'USD',
            expiresAt: new Date(expiresAtMs).toISOString(),
          },
          providerOrderId,
          intentString: 'LIMIT_ORDER_PRICE_INTENT',
          CID: opts.CID ?? null,
        }),
      });
      const writebackBody = await writebackRes.json().catch(() => ({}));
      if (!writebackRes.ok) {
        console.warn('[Trigger V2] writeback non-OK:', writebackBody);
      } else {
        LOID = (writebackBody as { order?: { LOID?: string } })?.order?.LOID ?? null;
      }
    } catch (err) {
      console.warn('[Trigger V2] writeback request failed (non-fatal):', err);
    }

    return {
      txHash,
      providerOrderId,
      vaultPubkey,
      LOID,
      amountInRaw,
      amountOutRaw,
      kind,
    };
  };

  // Silence unused-import warning for bs58 if the bundler aggressively shakes.
  void bs58;

  return { executeLimitOrder, isReady };
}
