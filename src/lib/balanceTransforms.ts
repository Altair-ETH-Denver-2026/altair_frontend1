import type { ChainKey } from '../../config/blockchain_config';
import type { ApiBalancesResponse, ApiChainBalances } from '../../config/balance_types';

export const normalizeBalancesResponse = (params: {
  chainKey: ChainKey;
  payload: unknown;
  fallbackSolanaAddress?: string | null;
}): ApiChainBalances => {
  const { chainKey, payload, fallbackSolanaAddress } = params;
  const now = Date.now();
  const raw = (payload ?? {}) as Partial<ApiBalancesResponse>;

  if (raw.tokens && typeof raw.tokens === 'object') {
    return {
      tokens: raw.tokens,
      address: raw.address,
      solanaAddress: raw.solanaAddress ?? fallbackSolanaAddress ?? undefined,
      source: raw.source,
      verifiedAt: raw.verifiedAt,
      timestamp: raw.timestamp ?? now,
    };
  }

  return {
    tokens: {},
    address: raw.address,
    solanaAddress: raw.solanaAddress ?? (chainKey === 'SOLANA_MAINNET' ? fallbackSolanaAddress ?? undefined : undefined),
    source: raw.source,
    verifiedAt: raw.verifiedAt,
    timestamp: raw.timestamp ?? now,
  };
};

export const resolveTokenRowsForChain = (
  balancesByChain: Record<ChainKey, ApiChainBalances>,
  chainKey: ChainKey | 'ALL'
): string[] => {
  if (chainKey === 'ALL') {
    const allTokens = new Set<string>();
    Object.entries(balancesByChain).forEach(([chain, balances]) => {
      if (chain === 'ETH_SEPOLIA' || chain === 'BASE_SEPOLIA') return;
      Object.keys(balances.tokens ?? {}).forEach((token) => allTokens.add(token.toUpperCase()));
    });
    return Array.from(allTokens);
  }

  return Object.keys(balancesByChain[chainKey]?.tokens ?? {}).map((token) => token.toUpperCase());
};

