'use client';

import { useEffect } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';
import { createSolanaRpc, createSolanaRpcSubscriptions, mainnet as solanaMainnet } from '@solana/kit';
import { base, baseSepolia, mainnet, sepolia } from 'viem/chains';
import { getBackendBaseUrl } from '../lib/backendUrl';
import { PRICE_RULES } from '../../config/blockchain_config';

const SOLANA_RPC_HTTP = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const SOLANA_RPC_WS =
  process.env.NEXT_PUBLIC_SOLANA_RPC_WS ||
  (SOLANA_RPC_HTTP.startsWith('https://')
    ? SOLANA_RPC_HTTP.replace(/^https:\/\//, 'wss://')
    : SOLANA_RPC_HTTP.startsWith('http://')
      ? SOLANA_RPC_HTTP.replace(/^http:\/\//, 'ws://')
      : 'wss://api.mainnet-beta.solana.com');

export default function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? process.env.PRIVY_APP_ID;

  if (!appId) {
    throw new Error('Missing NEXT_PUBLIC_PRIVY_APP_ID (or PRIVY_APP_ID) environment variable');
  }

  // Page-mount price refresh ping. Gated on PRICE_RULES.fetchAllConditions.refresh —
  // when false, no ping fires on mount/reload/reopen. The backend short-circuits when
  // not in setInterval mode (cron-job.org is authoritative on dev/prod), so this is
  // effectively a no-op outside localhost even when refresh=true. Fire-and-forget;
  // failures here must not affect provider rendering.
  useEffect(() => {
    if (!PRICE_RULES.fetchAllConditions.refresh) return;
    const url = `${getBackendBaseUrl()}/api/prices/check-freshness`;
    fetch(url, { method: 'POST', credentials: 'include' }).catch((err) => {
      console.warn('[providers] price freshness ping failed', err);
    });
  }, []);

  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          theme: 'dark',
          accentColor: '#676FFF', // Altair purple/blue
          showWalletLoginFirst: false,
          walletChainType: 'ethereum-and-solana',
        },
        // This is key: it creates a wallet for email/google users automatically
        defaultChain: base,
        supportedChains: [base, baseSepolia, sepolia, mainnet],
        externalWallets: {
          solana: {
            connectors: toSolanaWalletConnectors(),
          },
        },
        solana: {
          rpcs: {
            'solana:mainnet': {
              rpc: createSolanaRpc(solanaMainnet(SOLANA_RPC_HTTP)),
              rpcSubscriptions: createSolanaRpcSubscriptions(solanaMainnet(SOLANA_RPC_WS)),
            },
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Privy types expect test-cluster RPC; mainnet RPC is valid at runtime
        } as any,
      }}
    >
      {children}
    </PrivyProvider>
  );
}
