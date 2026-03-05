'use client';

import { useCallback, useState } from 'react';
import { useWallets } from '@privy-io/react-auth';
import { useSignAndSendTransaction } from '@privy-io/react-auth/solana';
import { Connection } from '@solana/web3.js';
import bs58 from 'bs58';
import { ensureRelayClient, getRelayClient } from '../lib/relayClient';
import {
  createPrivyEvmRelayAdapter,
  createPrivySolanaRelayAdapter,
  RELAY_SOLANA_MAINNET_CHAIN_ID,
  RELAY_SOLANA_DEVNET_CHAIN_ID,
} from '../lib/relayAdapters';

export interface RelayQuoteParams {
  originChainId: number;
  destinationChainId: number;
  originCurrency: string;
  destinationCurrency: string;
  amount: string;
  user: string;
  recipient: string;
  tradeType?: 'EXACT_INPUT' | 'EXACT_OUTPUT' | 'EXPECTED_OUTPUT';
}

export interface UseRelayBridgeOptions {
  testnet?: boolean;
}

export interface RelayBridgeResult {
  txHashes?: string[];
  error?: string;
}

/**
 * Hook to get a Relay quote via our proxy and execute bridge/cross-chain swap using Privy EVM + Solana adapters.
 * Uses Helius for Solana (NEXT_PUBLIC_SOLANA_RPC_URL); no @solana/kit.
 */
export function useRelayBridge(options: UseRelayBridgeOptions = {}) {
  const { testnet = false } = options;
  const { wallets } = useWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const [isExecuting, setIsExecuting] = useState(false);
  const [progress, setProgress] = useState<{ currentStep?: string; txHashes?: string[] } | null>(null);

  const executeQuote = useCallback(
    async (params: RelayQuoteParams): Promise<RelayBridgeResult> => {
      if (!wallets?.length) {
        return { error: 'No wallet connected.' };
      }

      const wallet = wallets[0];
      const isOriginSolana =
        params.originChainId === RELAY_SOLANA_MAINNET_CHAIN_ID ||
        params.originChainId === RELAY_SOLANA_DEVNET_CHAIN_ID;

      setIsExecuting(true);
      setProgress(null);

      try {
        ensureRelayClient(testnet);

        const baseUrl =
          typeof window !== 'undefined' ? `${window.location.origin}/api/relay` : '';
        const quoteRes = await fetch(`${baseUrl}/quote/v2`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            testnet: testnet || undefined,
            originChainId: params.originChainId,
            destinationChainId: params.destinationChainId,
            originCurrency: params.originCurrency,
            destinationCurrency: params.destinationCurrency,
            amount: params.amount,
            user: params.user,
            recipient: params.recipient,
            tradeType: params.tradeType ?? 'EXACT_INPUT',
          }),
        });

        if (!quoteRes.ok) {
          const errBody = await quoteRes.json().catch(() => ({}));
          return { error: (errBody as { error?: string }).error ?? 'Failed to get quote' };
        }

        const quote = (await quoteRes.json()) as Record<string, unknown>;
        if (!quote?.steps?.length) {
          return { error: 'No steps in quote' };
        }

        let adapter: unknown;

        if (isOriginSolana) {
          const rpcUrl =
            process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
          const connection = new Connection(rpcUrl);
          const relaySolanaChainId = testnet ? RELAY_SOLANA_DEVNET_CHAIN_ID : RELAY_SOLANA_MAINNET_CHAIN_ID;
          adapter = createPrivySolanaRelayAdapter(
            connection,
            wallet.address,
            async (serialized: Uint8Array) => {
              const { signature } = await signAndSendTransaction({
                transaction: serialized,
                wallet,
                chain: testnet ? 'solana:devnet' : 'solana:mainnet',
              });
              return typeof signature === 'string' ? signature : bs58.encode(signature);
            },
            relaySolanaChainId
          );
        } else {
          const ethereumProvider = await wallet.getEthereumProvider();
          adapter = await createPrivyEvmRelayAdapter(ethereumProvider, {
            chainId: params.originChainId,
          });
        }

        const client = getRelayClient();
        if (!client?.actions?.execute) {
          return { error: 'Relay client not ready' };
        }

        const txHashes: string[] = [];
        await client.actions.execute({
          quote,
          wallet: adapter,
          onProgress: (p: { currentStep?: string; txHashes?: string[] }) => {
            setProgress(p);
            if (p.txHashes?.length) txHashes.push(...p.txHashes);
          },
        });

        return { txHashes: txHashes.length ? txHashes : undefined };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return { error: message };
      } finally {
        setIsExecuting(false);
        setProgress(null);
      }
    },
    [testnet, wallets, signAndSendTransaction]
  );

  return { executeQuote, isExecuting, progress };
}
