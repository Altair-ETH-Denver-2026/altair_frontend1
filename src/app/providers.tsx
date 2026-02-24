'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { base, baseSepolia, mainnet, sepolia } from 'viem/chains';

export default function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? process.env.PRIVY_APP_ID;

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
        // This is key: it creates a wallet for email/google users automatically
        defaultChain: base,
        supportedChains: [base, baseSepolia, sepolia, mainnet],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
