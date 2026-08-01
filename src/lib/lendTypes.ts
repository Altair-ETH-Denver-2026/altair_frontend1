'use client';

/**
 * Chat-level intent for Jupiter Lend Earn deposit / withdraw.
 * Emitted by the model when the user wants to lend or withdraw lent funds.
 *
 * Mirrors the shape produced by INTENTS.LEND_INTENTS in altair_backend1/config/ai_config.ts.
 */
export type ChatLendIntentType = 'LEND_DEPOSIT_INTENT' | 'LEND_WITHDRAW_INTENT';

export type ChatLendIntent = {
  type: ChatLendIntentType;
  token: string;            // symbol, e.g. 'USDC'
  amount: number | string;  // for withdraw, can be 'all'
  tokenChain?: string | null; // e.g. 'SOLANA_MAINNET'
  provider?: string | null;   // e.g. 'Jupiter'
};

export const isLendIntent = (value: unknown): value is ChatLendIntent => {
  if (!value || typeof value !== 'object') return false;
  const intent = value as Record<string, unknown>;
  if (intent.type !== 'LEND_DEPOSIT_INTENT' && intent.type !== 'LEND_WITHDRAW_INTENT') return false;
  if (typeof intent.token !== 'string' || !intent.token.trim()) return false;
  if (typeof intent.amount !== 'string' && typeof intent.amount !== 'number') return false;
  return true;
};

/** Lend market metadata used by the chat panel to display APY before/after confirm. */
export type LendMarket = {
  asset?: string;
  vault?: string;
  symbol?: string;
  decimals?: number;
  apy?: number | null;
  logoURI?: string | null;
};

/** User position from /api/lend-positions (Mongo) or /api/jupiter/lend/positions (live). */
export type LendPositionRow = {
  LPID?: string;
  provider?: string;
  chain?: string;
  vault?: string | null;
  walletAddress?: string;
  token?: {
    symbol?: string;
    contractAddress?: string;
    decimals?: number;
    balanceAfter?: string | null;
  };
  shares?: string;
  principalRaw?: string;
  lastEarningsRaw?: string;
  apySnapshot?: number | null;
  status?: 'active' | 'closed';
  lastSyncedAt?: string | null;
};
