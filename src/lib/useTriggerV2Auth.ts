'use client';

import { useCallback } from 'react';
import { useWallets, useSignMessage } from '@privy-io/react-auth/solana';
import { getOrFetchJwt, clearJwtCache } from './triggerV2Jwt';

/**
 * React hook that resolves a Jupiter Trigger V2 JWT for the connected Solana
 * wallet. Wraps `getOrFetchJwt` (in-memory cache + challenge/verify flow) with
 * Privy's `useSignMessage` so the challenge → sign step uses the user's
 * embedded wallet.
 *
 * First call triggers a Privy signing UI prompt. Subsequent calls within the
 * 24h JWT TTL are instantaneous (cache hit, no signing prompt).
 *
 * Usage:
 *   const { ensureJwt } = useTriggerV2Auth();
 *   const jwt = await ensureJwt();
 *   await fetch('/api/jupiter/trigger-v2/vault', {
 *     headers: { Authorization: `Bearer ${jwt}` },
 *   });
 */
export function useTriggerV2Auth() {
  const { wallets } = useWallets();
  const { signMessage } = useSignMessage();

  const ensureJwt = useCallback(async (): Promise<string> => {
    const wallet = wallets?.[0];
    if (!wallet?.address) {
      throw new Error('No Solana wallet connected. Connect one to use Jupiter Trigger V2.');
    }
    return getOrFetchJwt({
      walletPubkey: wallet.address,
      signMessage: async (challengeBytes: Uint8Array) => {
        const result = await signMessage({
          message: challengeBytes,
          wallet,
          options: {
            uiOptions: {
              // Surfaced in Privy's signing modal so users understand what
              // they're authorising.
              title: 'Authorise Jupiter Limit Orders',
              description:
                'Sign this challenge to authenticate with Jupiter Trigger V2. This does NOT move any funds and the token expires in 24h.',
            },
          },
        });
        return result.signature;
      },
    });
  }, [wallets, signMessage]);

  return { ensureJwt, clearJwtCache };
}
