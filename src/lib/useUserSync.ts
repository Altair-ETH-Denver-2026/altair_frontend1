'use client';

import { useEffect, useMemo, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';
import { withWaitLogger } from './waitLogger';
import { getCachedPrivyAccessToken } from './privyTokenCache';

type ContactInfo = {
  email?: string;
  phone?: string;
};

type ContactSnapshot = {
  id?: string;
  walletAddress?: string;
  email?: string;
  phone?: string;
  linkedAccountCount: number;
};

type LinkedAccount = {
  type?: string;
  address?: string;
  email?: string;
  email_address?: string;
  number?: string;
};

type PrivyUserShape = {
  id?: string;
  wallet?: { address?: string };
  email?: { address?: string };
  phone?: { number?: string } | string;
  linkedAccounts?: LinkedAccount[];
};

const buildContactSnapshot = (user: PrivyUserShape | null | undefined): ContactSnapshot => {
  const linkedAccounts = Array.isArray(user?.linkedAccounts) ? user.linkedAccounts : [];
  const primaryEmail = user?.email?.address ?? undefined;
  const fallbackEmail = linkedAccounts.find((account) => account?.type === 'email')?.address;
  const googleEmail = linkedAccounts.find((account) => account?.type === 'google_oauth')?.email
    ?? linkedAccounts.find((account) => account?.type === 'google')?.email
    ?? linkedAccounts.find((account) => account?.type === 'google')?.address
    ?? linkedAccounts.find((account) => account?.type === 'google_oauth')?.address
    ?? linkedAccounts.find((account) => account?.type === 'google_oauth')?.email_address;
  const phone =
    (typeof user?.phone === 'string' && user.phone) ||
    (typeof user?.phone === 'object' && typeof user.phone?.number === 'string' ? user.phone.number : undefined);

  return {
    id: user?.id,
    walletAddress: user?.wallet?.address,
    email: primaryEmail ?? fallbackEmail ?? googleEmail ?? undefined,
    phone: phone ?? linkedAccounts.find((account) => account?.type === 'phone')?.number,
    linkedAccountCount: linkedAccounts.length,
  };
};

export function useUserSync() {
  const { authenticated, getAccessToken, user } = usePrivy();
  const { wallets } = useWallets();
  const { wallets: solanaWallets } = useSolanaWallets();
  const lastSyncedKeyRef = useRef<string | null>(null);
  const contactSnapshot = useMemo(() => buildContactSnapshot(user as PrivyUserShape), [user]);
  const evmWalletAddress = wallets?.[0]?.address;
  const solanaWalletAddress = solanaWallets?.[0]?.address;

  useEffect(() => {
    if (!authenticated) return;

    const syncKey = [
      contactSnapshot.id ?? 'unknown',
      contactSnapshot.walletAddress ?? '',
      contactSnapshot.linkedAccountCount.toString(),
      contactSnapshot.email ?? '',
      contactSnapshot.phone ?? '',
      evmWalletAddress ?? '',
      solanaWalletAddress ?? '',
    ].join('|');

    if (lastSyncedKeyRef.current === syncKey) return;

    const run = async () => {
      try {
        const accessToken = await withWaitLogger(
          {
            file: 'altair_frontend1/src/lib/useUserSync.ts',
            target: 'Privy getAccessToken',
            description: 'access token for login sync',
          },
          () => getCachedPrivyAccessToken(getAccessToken)
        );
        const contactInfo: ContactInfo = {
          ...(contactSnapshot.email ? { email: contactSnapshot.email } : {}),
          ...(contactSnapshot.phone ? { phone: contactSnapshot.phone } : {}),
        };
        const walletPayload = {
          ...(evmWalletAddress ? { evmAddress: evmWalletAddress } : {}),
          ...(solanaWalletAddress ? { solanaAddress: solanaWalletAddress } : {}),
        };
        await withWaitLogger(
          {
            file: 'altair_frontend1/src/lib/useUserSync.ts',
            target: '/api/balances',
            description: 'user login + balance sync response',
          },
          () =>
            fetch('/api/balances', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                accessToken,
                ...(contactInfo.email ? { email: contactInfo.email } : {}),
                ...(contactInfo.phone ? { phone: contactInfo.phone } : {}),
                ...walletPayload,
              }),
            })
        );
        lastSyncedKeyRef.current = syncKey;
      } catch (err) {
        console.warn('User login sync failed:', err);
      }
    };

    void run();
  }, [authenticated, getAccessToken, contactSnapshot, evmWalletAddress, solanaWalletAddress]);
}
