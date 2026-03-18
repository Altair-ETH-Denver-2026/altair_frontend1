import type { ChainKey } from './blockchain_config';

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

