'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth/solana';
import type { LimitOrderRow } from './limitOrderTypes';

type FetchState = {
  loading: boolean;
  error: string | null;
  orders: LimitOrderRow[];
  lastSyncedAt: number | null;
};

const REFRESH_THROTTLE_MS = 4_000;

/**
 * Fetches the user's Altair-tracked limit orders from /api/limit-orders.
 * Today only pending (active) orders are surfaced; history paging is a follow-up.
 */
export function useLimitOrders(opts: { enabled?: boolean } = {}) {
  const { enabled = true } = opts;
  const { authenticated, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const solanaAddress = wallets?.[0]?.address ?? null;
  const lastRefreshRef = useRef(0);

  const [state, setState] = useState<FetchState>({
    loading: false,
    error: null,
    orders: [],
    lastSyncedAt: null,
  });

  const refresh = useCallback(async (force: boolean = false): Promise<void> => {
    if (!enabled || !authenticated || !solanaAddress) return;
    const now = Date.now();
    if (!force && now - lastRefreshRef.current < REFRESH_THROTTLE_MS) return;
    lastRefreshRef.current = now;

    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const accessToken = await getAccessToken();
      const res = await fetch(
        `/api/limit-orders?wallet=${encodeURIComponent(solanaAddress)}&status=pending`,
        {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        }
      );
      const body = (await res.json().catch(() => ({}))) as { orders?: LimitOrderRow[]; error?: string };
      if (!res.ok) {
        setState((prev) => ({ ...prev, loading: false, error: body?.error ?? 'Failed to load orders' }));
        return;
      }
      setState({
        loading: false,
        error: null,
        orders: Array.isArray(body.orders) ? body.orders : [],
        lastSyncedAt: now,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load orders';
      setState((prev) => ({ ...prev, loading: false, error: message }));
    }
  }, [enabled, authenticated, solanaAddress, getAccessToken]);

  const cancelOrder = useCallback(
    async (LOID: string): Promise<void> => {
      const accessToken = await getAccessToken();
      const res = await fetch(`/api/limit-orders/${encodeURIComponent(LOID)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body?.error ?? `Cancel failed (${res.status})`);
      }
      await refresh(true);
    },
    [getAccessToken, refresh]
  );

  useEffect(() => {
    void refresh(true);
  }, [refresh]);

  return { ...state, refresh: () => refresh(true), cancelOrder };
}
