import type { ChainKey } from '../../config/blockchain_config';

// ==================== Balance Events ====================

export type BalanceStaleEventDetail = {
  chainKey: ChainKey;
  symbol: string;
  reason: 'swap' | 'timer' | 'manual';
  timestamp: number;
};

export type BalanceUpdatedEventDetail = {
  chainKey: ChainKey;
  symbol: string;
  balance: string;
  decimals: number;
  source: 'cache' | 'mongo' | 'blockchain' | 'stale';
  timestamp: number;
};

// ==================== Swap Events ====================

export type SwapInitiatedEventDetail = {
  sellToken: string;
  buyToken: string;
  sellChain: ChainKey;
  buyChain: ChainKey;
  amount: string;
  intentType: 'SINGLE_CHAIN_SWAP_INTENT' | 'CROSS_CHAIN_SWAP_INTENT' | 'BRIDGE_INTENT';
  timestamp: number;
};

export type SwapSubmittedEventDetail = {
  sellToken: string;
  buyToken: string;
  sellChain: ChainKey;
  buyChain: ChainKey;
  amount: string;
  txHash?: string;
  requestId?: string;
  timestamp: number;
};

export type SwapCompleteEventDetail = {
  sellToken: string;
  buyToken: string;
  sellChain: ChainKey;
  buyChain: ChainKey;
  amount: string;
  txHash?: string;
  requestId?: string;
  SID?: string;
  balanceUpdates?: Array<{
    chain: ChainKey;
    symbol: string;
    balanceAfterRaw: string | null;
    decimals: number;
  }>;
  timestamp: number;
};

// ==================== Event Dispatcher Utilities ====================

export const dispatchBalanceStale = (detail: BalanceStaleEventDetail): void => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('altair:balance-stale', { detail })
    );
  }
};

export const dispatchBalanceUpdated = (detail: BalanceUpdatedEventDetail): void => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('altair:balance-updated', { detail })
    );
  }
};

export const dispatchSwapInitiated = (detail: SwapInitiatedEventDetail): void => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('altair:swap-initiated', { detail })
    );
  }
};

export const dispatchSwapSubmitted = (detail: SwapSubmittedEventDetail): void => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('altair:swap-submitted', { detail })
    );
  }
};

export const dispatchSwapComplete = (detail: SwapCompleteEventDetail): void => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('altair:swap-complete', { detail })
    );
  }
};

// ==================== Event Type Guards ====================

export const isBalanceStaleEvent = (event: Event): event is CustomEvent<BalanceStaleEventDetail> => {
  return event.type === 'altair:balance-stale';
};

export const isBalanceUpdatedEvent = (event: Event): event is CustomEvent<BalanceUpdatedEventDetail> => {
  return event.type === 'altair:balance-updated';
};

export const isSwapInitiatedEvent = (event: Event): event is CustomEvent<SwapInitiatedEventDetail> => {
  return event.type === 'altair:swap-initiated';
};

export const isSwapSubmittedEvent = (event: Event): event is CustomEvent<SwapSubmittedEventDetail> => {
  return event.type === 'altair:swap-submitted';
};

export const isSwapCompleteEvent = (event: Event): event is CustomEvent<SwapCompleteEventDetail> => {
  return event.type === 'altair:swap-complete';
};