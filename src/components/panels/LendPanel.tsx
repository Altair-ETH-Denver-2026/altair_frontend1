'use client';

import React, { useMemo, useState } from 'react';
import Panel from '../Panel';
import { useJupiterLend } from '../../lib/useJupiterLend';
import { useLendPositions, type LendMarket, type LendPositionRow } from '../../lib/useLendPositions';

type LendPanelProps = {
  width: number;
  onClose: () => void;
  /** Optional CID for chat-memory linkage on writeback. */
  CID?: string | null;
};

const formatUnits = (raw: string | null | undefined, decimals: number, maxFractionDigits = 4): string => {
  if (!raw) return '0';
  try {
    const big = BigInt(raw);
    const negative = big < 0n;
    const abs = negative ? -big : big;
    const divisor = 10n ** BigInt(Math.max(0, decimals));
    const whole = abs / divisor;
    const frac = abs % divisor;
    if (decimals === 0) return `${negative ? '-' : ''}${whole.toString()}`;
    const fracStr = frac.toString().padStart(decimals, '0').slice(0, maxFractionDigits).replace(/0+$/, '');
    return `${negative ? '-' : ''}${whole.toString()}${fracStr ? '.' + fracStr : ''}`;
  } catch {
    return raw;
  }
};

const formatApy = (apy: number | null | undefined): string => {
  if (apy == null || Number.isNaN(apy)) return '—';
  // Jupiter returns APY as a percent (e.g. 4.21 = 4.21%). Some endpoints return 0.0421; tolerate both.
  const normalized = apy > 1 ? apy : apy * 100;
  return `${normalized.toFixed(2)}%`;
};

