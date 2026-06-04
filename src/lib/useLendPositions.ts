'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth/solana';
import { isSwapCompleteEvent } from './eventTypes';
import { getBackendBaseUrl } from './backendUrl';

export type LendMarket = {
  asset?: string;
  vault?: string;
  symbol?: string;
  decimals?: number;
  apy?: number | null;
  logoURI?: string;
};

export type LendPositionRow = {
  LPID?: string;
  UID?: string;
  walletAddress?: string;
  chain?: string;
  provider?: string;
  token?: {
    symbol?: string;
    contractAddress?: string;
    decimals?: number;
  };
  vault?: string;
  shares?: string;
  principalRaw?: string;
  apySnapshot?: number | null;
  /** Optional accrued earnings (lamports) merged in from /api/jupiter/lend/earnings. */
  earningsRaw?: string | null;
  /** Optional live underlying balance (lamports) merged in from Jupiter positions. */
  underlyingAmountRaw?: string | null;
  status?: 'active' | 'closed';
  updatedAt?: string;
};

type FetchState = {
  loading: boolean;
  error: string | null;
  markets: LendMarket[];
  positions: LendPositionRow[];
  lastSyncedAt: number | null;
};

const REFRESH_THROTTLE_MS = 4_000;

// Jupiter's lend endpoints occasionally return `asset` as an object
// (e.g. { address, chainId, ... }) instead of the plain mint string the rest of
// the app expects. Normalize at the network boundary so downstream code, React
// keys, and Map<string, ...> lookups all get a real string.
const toMintString = (raw: unknown): string | undefined => {
  if (typeof raw === 'string') return raw || undefined;
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    for (const k of ['address', 'mint', 'id']) {
      const v = r[k];
      if (typeof v === 'string' && v) return v;
    }
  }
  return undefined;
};

const lendPositionFingerprint = (rows: LendPositionRow[]): string =>
  rows
    .map((p) => `${p.LPID ?? ''}:${p.principalRaw ?? '0'}:${p.shares ?? '0'}:${p.underlyingAmountRaw ?? ''}`)
    .join('|');

/**
 * Subscribes to user's Jupiter Lend (Earn) markets + positions. Refreshes
 * automatically when an altair:swap-complete fires for a LEND: pseudo-token
 * (dispatched by useJupiterLend) so wallet panel + lend panel stay live.
 */
