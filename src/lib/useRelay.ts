'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';
import { getCachedPrivyAccessToken } from './privyTokenCache';
import { withWaitLogger } from './waitLogger';
import type { RelayQuoteRequest, RelayQuoteResponse } from './relayTypes';
import { resolveRelayChainId, resolveRelayToken, toBaseUnits } from './relayMapping';
import { getBackendBaseUrl } from './backendUrl';

type RelayIntent = {
  type: 'CROSS_CHAIN_SWAP_INTENT' | 'BRIDGE_INTENT';
  sell: string;
  buy?: string;
  amount: string;
  sellTokenChain: string;
  buyTokenChain: string;
};

export const useRelay = () => {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { wallets: solanaWallets } = useSolanaWallets();

  return async (intent: RelayIntent) => {
    if (!authenticated || !wallets?.length) {
      throw new Error('No authenticated wallet available.');
    }

    const wallet = wallets[0];
    const evmAddress = wallet.address ?? null;
    if (!evmAddress) {
      throw new Error('Missing EVM wallet address for Relay execution.');
    }

    console.log('[Relay] intent chains', {
      sellTokenChain: intent.sellTokenChain,
      buyTokenChain: intent.buyTokenChain,
    });
    const originChainId = resolveRelayChainId(intent.sellTokenChain);
    const destinationChainId = resolveRelayChainId(intent.buyTokenChain);
    console.log('[Relay] resolved chain ids', {
      originChainId,
      destinationChainId,
    });
    if (!originChainId || !destinationChainId) {
      throw new Error('Unsupported chain for Relay execution.');
    }

    const originToken = resolveRelayToken(intent.sellTokenChain, intent.sell);
    console.log('[Relay] resolved origin token', {
      chain: intent.sellTokenChain,
      symbol: intent.sell,
      token: originToken ?? null,
    });
    if (!originToken) {
      throw new Error('Unsupported sell token for Relay execution.');
    }

    const buySymbol = intent.type === 'BRIDGE_INTENT' ? intent.sell : intent.buy;
    if (!buySymbol) {
      throw new Error('Missing buy token for Relay execution.');
    }
    const destinationToken = resolveRelayToken(intent.buyTokenChain, buySymbol);
    console.log('[Relay] resolved destination token', {
      chain: intent.buyTokenChain,
      symbol: buySymbol,
      token: destinationToken ?? null,
    });
    if (!destinationToken) {
      throw new Error('Unsupported buy token for Relay execution.');
    }

    const amountBase = toBaseUnits(intent.amount, originToken.decimals);
    console.log('[Relay] amount conversion', {
      amount: intent.amount,
      decimals: originToken.decimals,
      amountBase,
    });
    const isSolanaDestination = intent.buyTokenChain === 'SOLANA_MAINNET';
    let solanaRecipient = isSolanaDestination ? solanaWallets?.[0]?.address ?? null : null;
    if (isSolanaDestination && !solanaRecipient) {
      const cachedToken = getCachedPrivyAccessToken();
      const response = cachedToken
        ? await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: 'resolve solana address',
              history: [],
              accessToken: cachedToken,
              selectedChain: 'SOLANA_MAINNET',
              solanaAddress: null,
            }),
          }).catch(() => null)
        : null;
      if (response?.ok) {
        const payload = await response.json().catch(() => ({}));
        solanaRecipient = typeof payload?.solAddress === 'string' ? payload.solAddress : null;
      }
      if (!solanaRecipient) {
        throw new Error('Missing Solana wallet address for Relay destination. Connect a Solana wallet in Privy.');
      }
    }

    const originCurrency = originToken.address.toLowerCase();
    const destinationCurrency = isSolanaDestination
      ? destinationToken.address
      : destinationToken.address.toLowerCase();
    const relayRequest: RelayQuoteRequest = {
      user: evmAddress,
      originChainId,
      destinationChainId,
      originCurrency,
      destinationCurrency,
      amount: amountBase,
      tradeType: 'EXACT_INPUT',
      recipient: isSolanaDestination && solanaRecipient ? solanaRecipient : evmAddress,
    };
    console.log('[Relay] quote request', relayRequest);

    const backendBaseUrl = getBackendBaseUrl();
    const relayQuote = await withWaitLogger(
      {
        file: 'altair_frontend1/src/lib/useRelay.ts',
        target: '/api/relay/quote',
        description: 'Relay quote request',
      },
      async () => {
        const res = await fetch(`${backendBaseUrl}/api/relay/quote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(relayRequest),
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Relay quote failed: ${errText}`);
        }
        return (await res.json()) as RelayQuoteResponse;
      }
    );

    let requestId: string | null = null;
    for (const step of relayQuote.steps) {
      if (!requestId && step.requestId) requestId = step.requestId;
      for (const item of step.items) {
        if (item?.check?.endpoint && !requestId) {
          const match = item.check.endpoint.match(/requestId=([^&]+)/i);
          if (match?.[1]) requestId = match[1];
        }
      }
    }

    for (const step of relayQuote.steps) {
      if (step.kind !== 'transaction') {
        throw new Error(`Unsupported Relay step kind: ${step.kind}`);
      }
      const item = step.items[0];
      const data = item?.data;
      if (!data?.to || !data?.data || data?.value === undefined || !data?.chainId) {
        throw new Error('Relay step missing transaction data.');
      }

      const ethereumProvider = await wallet.getEthereumProvider();
      await withWaitLogger(
        {
          file: 'altair_frontend1/src/lib/useRelay.ts',
          target: 'eth_sendTransaction',
          description: 'Relay deposit transaction',
        },
        () =>
          ethereumProvider.request?.({
            method: 'eth_sendTransaction',
            params: [
              {
                from: data.from ?? evmAddress,
                to: data.to,
                data: data.data,
                value: data.value,
                chainId: `0x${Number(data.chainId).toString(16)}`,
              },
            ],
          })
      );
    }

    return {
      requestId: requestId ?? null,
    };
  };
};
