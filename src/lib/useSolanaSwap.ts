'use client';

import { useCallback } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import type { ChainKey } from '@config/blockchain_config';

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

function getMint(symbol: string): string {
  const u = symbol?.toUpperCase();
  if (u === 'SOL') return SOL_MINT;
  if (u === 'USDC') return USDC_MINT;
  throw new Error(`Unsupported Solana token: ${symbol}`);
}

function toRawAmount(symbol: string, amount: string): string {
  const n = parseFloat(amount);
  if (!Number.isFinite(n) || n < 0) throw new Error('Invalid amount');
  if (symbol?.toUpperCase() === 'SOL') return Math.floor(n * 1e9).toString();
  if (symbol?.toUpperCase() === 'USDC') return Math.floor(n * 1e6).toString();
  throw new Error(`Unsupported token for amount: ${symbol}`);
}

/**
 * Solana (Jupiter) swap for SOL/USDC when chain is SOLANA_MAINNET.
 * Returns tx signature string or throws.
 */
export function useSolanaSwap(_explicitChain?: ChainKey) {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();

  return useCallback(
    async (sellToken: string, sellAmount: string, buyToken: string): Promise<string> => {
      if (!authenticated || !wallets?.length) {
        throw new Error('No authenticated wallet available.');
      }
      const sell = sellToken.toUpperCase();
      const buy = buyToken.toUpperCase();
      if (sell !== 'SOL' && sell !== 'USDC') throw new Error('Only SOL and USDC are supported on Solana.');
      if (buy !== 'SOL' && buy !== 'USDC') throw new Error('Only SOL and USDC are supported on Solana.');
      if (sell === buy) throw new Error('Sell and buy must differ.');

      const inputMint = getMint(sell);
      const outputMint = getMint(buy);
      const amount = toRawAmount(sell, sellAmount);

      const api = '/api/jupiter-swap';

      const quoteRes = await fetch(
        `${api}?inputMint=${encodeURIComponent(inputMint)}&outputMint=${encodeURIComponent(outputMint)}&amount=${encodeURIComponent(amount)}&slippageBps=50`
      );
      if (!quoteRes.ok) {
        const err = await quoteRes.json().catch(() => ({}));
        throw new Error(err?.error ?? `Quote failed: ${quoteRes.status}`);
      }
      const quoteResponse = await quoteRes.json();

      const solanaWallet = wallets.find((w) => (w as { chainType?: string }).chainType === 'solana');
      if (!solanaWallet) {
        throw new Error('No Solana wallet found. Add a Solana wallet in Privy.');
      }
      const userPublicKey = (solanaWallet as { address?: string }).address;
      if (!userPublicKey) {
        throw new Error('Could not get Solana address.');
      }

      const swapRes = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ quoteResponse, userPublicKey }),
      });
      if (!swapRes.ok) {
        const err = await swapRes.json().catch(() => ({}));
        throw new Error(err?.error ?? `Swap build failed: ${swapRes.status}`);
      }
      const { swapTransaction: base64 } = (await swapRes.json()) as { swapTransaction?: string };
      if (!base64) throw new Error('No swap transaction returned.');

      const buf = Buffer.from(base64, 'base64');
      const txBytes = new Uint8Array(buf);

      const { VersionedTransaction, Connection } = await import('@solana/web3.js');
      const tx = VersionedTransaction.deserialize(txBytes);
      const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
      const connection = new Connection(rpcUrl);
      const signer = (solanaWallet as { signAndSendTransaction?: (tx: { serialize: () => Uint8Array }) => Promise<{ signature: string }> }).signAndSendTransaction;
      if (typeof signer === 'function') {
        const result = await signer(tx);
        return result?.signature ?? '';
      }
      const signed = await (solanaWallet as { signTransaction?: (tx: unknown) => Promise<unknown> }).signTransaction?.(tx);
      if (signed) {
        const serialized = (signed as { serialize: () => Uint8Array }).serialize();
        const sig = await connection.sendRawTransaction(serialized, { skipPreflight: false });
        return sig;
      }
      throw new Error('Could not sign Solana transaction. Ensure Privy Solana wallet is connected.');
    },
    [authenticated, wallets]
  );
}
