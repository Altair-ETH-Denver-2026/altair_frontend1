'use client';

import { useEffect, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';

export function useUserSync() {
  const { authenticated, getAccessToken } = usePrivy();
  const hasSyncedRef = useRef(false);

  useEffect(() => {
    if (!authenticated || hasSyncedRef.current) return;

    const run = async () => {
      try {
        const accessToken = await getAccessToken();
        await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken }),
        });
        hasSyncedRef.current = true;
      } catch (err) {
        console.warn('User login sync failed:', err);
      }
    };

    void run();
  }, [authenticated, getAccessToken]);
}
