'use client';

import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets, useSignAndSendTransaction } from '@privy-io/react-auth/solana';
import { withWaitLogger } from './waitLogger';
import {
  dispatchBalanceStale,
  dispatchSwapComplete,
  dispatchSwapSubmitted,
} from './eventTypes';
import { GAS_TOKENS } from '../../config/blockchain_config';
import * as SolanaTokens from '../../config/token_info/solana_tokens';

type LendAction = 'deposit' | 'withdraw';

type LendTokenConfig = {
  symbol?: string;
  address?: string;
  decimals?: number;
};

type LendMarket = {
  asset?: string;
  vault?: string;
  symbol?: string;
  decimals?: number;
  apy?: number | null;
};

export type LendExecuteParams = {
  /** 'deposit' | 'withdraw'. */
  action: LendAction;
  /** Token symbol (e.g. 'USDC'). */
  tokenSymbol: string;
  /** Human amount as string (e.g. '10.5'). For withdraw, may be the string 'all'. */
  amount: string;
  /** Optional chat id for memory linking. */
  CID?: string | null;
};

export type LendExecuteResult = {
  txHash: string;
  amountRaw: string;
  tokenSymbol: string;
  tokenMint: string;
  apySnapshot: number | null;
  vault: string | null;
};

const buildSolanaTokenMap = (): Record<string, LendTokenConfig> => {
  const map: Record<string, LendTokenConfig> = {};
  for (const value of Object.values(SolanaTokens as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const token = value as LendTokenConfig;
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

/**
 * Hook to execute a Jupiter Lend (Earn) deposit or withdraw on Solana mainnet.
 * Mirrors useSolanaSwap: fetches base64 unsigned tx from our backend proxy,
 * signs+sends via Privy, then posts a writeback so the LendPosition row is updated.
 *
 * Returns { executeLend, isReady }.
 */
export function useJupiterLend() {
  const { authenticated, getAccessToken } = usePrivy();
  const { wallets, ready } = useWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();

  const isReady = Boolean(authenticated && ready && wallets?.length);

  const executeLend = async (params: LendExecuteParams): Promise<LendExecuteResult> => {
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

    const tokenSymbol = params.tokenSymbol.trim().toUpperCase();
    const tokenConfig = SOLANA_TOKEN_MAP[tokenSymbol];
    if (!tokenConfig?.address || typeof tokenConfig.decimals !== 'number') {
      throw new Error(`Lend token ${tokenSymbol} is not configured for Solana. Add it to config/token_info/solana_tokens.ts.`);
    }
    const tokenMint = tokenConfig.address;
    const decimals = tokenConfig.decimals;

    // Look up the Jupiter Lend market for APY + vault metadata (best-effort).
    let market: LendMarket | null = null;
    try {
      const marketRes = await fetch('/api/jupiter/lend/tokens', { method: 'GET' });
      if (marketRes.ok) {
        const data = (await marketRes.json()) as { tokens?: LendMarket[] };
        market =
          data.tokens?.find(
            (t) =>
              (typeof t.asset === 'string' && t.asset === tokenMint) ||
              (typeof t.symbol === 'string' && t.symbol.toUpperCase() === tokenSymbol)
          ) ?? null;
      }
    } catch (err) {
      console.warn('[Lend] markets fetch failed (will still attempt action):', err);
    }

    // Resolve amount in raw lamports. For 'all' withdraw we read the user's position
    // and switch to /redeem (share-based) so every share is burned (true full closeout
    // including accrued yield). For sized withdraws we stay on /withdraw (underlying-based).
    let amountRaw = '';
    let useRedeem = false;
    // Underlying amount we will record in MongoDB for accounting (always in token lamports).
    let underlyingForWriteback: string | null = null;
    const trimmed = String(params.amount).trim().toLowerCase();
    if (params.action === 'withdraw' && (trimmed === 'all' || trimmed === 'max')) {
      try {
        const posRes = await fetch(`/api/jupiter/lend/positions?wallet=${encodeURIComponent(signer)}`);
        if (!posRes.ok) throw new Error(`Positions lookup failed: ${posRes.status}`);
        const posData = (await posRes.json()) as {
          positions?: Array<{ asset?: string; symbol?: string; underlyingAmount?: string; shares?: string }>;
        };
        const match = posData.positions?.find(
          (p) =>
            (typeof p.asset === 'string' && p.asset === tokenMint) ||
            (typeof p.symbol === 'string' && p.symbol.toUpperCase() === tokenSymbol)
        );
        const shareBalance = match?.shares ?? '0';
        const underlyingBalance = match?.underlyingAmount ?? '0';
        if (shareBalance && shareBalance !== '0') {
          // Prefer /redeem with full share balance for clean closeout.
          useRedeem = true;
          amountRaw = shareBalance;
          underlyingForWriteback = underlyingBalance !== '0' ? underlyingBalance : null;
        } else if (underlyingBalance && underlyingBalance !== '0') {
          // Fallback when share balance isn't returned for some reason.
          amountRaw = underlyingBalance;
          underlyingForWriteback = underlyingBalance;
        } else {
          throw new Error(`No active ${tokenSymbol} lend position to withdraw.`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Could not resolve 'all' withdraw amount: ${msg}`);
      }
    } else {
      amountRaw = toRawAmount(params.amount, decimals);
      if (amountRaw === '0') {
        throw new Error('Amount must be greater than 0.');
      }
      if (params.action === 'withdraw') {
        underlyingForWriteback = amountRaw;
      }
    }

    const accessToken = await getAccessToken();
    const proxyPath =
      params.action === 'deposit'
        ? '/api/jupiter/lend/deposit'
        : useRedeem
          ? '/api/jupiter/lend/redeem'
          : '/api/jupiter/lend/withdraw';
    const proxyRes = await withWaitLogger(
      {
        file: 'altair_frontend1/src/lib/useJupiterLend.ts',
        target: proxyPath,
        description: `Jupiter Lend ${params.action} build tx`,
      },
      () =>
        fetch(proxyPath, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          credentials: 'include',
          body: JSON.stringify({
            asset: tokenMint,
            signer,
            amount: amountRaw,
          }),
        })
    );

    if (!proxyRes.ok) {
      const errBody = (await proxyRes.json().catch(() => ({}))) as { error?: string };
      throw new Error(errBody?.error ?? `Jupiter Lend ${params.action} request failed`);
    }
    const proxyPayload = (await proxyRes.json()) as {
      transaction?: string;
      serializedTransaction?: string;
    };
    const txBase64 = proxyPayload.transaction ?? proxyPayload.serializedTransaction;
    if (!txBase64) throw new Error('No transaction returned from Jupiter Lend.');

    const txBuffer = Buffer.from(txBase64, 'base64');
    const versionedTx = VersionedTransaction.deserialize(txBuffer);
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');

    // Refresh blockhash + clear sigs so Privy can re-sign with the latest hash.
    try {
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      versionedTx.message.recentBlockhash = blockhash;
      versionedTx.signatures = versionedTx.signatures.map(() => new Uint8Array(64));
    } catch (err) {
      console.warn('[Lend] getLatestBlockhash failed; using returned tx as-is', err);
    }

    let serialized = versionedTx.serialize();

    // Preflight simulate, mirroring useSolanaSwap.
    const preflight = await withWaitLogger(
      {
        file: 'altair_frontend1/src/lib/useJupiterLend.ts',
        target: 'Solana simulateTransaction',
        description: `Jupiter Lend ${params.action} preflight`,
      },
      () => connection.simulateTransaction(versionedTx, { sigVerify: false, replaceRecentBlockhash: true })
    );
    if (preflight?.value?.err) {
      const logs = preflight.value.logs ?? [];
      throw new Error(
        `Jupiter Lend ${params.action} preflight failed: ${JSON.stringify(preflight.value.err)}${
          logs.length ? `\nSimulation logs:\n${logs.join('\n')}` : ''
        }`
      );
    }

    const signAndSend = () =>
      signAndSendTransaction({
        transaction: serialized,
        wallet,
        chain: 'solana:mainnet',
      });

    let txHash = '';
    try {
      const { signature } = await withWaitLogger(
        {
          file: 'altair_frontend1/src/lib/useJupiterLend.ts',
          target: 'Privy signAndSendTransaction',
          description: `Jupiter Lend ${params.action} sign+send`,
        },
        signAndSend
      );
      txHash = typeof signature === 'string' ? signature : bs58.encode(signature);
    } catch (err) {
      // One retry with a fresh blockhash if Privy reports a signature issue (matches useSolanaSwap).
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
        const retry = await signAndSend();
        txHash = typeof retry.signature === 'string' ? retry.signature : bs58.encode(retry.signature);
      } else {
        throw err;
      }
    }

    // Dispatch swap-style events so wallet UI refreshes after lend (treat as swap for balance staleness).
    const gasSymbol = (GAS_TOKENS.SOLANA_MAINNET ?? 'SOL').toUpperCase();
    const balanceStaleSymbols = new Set([tokenSymbol, gasSymbol]);
    const now = Date.now();
    balanceStaleSymbols.forEach((symbol) => {
      if (symbol) {
        dispatchBalanceStale({
          chainKey: 'SOLANA_MAINNET',
          symbol,
          reason: 'swap',
          timestamp: now,
        });
      }
    });
    dispatchSwapSubmitted({
      sellToken: params.action === 'deposit' ? tokenSymbol : `LEND:${tokenSymbol}`,
      buyToken: params.action === 'deposit' ? `LEND:${tokenSymbol}` : tokenSymbol,
      sellChain: 'SOLANA_MAINNET',
      buyChain: 'SOLANA_MAINNET',
      amount: amountRaw,
      txHash,
      timestamp: now,
    });

    // Writeback to /api/lend-positions so MongoDB stays in sync.
    try {
      const writebackRes = await fetch('/api/lend-positions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          kind: params.action,
          chain: 'SOLANA_MAINNET',
          walletAddress: signer,
          provider: 'Jupiter',
          tokenSymbol,
          tokenMint,
          decimals,
          // For redeem flow, amountRaw is share quantity, but for accounting we want
          // the underlying asset amount that was returned to the user.
          amountRaw: underlyingForWriteback ?? amountRaw,
          shareAmountRaw: useRedeem ? amountRaw : null,
          txHash,
          vault: market?.vault ?? null,
          apySnapshot: typeof market?.apy === 'number' ? market.apy : null,
          CID: params.CID ?? null,
        }),
      });
      if (!writebackRes.ok) {
        const body = await writebackRes.json().catch(() => ({}));
        console.warn('[Lend] writeback non-OK:', body);
      }
    } catch (err) {
      console.warn('[Lend] writeback request failed (non-fatal):', err);
    }

    dispatchSwapComplete({
      sellToken: params.action === 'deposit' ? tokenSymbol : `LEND:${tokenSymbol}`,
      buyToken: params.action === 'deposit' ? `LEND:${tokenSymbol}` : tokenSymbol,
      sellChain: 'SOLANA_MAINNET',
      buyChain: 'SOLANA_MAINNET',
      amount: amountRaw,
      txHash,
      timestamp: Date.now(),
    });

    return {
      txHash,
      amountRaw,
      tokenSymbol,
      tokenMint,
      apySnapshot: typeof market?.apy === 'number' ? market.apy : null,
      vault: market?.vault ?? null,
    };
  };

  return { executeLend, isReady };
}
