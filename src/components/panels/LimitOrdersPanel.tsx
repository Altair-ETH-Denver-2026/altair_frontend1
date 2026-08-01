'use client';

import React, { useState } from 'react';
import Panel from '../Panel';
import { useLimitOrders } from '../../lib/useLimitOrders';
import type { LimitOrderRow } from '../../lib/limitOrderTypes';

type LimitOrdersPanelProps = {
  width: number;
  onClose: () => void;
};

const formatUnits = (raw: string | null | undefined, decimals: number | null | undefined): string => {
  if (!raw) return '0';
  const d = typeof decimals === 'number' && decimals > 0 ? decimals : 0;
  try {
    const big = BigInt(raw);
    const divisor = 10n ** BigInt(d);
    const whole = big / divisor;
    const frac = big % divisor;
    if (d === 0) return whole.toString();
    const fracStr = frac.toString().padStart(d, '0').slice(0, 4).replace(/0+$/, '');
    return `${whole.toString()}${fracStr ? '.' + fracStr : ''}`;
  } catch {
    return raw;
  }
};

const formatTrigger = (order: LimitOrderRow): string => {
  if (order.kind === 'price' && order.trigger?.targetPrice) {
    const quote = order.trigger.quoteCurrency ?? 'USDC';
    const sym = order.sellToken?.symbol ?? '';
    return `@ ${order.trigger.targetPrice} ${quote}/${sym}`;
  }
  if (order.kind === 'time' && order.trigger?.runAt) {
    try {
      return `at ${new Date(order.trigger.runAt).toLocaleString()}`;
    } catch {
      return `at ${order.trigger.runAt}`;
    }
  }
  return '';
};

export default function LimitOrdersPanel({ width, onClose }: LimitOrdersPanelProps) {
  const { orders, loading, error, refresh, cancelOrder } = useLimitOrders({ enabled: true });
  const [cancellingLOID, setCancellingLOID] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const handleCancel = async (LOID: string) => {
    setCancellingLOID(LOID);
    setCancelError(null);
    try {
      await cancelOrder(LOID);
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : String(err));
    } finally {
      setCancellingLOID(null);
    }
  };

  return (
    <Panel
      width={width}
      className="relative rounded-xl bg-gray-900 border border-gray-700 shadow-2xl overflow-visible flex flex-col"
      onClose={onClose}
      closeLabel="Close limit orders panel"
      closeClassName="absolute z-10 text-gray-400 hover:text-gray-200 cursor-pointer"
      closeStyle={{
        top: '8px',
        right: '12px',
        fontSize: '20px',
        lineHeight: 1,
      }}
    >
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <span className="uppercase tracking-[0.3em] text-gray-400 text-xs">Limit Orders (Solana)</span>
        <button
          type="button"
          onClick={() => void refresh()}
          className="text-xs text-gray-500 hover:text-gray-200 cursor-pointer"
        >
          {loading ? '…' : 'Refresh'}
        </button>
      </div>
      <div className="h-[1px] bg-gray-700 w-full" />

      <div className="px-4 py-2">
        {orders.length === 0 ? (
          <div className="text-xs text-gray-500 italic py-1">
            No active orders. Place one in chat: e.g. <span className="text-gray-400">&quot;sell 100 BONK if price hits $0.00003&quot;</span>.
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {orders.map((order, index) => {
              const sellSym = order.sellToken?.symbol ?? '';
              const buySym = order.buyToken?.symbol ?? '';
              const sellAmt = formatUnits(order.sellToken?.amount, order.sellToken?.decimals ?? 0);
              const buyAmt = formatUnits(order.buyToken?.amount, order.buyToken?.decimals ?? 0);
              const trigger = formatTrigger(order);
              const isCancelling = cancellingLOID === order.LOID;
              const orderKey =
                (typeof order.LOID === 'string' && order.LOID) || `order-${index}`;
              return (
                <div
                  key={orderKey}
                  className="flex items-center justify-between rounded-md border border-gray-700 bg-gray-800/40 px-2 py-1.5"
                >
                  <div className="min-w-0">
                    <div className="text-sm text-gray-100 font-medium">
                      {order.side ?? '—'} {sellAmt} {sellSym}
                      <span className="text-gray-500"> → </span>
                      {order.kind === 'price' ? `${buyAmt} ${buySym}` : buySym}
                    </div>
                    <div className="text-[11px] text-gray-400">
                      {order.kind === 'price' ? 'Price trigger' : 'Time trigger'} {trigger}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCancel(order.LOID as string)}
                    disabled={!order.LOID || isCancelling}
                    className="rounded-md border border-gray-600 bg-gray-800 px-2 py-1 text-[11px] text-gray-100 hover:border-red-500 hover:text-red-200 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isCancelling ? '…' : 'Cancel'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {error ? (
        <div className="px-4 py-1 text-[11px] text-red-500 break-words" title={error}>
          {error}
        </div>
      ) : null}
      {cancelError ? (
        <div className="px-4 py-1 text-[11px] text-red-400 break-words" title={cancelError}>
          {cancelError}
        </div>
      ) : null}
    </Panel>
  );
}