export function useLendPositions(opts: { enabled?: boolean } = {}) {
  const { enabled = true } = opts;
  const { authenticated, getAccessToken } = usePrivy();
  const { wallets } = useWallets();

  const solanaAddress = wallets?.[0]?.address ?? null;
  const lastRefreshRef = useRef(0);
  const fingerprintRef = useRef('');

  const [state, setState] = useState<FetchState>({
    loading: false,
    error: null,
    markets: [],
    positions: [],
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
      const backend = getBackendBaseUrl();
      const [marketsRes, mongoRes, jupPositionsRes, earningsRes] = await Promise.all([
        fetch(`${backend}/api/jupiter/lend/tokens`).then((r) => (r.ok ? r.json() : { tokens: [] })),
        fetch(`${backend}/api/lend-positions?wallet=${encodeURIComponent(solanaAddress)}`, {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        }).then((r) => (r.ok ? r.json() : { positions: [] })),
        fetch(`${backend}/api/jupiter/lend/positions?wallet=${encodeURIComponent(solanaAddress)}`)
          .then((r) => (r.ok ? r.json() : { positions: [] })),
        fetch(`${backend}/api/jupiter/lend/earnings?wallet=${encodeURIComponent(solanaAddress)}`)
          .then((r) => (r.ok ? r.json() : { earnings: [] })),
      ]);

      const rawMarkets: Array<LendMarket & { asset?: unknown }> = Array.isArray(marketsRes)
        ? marketsRes
        : Array.isArray(marketsRes?.tokens)
          ? marketsRes.tokens
          : [];
      const markets: LendMarket[] = rawMarkets.map((m) => ({
        ...m,
        asset: toMintString(m.asset),
      }));
      const mongoPositions: LendPositionRow[] = Array.isArray(mongoRes?.positions)
        ? mongoRes.positions
        : [];
      type JupPositionRaw = {
        asset?: unknown;
        symbol?: string;
        shares?: string;
        underlyingAmount?: string;
        apy?: number;
      };
      const rawJupPositions: JupPositionRaw[] = Array.isArray(jupPositionsRes?.positions)
        ? jupPositionsRes.positions
        : Array.isArray(jupPositionsRes)
          ? jupPositionsRes
          : [];
      const jupPositions: Array<{
        asset?: string;
        symbol?: string;
        shares?: string;
        underlyingAmount?: string;
        apy?: number;
      }> = rawJupPositions.map((p) => ({
        ...p,
        asset: toMintString(p.asset),
      }));
      const rawEarnings: Array<{ asset?: unknown; symbol?: string; earningsRaw?: string }> = Array.isArray(
        earningsRes?.earnings
      )
        ? earningsRes.earnings
        : Array.isArray(earningsRes)
          ? earningsRes
          : [];
      const earnings: Array<{ asset?: string; symbol?: string; earningsRaw?: string }> = rawEarnings.map((e) => ({
        ...e,
        asset: toMintString(e.asset),
      }));

      // Build a quick market APY lookup by mint address and symbol for position enrichment.
      const marketApyByMint = new Map<string, number>();
      const marketApyBySym = new Map<string, number>();
      for (const m of markets) {
        const apy = typeof m.apy === 'number' ? m.apy : null;
        if (apy == null) continue;
        if (m.asset) marketApyByMint.set(m.asset, apy);
        if (m.symbol) marketApyBySym.set(m.symbol.toUpperCase(), apy);
      }
      const resolveApy = (mint?: string, sym?: string, fallback?: number | null): number | null => {
        if (mint && marketApyByMint.has(mint)) return marketApyByMint.get(mint)!;
        if (sym && marketApyBySym.has(sym.toUpperCase())) return marketApyBySym.get(sym.toUpperCase())!;
        return fallback ?? null;
      };

      // Merge Jupiter live data into Mongo rows; surface Jupiter-only positions too.
      const seenLPIDs = new Set<string>();
      const merged: LendPositionRow[] = mongoPositions.map((row) => {
        const sym = row.token?.symbol?.toUpperCase();
        const mint = row.token?.contractAddress;
        const livePos = jupPositions.find(
          (p) =>
            (mint && p.asset === mint) || (sym && typeof p.symbol === 'string' && p.symbol.toUpperCase() === sym)
        );
        const earn = earnings.find(
          (e) =>
            (mint && e.asset === mint) || (sym && typeof e.symbol === 'string' && e.symbol.toUpperCase() === sym)
        );
        if (row.LPID) seenLPIDs.add(row.LPID);
        return {
          ...row,
          underlyingAmountRaw: livePos?.underlyingAmount ?? null,
          shares: livePos?.shares ?? row.shares ?? '0',
          // Prefer live position APY, then fall back to the normalised market APY we computed above.
          apySnapshot: resolveApy(mint, sym, typeof livePos?.apy === 'number' ? livePos.apy : row.apySnapshot),
          earningsRaw: earn?.earningsRaw ?? null,
        };
      });

      // Add Jupiter-only positions (e.g. user lent outside Altair). Best-effort schema match.
      for (const p of jupPositions) {
        const sym = p.symbol?.toUpperCase();
        const alreadyTracked = merged.some(
          (m) =>
            (p.asset && m.token?.contractAddress === p.asset) ||
            (sym && m.token?.symbol?.toUpperCase() === sym)
        );
        if (alreadyTracked) continue;
        const earn = earnings.find(
          (e) => (p.asset && e.asset === p.asset) || (sym && e.symbol?.toUpperCase() === sym)
        );
        merged.push({
          provider: 'Jupiter',
          chain: 'SOLANA_MAINNET',
          token: { symbol: sym, contractAddress: p.asset },
          shares: p.shares ?? '0',
          underlyingAmountRaw: p.underlyingAmount ?? null,
          apySnapshot: resolveApy(p.asset, sym, typeof p.apy === 'number' ? p.apy : null),
          earningsRaw: earn?.earningsRaw ?? null,
          status: 'active',
        });
      }

      const filtered = merged.filter((p) => {
        const principal = p.principalRaw ?? '0';
        const underlying = p.underlyingAmountRaw ?? '0';
        return principal !== '0' || underlying !== '0';
      });

      const nextFingerprint = lendPositionFingerprint(filtered);
      if (nextFingerprint !== fingerprintRef.current) {
        fingerprintRef.current = nextFingerprint;
      }

      setState({
        loading: false,
        error: null,
        markets,
        positions: filtered,
        lastSyncedAt: now,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load lend data';
      setState((prev) => ({ ...prev, loading: false, error: message }));
    }
  }, [enabled, authenticated, solanaAddress, getAccessToken]);

  useEffect(() => {
    void refresh(true);
  }, [refresh]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (event: Event) => {
      if (!isSwapCompleteEvent(event)) return;
      const detail = event.detail;
      const involvesLend =
        detail?.sellToken?.startsWith('LEND:') || detail?.buyToken?.startsWith('LEND:');
      if (!involvesLend) return;
      void refresh(true);
    };
    window.addEventListener('altair:swap-complete', handler as EventListener);
    return () => window.removeEventListener('altair:swap-complete', handler as EventListener);
  }, [refresh]);

  return {
    ...state,
    refresh: () => refresh(true),
  };
}
