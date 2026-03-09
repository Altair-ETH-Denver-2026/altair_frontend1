'use client';

import { PublicKey, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { withWaitLogger } from './waitLogger';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets, useSignAndSendTransaction } from '@privy-io/react-auth/solana';
import { resolveSelectedChain } from './useSwap';
import type { ChainKey } from '../../config/blockchain_config';

/**
 * Hook to execute a swap on Solana mainnet via Jupiter Swap API.
 * Returns (sellToken, sellAmount, buyToken) => Promise<signature string>.
 * Use when selected chain is SOLANA_MAINNET.
 */
export function useSolanaSwap(explicitChain?: ChainKey) {
  const { authenticated, getAccessToken } = usePrivy();
  const { wallets, ready } = useWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();

  return async (
    sellToken: string,
    sellAmount: string,
    buyToken: string,
    CID?: string | null
  ): Promise<string> => {
    if (!authenticated || !ready || !wallets?.length) {
      throw new Error('No authenticated Solana wallet available. Connect a Solana wallet in the app.');
    }

    const selectedChain = resolveSelectedChain(explicitChain);
    if (selectedChain !== 'SOLANA_MAINNET') {
      throw new Error('useSolanaSwap is for Solana only. Selected chain is not SOLANA_MAINNET.');
    }

    const wallet = wallets[0];
    const recipient = wallet.address;
    try {
      new PublicKey(recipient);
    } catch {
      throw new Error('Invalid Solana wallet address. Ensure your Solana wallet is connected.');
    }

    const accessToken = await withWaitLogger(
      {
        file: 'altair_frontend1/src/lib/useSolanaSwap.ts',
        target: 'Privy getAccessToken',
        description: 'access token for Solana swap',
      },
      () => getAccessToken()
    );
    const routeResponse = await withWaitLogger(
      {
        file: 'altair_frontend1/src/lib/useSolanaSwap.ts',
        target: '/api/test-swap',
        description: 'Solana swap route response',
      },
      () =>
        fetch('/api/test-swap', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          credentials: 'include',
          body: JSON.stringify({
            chain: 'SOLANA_MAINNET',
            sellToken: sellToken.toUpperCase(),
            buyToken: buyToken.toUpperCase(),
            amount: sellAmount,
            recipient,
          }),
        })
    );

    if (!routeResponse.ok) {
      const errPayload = await routeResponse.json().catch(() => ({}));
      throw new Error((errPayload as { error?: string })?.error ?? 'Failed to fetch Solana swap quote');
    }

    const payload = (await routeResponse.json()) as {
      solana?: { swapTransaction?: string; rpcUrl?: string; amountOut?: string };
      sellTokenAddress?: string;
      buyTokenAddress?: string;
      source?: string;
    };
    console.log('[Solana Swap] Jupiter route payload', {
      source: payload?.source ?? 'unknown',
      sellTokenAddress: payload?.sellTokenAddress ?? null,
      buyTokenAddress: payload?.buyTokenAddress ?? null,
      amountOut: payload?.solana?.amountOut ?? null,
      rpcUrl: payload?.solana?.rpcUrl ?? null,
    });

    const swapTransactionBase64 = payload?.solana?.swapTransaction;
    if (!swapTransactionBase64) {
      throw new Error('No swap transaction returned from Jupiter.');
    }

    const txBuffer = Buffer.from(swapTransactionBase64, 'base64');
    const versionedTx = VersionedTransaction.deserialize(txBuffer);
    const rpcUrl = payload?.solana?.rpcUrl;
    const refreshBlockhash = async () => {
      if (!rpcUrl) return;
      try {
        const res = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getLatestBlockhash',
            params: [{ commitment: 'confirmed' }],
          }),
        });
        if (res.ok) {
          const json = await res.json().catch(() => null);
          const value = json?.result?.value;
          if (value?.blockhash) {
            versionedTx.message.recentBlockhash = value.blockhash;
            versionedTx.signatures = versionedTx.signatures.map(() => new Uint8Array(64));
          }
        }
      } catch (err) {
        console.warn('[Solana Swap] getLatestBlockhash via rpcUrl failed', err);
      }
    };
    await refreshBlockhash();
    let serialized = versionedTx.serialize();

    try {
      const { signature } = await withWaitLogger(
        {
          file: 'altair_frontend1/src/lib/useSolanaSwap.ts',
          target: 'Privy signAndSendTransaction',
          description: 'Solana swap signing and submission',
        },
        () =>
          signAndSendTransaction({
            transaction: serialized,
            wallet,
            chain: 'solana:mainnet',
          })
      );
      const txHash = typeof signature === 'string' ? signature : bs58.encode(signature);

      void fetch('/api/test-swap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          chain: 'SOLANA_MAINNET',
          sellToken: sellToken.toUpperCase(),
          buyToken: buyToken.toUpperCase(),
          amount: sellAmount,
          recipient,
          CID: CID ?? null,
          txHash,
        }),
      }).catch((err) => {
        console.warn('[Solana Swap] swap writeback failed', err);
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('altair:swap-complete', {
            detail: { chain: 'SOLANA_MAINNET', sellToken: sellToken.toUpperCase(), buyToken: buyToken.toUpperCase() },
          })
        );
      }

      return txHash;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('403') || msg.includes('HTTP error (403)')) {
        throw new Error(
          'Solana RPC returned 403 (rate limit). Use a custom RPC: set NEXT_PUBLIC_SOLANA_RPC_URL in .env to a free RPC (e.g. Helius: https://www.helius.dev, QuickNode, Alchemy) and restart the dev server.'
        );
      }
      if (msg.includes('signature verification') || msg.includes('signature')) {
        await refreshBlockhash();
        serialized = versionedTx.serialize();
        const retry = await withWaitLogger(
          {
            file: 'altair_frontend1/src/lib/useSolanaSwap.ts',
            target: 'Privy signAndSendTransaction',
            description: 'Solana swap signing and submission (retry)',
          },
          () =>
            signAndSendTransaction({
              transaction: serialized,
              wallet,
              chain: 'solana:mainnet',
            })
        );
        const retrySig = retry?.signature;
        const retryHash = typeof retrySig === 'string' ? retrySig : bs58.encode(retrySig);
        return retryHash;
      }
      throw err;
    }
  };
}
