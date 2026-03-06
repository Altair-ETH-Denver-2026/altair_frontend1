export type RelayQuoteRequest = {
  user: string;
  originChainId: number;
  destinationChainId: number;
  originCurrency: string;
  destinationCurrency: string;
  amount: string;
  tradeType: 'EXACT_INPUT' | 'EXACT_OUTPUT' | 'EXPECTED_OUTPUT';
  recipient?: string;
};

export type RelayQuoteStepItem = {
  status?: string;
  data?: {
    from?: string;
    to?: string;
    data?: string;
    value?: string;
    chainId?: number;
  };
  check?: {
    endpoint?: string;
    method?: string;
  };
  signatureKind?: string;
  message?: string;
};

export type RelayQuoteStep = {
  id: string;
  action?: string;
  description?: string;
  kind: 'transaction' | 'signature';
  requestId?: string;
  items: RelayQuoteStepItem[];
};

export type RelayQuoteResponse = {
  steps: RelayQuoteStep[];
  details?: Record<string, unknown>;
  fees?: Record<string, unknown>;
  protocol?: Record<string, unknown>;
};
