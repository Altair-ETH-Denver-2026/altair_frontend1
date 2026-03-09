export type RelayQuoteRequest = {
  user: string;
  originChainId: number;
  destinationChainId: number;
  originCurrency: string;
  destinationCurrency: string;
  amount: string;
  tradeType: 'EXACT_INPUT' | 'EXACT_OUTPUT' | 'EXPECTED_OUTPUT';
  recipient?: string;
  forceSolverExecution?: boolean;
  useDepositAddress?: boolean;
  useReceiver?: boolean;
  strict?: boolean;
  useExternalLiquidity?: boolean;
  useFallbacks?: boolean;
  includeComputeUnitLimit?: boolean;
  maxRouteLength?: number;
  useSharedAccounts?: boolean;
  overridePriceImpact?: boolean;
  disableOriginSwaps?: boolean;
};

export type RelayQuoteStepItem = {
  status?: string;
  data?: {
    from?: string;
    to?: string;
    data?: string;
    value?: string;
    chainId?: number;
    transaction?: string;
    recentBlockhash?: string;
    payer?: string;
    addressLookupTableAddresses?: string[];
    instructions?: Array<{
      programId: string;
      data: string;
      keys: Array<{
        pubkey: string;
        isSigner: boolean;
        isWritable: boolean;
      }>;
    }>;
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
