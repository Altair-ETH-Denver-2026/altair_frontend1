import type { ChainKey } from '../../config/blockchain_config';

export type ApiBalanceSource = 'cache' | 'mongo' | 'blockchain' | 'stale';

export type ApiTokenBalance = {
  symbol: string;
  name?: string;
  address?: string;
  decimals: number;
  balance: string;
  balanceRaw?: string;
  source?: ApiBalanceSource;
  verifiedAt?: number;
  isStale?: boolean; // NEW: indicates if this token balance is stale
  staleReason?: 'swap' | 'timer' | 'manual'; // NEW: why it became stale
  staleSince?: number; // NEW: timestamp when it became stale
  // USD price for this token, looked up from the `tokens` collection by the
  // backend balances API. `null` means a row exists but no price yet;
  // `undefined` means no lookup has been performed.
  price?: number | null;
};

export type ApiChainBalances = {
  tokens: Record<string, ApiTokenBalance>;
  address?: string;
  solanaAddress?: string;
  source?: ApiBalanceSource;
  verifiedAt?: number;
  timestamp?: number;
};

export type ApiBalancesResponse = {
  chain: ChainKey;
  tokens: Record<string, ApiTokenBalance>;
  address?: string;
  solanaAddress?: string;
  source: ApiBalanceSource;
  verifiedAt: number;
  timestamp: number;
};

