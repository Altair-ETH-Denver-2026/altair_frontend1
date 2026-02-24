'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit';
import { base, baseSepolia, mainnet, sepolia } from 'viem/chains';

function getSolanaRpcConfig() {
  const httpUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  if (!httpUrl) return undefined;
  const wsUrl =
    process.env.NEXT_PUBLIC_SOLANA_RPC_WS ??
    httpUrl.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://');
  return {
    rpc: createSolanaRpc(httpUrl),
    rpcSubscriptions: createSolanaRpcSubscriptions(wsUrl),
  };
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? process.env.PRIVY_APP_ID;
  const solanaRpcs = getSolanaRpcConfig();

  if (!appId) {
    throw new Error('Missing NEXT_PUBLIC_PRIVY_APP_ID (or PRIVY_APP_ID) environment variable');
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          theme: 'dark',
          accentColor: '#676FFF', // Altair purple/blue
          showWalletLoginFirst: false,
        },
        defaultChain: base,
        supportedChains: [base, baseSepolia, sepolia, mainnet],
        ...(solanaRpcs && {
          solana: {
            rpcs: {
              'solana:mainnet': solanaRpcs,
            },
          },
        }),
      }}
    >
      {children}
    </PrivyProvider>
  );
}
