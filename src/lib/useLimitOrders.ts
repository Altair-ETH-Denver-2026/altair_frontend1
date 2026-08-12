'use client';

import { Buffer } from 'buffer';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets, useSignTransaction } from '@privy-io/react-auth/solana';
import { useTriggerV2Auth } from './useTriggerV2Auth';
import type { LimitOrderRow } from './limitOrderTypes';
import { getBackendBaseUrl } from './backendUrl';

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
  const { signTransaction } = useSignTransaction();
  const { ensureJwt } = useTriggerV2Auth();
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
        `${getBackendBaseUrl()}/api/limit-orders?wallet=${encodeURIComponent(solanaAddress)}&status=pending`,
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

  /**
   * Cancel an order. Routing depends on providerVersion:
   *
   *   V1 (or unknown): PATCH /api/limit-orders/[LOID] {status:'cancelled'}.
   *     V1 orders don't have a Jupiter-side cancel endpoint we can hit safely
   *     without the original create-tx, so the safest path is to just mark our
   *     row cancelled and let sync-fills reconcile if Jupiter still fills it.
   *
   *   V2: full 2-step withdrawal flow:
   *     1. POST /api/jupiter/trigger-v2/orders/price/cancel/{providerOrderId}
   *        → unsigned withdrawal tx + cancelRequestId
   *        (Jupiter immediately moves order to ready_to_cancel, so a fill race
   *         cannot happen between this call and our signature.)
   *     2. Privy signs the withdrawal tx.
   *     3. POST /api/jupiter/trigger-v2/orders/price/confirm-cancel/{providerOrderId}
   *        with {signedTransaction, cancelRequestId} → fills out the withdrawal.
   *     4. PATCH our local row to status='cancelled' + fillTxHash=<withdraw sig>.
   */
  const cancelOrder = useCallback(
    async (LOID: string): Promise<void> => {
      const accessToken = await getAccessToken();
      const wallet = wallets?.[0];

      // Look up the in-memory row so we know which provider version to use.
      // (We could re-fetch from /api/limit-orders, but the panel already has
      // the row in state, and stale-by-one-poll is fine here.)
      const localRow = state.orders.find((o) => o.LOID === LOID) ?? null;
      const isV2 =
        localRow?.providerVersion === 'v2' &&
        !!localRow?.providerOrderId &&
        localRow?.kind === 'price';

      // V1 / time / unknown → simple status patch.
      if (!isV2 || !wallet?.address) {
        const res = await fetch(`${getBackendBaseUrl()}/api/limit-orders/${encodeURIComponent(LOID)}`, {
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
        return;
      }

      // V2 path. providerOrderId is guaranteed by the isV2 check above.
      const providerOrderId = localRow.providerOrderId as string;
      const jwt = await ensureJwt();

      // Step 1: initiate.
      const initRes = await fetch(
        `${getBackendBaseUrl()}/api/jupiter/trigger-v2/orders/price/cancel/${encodeURIComponent(providerOrderId)}`,
        { method: 'POST', headers: { Authorization: `Bearer ${jwt}` } }
      );
      if (!initRes.ok) {
        const body = (await initRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(body?.error ?? `V2 cancel-initiate failed (${initRes.status})`);
      }
      const init = (await initRes.json()) as {
        transaction?: string;
        requestId?: string;
      };
      if (!init.transaction || !init.requestId) {
        throw new Error('V2 cancel-initiate returned an incomplete response.');
      }

      // Step 2: Privy signs the withdrawal tx.
      const unsignedTxBytes = Buffer.from(init.transaction, 'base64');
      const { signedTransaction } = await signTransaction({
        transaction: new Uint8Array(unsignedTxBytes),
        wallet,
        chain: 'solana:mainnet',
      });
      const signedB64 = Buffer.from(signedTransaction).toString('base64');

      // Step 3: confirm.
      const confirmRes = await fetch(
        `${getBackendBaseUrl()}/api/jupiter/trigger-v2/orders/price/confirm-cancel/${encodeURIComponent(providerOrderId)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({
            signedTransaction: signedB64,
            cancelRequestId: init.requestId,
          }),
        }
      );
      if (!confirmRes.ok) {
        const body = (await confirmRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(body?.error ?? `V2 confirm-cancel failed (${confirmRes.status})`);
      }
      const confirm = (await confirmRes.json()) as { txSignature?: string };

      // Step 4: PATCH our row. Best-effort — the cancel is durable on Jupiter's
      // side regardless of whether Mongo writeback succeeds.
      try {
        await fetch(`${getBackendBaseUrl()}/api/limit-orders/${encodeURIComponent(LOID)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({
            status: 'cancelled',
            fillTxHash: confirm.txSignature ?? null,
          }),
        });
      } catch (err) {
        console.warn('[limit-orders] local PATCH after V2 cancel failed (non-fatal):', err);
      }
      await refresh(true);
    },
    [getAccessToken, refresh, wallets, signTransaction, ensureJwt, state.orders]
  );

  useEffect(() => {
    void refresh(true);
  }, [refresh]);

  return { ...state, refresh: () => refresh(true), cancelOrder };
}
