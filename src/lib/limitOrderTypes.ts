// Frontend types for Jupiter limit / scheduled orders.
//
// Mirrors INTENTS.LIMIT_ORDER_INTENTS from config/ai_config.ts. Today Solana-only;
// the optional `chain` field defaults to 'Solana' / 'SOLANA_MAINNET'.

export type ChatLimitOrderIntentType =
  | 'LIMIT_ORDER_PRICE_INTENT'
  | 'LIMIT_ORDER_TIME_INTENT';

export type ChatLimitOrderIntent = {
  type: ChatLimitOrderIntentType;
  side: 'SELL' | 'BUY';
  sell: string;
  buy: string;
  amount: string;
  /** Price-triggered orders only. */
  targetPrice?: string;
  /** Currency the price is quoted in. Default 'USDC'. */
  quoteCurrency?: string;
  /** Optional ISO expiry for price orders. */
  expiry?: string | null;
  /** Time-triggered orders only — ISO 8601. */
  runAt?: string;
  /** Defaults to 'Solana'. */
  chain?: string;
};

export const isLimitOrderIntent = (value: unknown): value is ChatLimitOrderIntent => {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  return o.type === 'LIMIT_ORDER_PRICE_INTENT' || o.type === 'LIMIT_ORDER_TIME_INTENT';
};

export type LimitOrderRow = {
  LOID?: string;
  UID?: string;
  walletAddress?: string;
  chain?: string;
  provider?: string;
  kind?: 'price' | 'time';
  side?: 'SELL' | 'BUY';
  sellToken?: {
    symbol?: string;
    contractAddress?: string;
    decimals?: number | null;
    amount?: string;
  };
  buyToken?: {
    symbol?: string;
    contractAddress?: string;
    decimals?: number | null;
    amount?: string;
  };
  trigger?: {
    targetPrice?: string | null;
    quoteCurrency?: string | null;
    runAt?: string | null;
    expiresAt?: string | null;
  };
  providerOrderId?: string | null;
  fillTxHash?: string | null;
  status?: 'pending' | 'filled' | 'cancelled' | 'failed';
  failureReason?: string | null;
  intentString?: string;
  updatedAt?: string;
  createdAt?: string;
};