export default function LendPanel({ width, onClose, CID = null }: LendPanelProps) {
  const { executeLend, isReady } = useJupiterLend();
  const { markets, positions, loading, error, refresh } = useLendPositions({ enabled: true });

  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [submittingAction, setSubmittingAction] = useState<null | 'deposit' | 'withdraw'>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  // Show only USDC-style stables first to match the v1 scope (Jupiter Lend Earn is currently
  // dominated by USDC/USDT/USDS). We still surface anything Jupiter returns.
  const sortedMarkets: LendMarket[] = useMemo(() => {
    const priority = new Set(['USDC', 'USDT', 'USDS', 'USDU', 'PYUSD']);
    return [...markets].sort((a, b) => {
      const aS = (a.symbol ?? '').toUpperCase();
      const bS = (b.symbol ?? '').toUpperCase();
      const aP = priority.has(aS) ? 0 : 1;
      const bP = priority.has(bS) ? 0 : 1;
      if (aP !== bP) return aP - bP;
      return (b.apy ?? 0) - (a.apy ?? 0);
    });
  }, [markets]);

  const handleDeposit = async (market: LendMarket) => {
    if (!market.symbol) return;
    if (!depositAmount.trim() || Number(depositAmount) <= 0) {
      setActionError('Enter an amount to deposit.');
      return;
    }
    setActionError(null);
    setActionStatus(null);
    setSubmittingAction('deposit');
    try {
      const result = await executeLend({
        action: 'deposit',
        tokenSymbol: market.symbol,
        amount: depositAmount,
        CID,
      });
      setActionStatus(`Deposited ${depositAmount} ${market.symbol}. tx ${result.txHash.slice(0, 8)}…`);
      setDepositAmount('');
      setSelectedSymbol(null);
      void refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleWithdrawAll = async (row: LendPositionRow) => {
    const symbol = row.token?.symbol;
    if (!symbol) return;
    setActionError(null);
    setActionStatus(null);
    setSubmittingAction('withdraw');
    try {
      const result = await executeLend({
        action: 'withdraw',
        tokenSymbol: symbol,
        amount: 'all',
        CID,
      });
      setActionStatus(`Withdrew all ${symbol}. tx ${result.txHash.slice(0, 8)}…`);
      void refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmittingAction(null);
    }
  };

  return (
    <Panel
      width={width}
      className="relative rounded-xl bg-gray-900 border border-gray-700 shadow-2xl overflow-visible flex flex-col"
      onClose={onClose}
      closeLabel="Close lend panel"
      closeClassName="absolute z-10 text-gray-400 hover:text-gray-200 cursor-pointer"
      closeStyle={{
        top: '8px',
        right: '12px',
        fontSize: '20px',
        lineHeight: 1,
      }}
    >
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <span className="uppercase tracking-[0.3em] text-gray-400 text-xs">Lend (Jupiter · Solana)</span>
        <button
          type="button"
          onClick={() => void refresh()}
          className="text-xs text-gray-500 hover:text-gray-200 cursor-pointer"
          title="Refresh markets + positions"
        >
          {loading ? '…' : 'Refresh'}
        </button>
      </div>
      <div className="h-[1px] bg-gray-700 w-full" />

      {/* My positions */}
      <div className="px-4 py-2">
        <div className="text-[11px] uppercase tracking-[0.25em] text-gray-500 mb-1">My Positions</div>
        {positions.length === 0 ? (
          <div className="text-xs text-gray-500 italic py-1">No active lend positions yet.</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {positions.map((row) => {
              const symbol = row.token?.symbol ?? '—';
              const decimals = row.token?.decimals ?? 6;
              const principal = formatUnits(row.principalRaw, decimals);
              const live = row.underlyingAmountRaw
                ? formatUnits(row.underlyingAmountRaw, decimals)
                : null;
              const earnings = row.earningsRaw ? formatUnits(row.earningsRaw, decimals) : null;
              const apy = formatApy(row.apySnapshot);
              return (
                <div
                  key={row.LPID ?? `${symbol}-${row.vault ?? 'no-vault'}`}
                  className="flex items-center justify-between rounded-md border border-gray-700 bg-gray-800/40 px-2 py-1.5"
                >
                  <div className="min-w-0">
                    <div className="text-sm text-gray-100 font-medium">{symbol}</div>
                    <div className="text-[11px] text-gray-400 truncate">
                      {live ?? principal} {symbol}
                      {earnings && earnings !== '0' ? <span className="text-emerald-400"> · +{earnings}</span> : null}
                      <span className="text-gray-500"> · APY {apy}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleWithdrawAll(row)}
                    disabled={!isReady || submittingAction !== null}
                    className="rounded-md border border-gray-600 bg-gray-800 px-2 py-1 text-[11px] text-gray-100 hover:border-gray-400 hover:text-white disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {submittingAction === 'withdraw' ? '…' : 'Withdraw All'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="h-[1px] bg-gray-700 w-full" />

      {/* Markets */}
      <div className="px-4 py-2">
        <div className="text-[11px] uppercase tracking-[0.25em] text-gray-500 mb-1">Markets</div>
        {sortedMarkets.length === 0 && !loading ? (
          <div className="text-xs text-gray-500 italic py-1">No markets available.</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {sortedMarkets.slice(0, 8).map((market) => {
              const symbol = (market.symbol ?? '').toUpperCase();
              const isSelected = selectedSymbol === symbol;
              return (
                <div
                  key={market.asset ?? symbol}
                  className="flex flex-col rounded-md border border-gray-700 bg-gray-800/40 px-2 py-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-100 font-medium">{symbol || '—'}</div>
                      <div className="text-[11px] text-gray-400">APY {formatApy(market.apy)}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedSymbol(isSelected ? null : symbol)}
                      disabled={!isReady}
                      className="rounded-md border border-emerald-700 bg-emerald-900/60 px-2 py-1 text-[11px] text-emerald-100 hover:border-emerald-400 hover:bg-emerald-900 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                    >
                      {isSelected ? 'Close' : 'Deposit'}
                    </button>
                  </div>
                  {isSelected ? (
                    <div className="mt-1 flex items-center gap-1.5">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder={`Amount in ${symbol}`}
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        className="flex-1 rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-100 placeholder-gray-500 focus:border-gray-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => void handleDeposit(market)}
                        disabled={!isReady || submittingAction !== null || !depositAmount.trim()}
                        className="rounded-md border border-emerald-600 bg-emerald-700 px-2 py-1 text-[11px] text-white hover:bg-emerald-600 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                      >
                        {submittingAction === 'deposit' ? '…' : 'Submit'}
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {actionStatus ? (
        <div className="px-4 py-1 text-[11px] text-emerald-300 truncate" title={actionStatus}>
          {actionStatus}
        </div>
      ) : null}
      {actionError ? (
        <div className="px-4 py-1 text-[11px] text-red-400 break-words" title={actionError}>
          {actionError}
        </div>
      ) : null}
      {error ? (
        <div className="px-4 py-1 text-[11px] text-red-500 break-words" title={error}>
          {error}
        </div>
      ) : null}
      {!isReady ? (
        <div className="px-4 py-1 text-[11px] text-gray-500">Connect a Solana wallet to lend.</div>
      ) : null}
    </Panel>
  );
}
