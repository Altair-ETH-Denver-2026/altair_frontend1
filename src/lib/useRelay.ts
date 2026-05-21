'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets, useSignAndSendTransaction } from '@privy-io/react-auth/solana';
import {
  AddressLookupTableAccount,
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';
import { getCachedPrivyAccessToken } from './privyTokenCache';
import { withWaitLogger } from './waitLogger';
import type { RelayQuoteRequest, RelayQuoteResponse } from './relayTypes';
import { resolveRelayChainId, resolveRelayToken, toBaseUnits } from './relayMapping';
import { getBackendBaseUrl } from './backendUrl';
import { readCachedTokenSnapshot } from './useSwap';
import { dispatchSwapSubmitted, dispatchBalanceStale } from './eventTypes';

type RelayIntent = {
  type: 'CROSS_CHAIN_SWAP_INTENT' | 'BRIDGE_INTENT';
  sell: string;
  buy?: string;
  amount: string;
  sellTokenChain: string;
  buyTokenChain: string;
};

export const useRelay = () => {
  const { authenticated, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const { wallets: solanaWallets } = useSolanaWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();

  const normalizeBalanceChainKey = (input: string): string => {
    const raw = input.trim();
    if (!raw) return input;
    const upper = raw.toUpperCase();
    if (
      upper === 'BASE_MAINNET' ||
      upper === 'BASE_SEPOLIA' ||
      upper === 'ETH_MAINNET' ||
      upper === 'ETH_SEPOLIA' ||
      upper === 'SOLANA_MAINNET'
    ) {
      return upper;
    }

    const normalized = raw.toLowerCase().replace(/[\s_-]+/g, '');
    if (normalized === 'base' || normalized === 'basemainnet') return 'BASE_MAINNET';
    if (normalized === 'basesepolia' || normalized === 'basesepoliatestnet') return 'BASE_SEPOLIA';
    if (normalized === 'ethereum' || normalized === 'eth' || normalized === 'ethmainnet' || normalized === 'ethereummainnet') {
      return 'ETH_MAINNET';
    }
    if (normalized === 'ethsepolia' || normalized === 'sepolia' || normalized === 'ethereumsepolia' || normalized === 'ethereumsepoliatestnet') {
      return 'ETH_SEPOLIA';
    }
    if (normalized === 'solana' || normalized === 'solanamainnet') return 'SOLANA_MAINNET';
    return upper;
  };

  const coerceAmountToRaw = (value: unknown, decimals: number): string | null => {
    const toRawFromString = (input: string): string | null => {
      const trimmed = input.trim();
      if (!trimmed) return null;
      if (/^\d+$/.test(trimmed)) return trimmed;
      if (/^\d+\.\d+$/.test(trimmed)) return toBaseUnits(trimmed, decimals);
      return null;
    };

    if (typeof value === 'string') {
      return toRawFromString(value);
    }

    if (typeof value === 'number') {
      if (!Number.isFinite(value) || value < 0) return null;
      return toBaseUnits(value.toString(), decimals);
    }

    if (!value || typeof value !== 'object') return null;
    const record = value as Record<string, unknown>;
    const candidateKeys = [
      'raw',
      'amountRaw',
      'value',
      'amount',
      'exactAmount',
      'toAmount',
      'buyAmount',
      'amountOut',
      'outputAmount',
      'destinationAmount',
      'expectedOutput',
      'expectedOutputAmount',
    ];

    for (const key of candidateKeys) {
      const raw = coerceAmountToRaw(record[key], decimals);
      if (raw !== null) return raw;
    }

    return null;
  };

  const extractRelayQuotedBuyAmountRaw = (params: {
    relayQuote: RelayQuoteResponse;
    destinationDecimals: number;
  }): string | null => {
    const { relayQuote, destinationDecimals } = params;

    const readFromKnownPaths = (): string | null => {
      const details = relayQuote.details as Record<string, unknown> | undefined;
      const protocol = relayQuote.protocol as Record<string, unknown> | undefined;
      const candidates: unknown[] = [
        details?.currencyOut,
        details?.destinationCurrency,
        details?.destinationAmount,
        details?.amountOut,
        details?.toAmount,
        details?.buyAmount,
        protocol?.currencyOut,
        protocol?.destinationCurrency,
        protocol?.destinationAmount,
        protocol?.amountOut,
        protocol?.toAmount,
        protocol?.buyAmount,
      ];
      for (const candidate of candidates) {
        const raw = coerceAmountToRaw(candidate, destinationDecimals);
        if (raw !== null) return raw;
      }
      return null;
    };

    const known = readFromKnownPaths();
    if (known) return known;

    const seen = new WeakSet<object>();
    const amountLikeKey = /^(amount|amountOut|buyAmount|toAmount|destinationAmount|outputAmount|expectedOutput|expectedOutputAmount|currencyOut|receiveAmount|receivedAmount)$/i;

    const walk = (node: unknown, depth: number): string | null => {
      if (depth > 6) return null;
      if (!node || typeof node !== 'object') return null;
      if (seen.has(node as object)) return null;
      seen.add(node as object);

      if (Array.isArray(node)) {
        for (const item of node) {
          const found = walk(item, depth + 1);
          if (found) return found;
        }
        return null;
      }

      const record = node as Record<string, unknown>;

      for (const [key, value] of Object.entries(record)) {
        if (!amountLikeKey.test(key)) continue;
        const candidate = coerceAmountToRaw(value, destinationDecimals);
        if (candidate !== null) return candidate;
      }

      for (const value of Object.values(record)) {
        const found = walk(value, depth + 1);
        if (found) return found;
      }

      return null;
    };

    return walk(relayQuote, 0);
  };

  const buildJupiterError = (err: unknown, logs?: string[] | null) => {
    const serialized = err ? JSON.stringify(err) : '';
    const hasJupiterLog = logs?.some((line) => line.includes('JUP6LkbZ') || line.includes('Jupiter'));
    if (!hasJupiterLog && !serialized.includes('0x1788') && !serialized.includes('6024')) return null;
    return new Error(
      'Relay Solana route failed inside Jupiter (program error 0x1788). This usually means the Solana swap route is unavailable for the requested amount/token. Try a different amount/token or wait for liquidity to improve.'
    );
  };

  const ensureEvmChainForTx = async (params: {
    ethereumProvider: { request?: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
    chainId: number;
  }) => {
    const { ethereumProvider, chainId } = params;
    if (!Number.isFinite(chainId) || chainId <= 0) return;
    const targetHex = `0x${Number(chainId).toString(16)}`;
    try {
      await ethereumProvider.request?.({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: targetHex }],
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to switch wallet network to chainId ${chainId} before Relay tx: ${message}`);
    }
  };

  const waitForEvmTransactionReceipt = async (params: {
    ethereumProvider: { request?: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
    txHash: string;
    timeoutMs?: number;
    pollMs?: number;
    confirmations?: number;
  }) => {
    const { ethereumProvider, txHash, timeoutMs = 180_000, pollMs = 1_250, confirmations = 2 } = params;
    const startedAt = Date.now();

    console.log('[Relay] Waiting for EVM transaction receipt', {
      txHash,
      confirmations,
      timeoutMs,
      pollMs,
    });

    // First, wait for the transaction to be mined
    let receipt: { status?: string; gasUsed?: string; effectiveGasPrice?: string; gasPrice?: string; blockNumber?: string } | null | undefined;
    while (Date.now() - startedAt < timeoutMs) {
      receipt = (await ethereumProvider.request?.({
        method: 'eth_getTransactionReceipt',
        params: [txHash],
      })) as { status?: string; gasUsed?: string; effectiveGasPrice?: string; gasPrice?: string; blockNumber?: string } | null | undefined;

      if (receipt) {
        const status = typeof receipt.status === 'string' ? receipt.status.toLowerCase() : null;
        if (status === '0x1') {
          console.log('[Relay] Transaction mined', {
            txHash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed,
            effectiveGasPrice: receipt.effectiveGasPrice,
          });
          break;
        }
        if (status === '0x0') {
          throw new Error(`Relay EVM transaction reverted on-chain: ${txHash}`);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }

    if (!receipt) {
      throw new Error(`Timed out waiting for Relay EVM transaction confirmation: ${txHash}`);
    }

    // Wait for additional confirmations to ensure receipt is finalized
    if (confirmations > 1) {
      const txBlockNumber = parseHexToBigInt(receipt.blockNumber);
      if (txBlockNumber !== null) {
        console.log('[Relay] Waiting for confirmations', {
          txHash,
          txBlockNumber: txBlockNumber.toString(),
          confirmationsNeeded: confirmations,
        });

        while (Date.now() - startedAt < timeoutMs) {
          const currentBlockHex = (await ethereumProvider.request?.({
            method: 'eth_blockNumber',
            params: [],
          })) as string | undefined;
          
          const currentBlock = parseHexToBigInt(currentBlockHex);
          if (currentBlock !== null) {
            const confirmationCount = currentBlock - txBlockNumber + 1n;
            console.log('[Relay] Confirmation progress', {
              txHash,
              currentBlock: currentBlock.toString(),
              confirmationCount: confirmationCount.toString(),
              confirmationsNeeded: confirmations,
            });

            if (confirmationCount >= BigInt(confirmations)) {
              // Fetch receipt again after confirmations to get final gas values
              const finalReceipt = (await ethereumProvider.request?.({
                method: 'eth_getTransactionReceipt',
                params: [txHash],
              })) as { status?: string; gasUsed?: string; effectiveGasPrice?: string; gasPrice?: string; blockNumber?: string } | null | undefined;

              if (finalReceipt) {
                console.log('[Relay] Final receipt after confirmations', {
                  txHash,
                  confirmationCount: confirmationCount.toString(),
                  gasUsed: finalReceipt.gasUsed,
                  effectiveGasPrice: finalReceipt.effectiveGasPrice,
                });
                return finalReceipt;
              }
            }
          }

          await new Promise((resolve) => setTimeout(resolve, pollMs));
        }
      }
    }

    return receipt;
  };

  const isRetryableRelayEvmError = (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    const normalized = message.toLowerCase();
    return (
      normalized.includes('estimategasexecutionerror') ||
      normalized.includes('execution reverted') ||
      normalized.includes('reverted for an unknown reason')
    );
  };

  const isTransientRelayEvmTransportError = (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    const normalized = message.toLowerCase();
    return (
      normalized.includes('timeout') ||
      normalized.includes('timed out') ||
      normalized.includes('network error') ||
      normalized.includes('failed to fetch') ||
      normalized.includes('429') ||
      normalized.includes('too many requests') ||
      normalized.includes('gateway timeout') ||
      normalized.includes('temporarily unavailable') ||
      normalized.includes('internal json-rpc error')
    );
  };

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const randomJitter = (max = 250) => Math.floor(Math.random() * Math.max(1, max));

  const parseHexToBigInt = (value: unknown): bigint | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      return BigInt(trimmed);
    } catch {
      return null;
    }
  };

  const resolveEvmGasCostFromReceipt = (receipt: { gasUsed?: string; effectiveGasPrice?: string; gasPrice?: string } | null | undefined): bigint | null => {
    if (!receipt) {
      console.warn('[Relay] resolveEvmGasCostFromReceipt: receipt is null/undefined');
      return null;
    }
    
    const gasUsed = parseHexToBigInt(receipt.gasUsed);
    const effectiveGasPrice = parseHexToBigInt(receipt.effectiveGasPrice);
    const gasPrice = parseHexToBigInt(receipt.gasPrice);
    
    // Log all gas-related fields from receipt
    console.log('[Relay] Gas cost calculation from receipt', {
      gasUsed: receipt.gasUsed,
      gasUsedBigInt: gasUsed?.toString(),
      effectiveGasPrice: receipt.effectiveGasPrice,
      effectiveGasPriceBigInt: effectiveGasPrice?.toString(),
      gasPrice: receipt.gasPrice,
      gasPriceBigInt: gasPrice?.toString(),
    });
    
    if (gasUsed === null) {
      console.warn('[Relay] resolveEvmGasCostFromReceipt: gasUsed is null');
      return null;
    }
    
    // Prefer effectiveGasPrice (actual price paid) over gasPrice (estimated)
    const priceToUse = effectiveGasPrice ?? gasPrice;
    if (priceToUse === null) {
      console.warn('[Relay] resolveEvmGasCostFromReceipt: both effectiveGasPrice and gasPrice are null');
      return null;
    }
    
    // Warn if we're using gasPrice instead of effectiveGasPrice
    if (effectiveGasPrice === null && gasPrice !== null) {
      console.warn('[Relay] resolveEvmGasCostFromReceipt: effectiveGasPrice not available, using gasPrice (may be inaccurate)');
    }
    
    const gasCost = gasUsed * priceToUse;
    console.log('[Relay] Computed gas cost', {
      gasUsed: gasUsed.toString(),
      priceUsed: priceToUse.toString(),
      usingEffectivePrice: effectiveGasPrice !== null,
      gasCostWei: gasCost.toString(),
      gasCostEth: (Number(gasCost) / 1e18).toFixed(18),
    });
    
    return gasCost;
  };

  const waitForSolanaTransactionFeeLamports = async (params: {
    connection: Connection;
    signature: string;
    timeoutMs?: number;
    pollMs?: number;
  }): Promise<bigint | null> => {
    const { connection, signature, timeoutMs = 90_000, pollMs = 1_250 } = params;
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const tx = await connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });

      if (tx?.meta) {
        const feeLamports = tx.meta.fee;
        if (typeof feeLamports === 'number' && Number.isFinite(feeLamports) && feeLamports >= 0) {
          return BigInt(Math.trunc(feeLamports));
        }
        return null;
      }

      await wait(pollMs);
    }

    return null;
  };

  const resolveNativeGasTokenMeta = (chainId: number): { symbol: string; decimals: number } | null => {
    if (chainId === 792703809) return { symbol: 'SOL', decimals: 9 };
    return { symbol: 'ETH', decimals: 18 };
  };

  const previewHex = (value: string | undefined, keep = 18) => {
    if (!value) return null;
    if (value.length <= keep * 2) return value;
    return `${value.slice(0, keep)}...${value.slice(-keep)}`;
  };

  const diagnoseRelayEvmFailure = async (params: {
    ethereumProvider: { request?: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
    stepId: string;
    chainId: number;
    tx: { from?: string; to: string; data: string; value: string };
    attempt: number;
    quoteAttempt: number;
    err: unknown;
  }) => {
    const { ethereumProvider, stepId, chainId, tx, attempt, quoteAttempt, err } = params;
    const message = err instanceof Error ? err.message : String(err);

    const diagnostics: Record<string, unknown> = {
      stepId,
      chainId,
      attempt,
      quoteAttempt,
      error: message,
      txPreview: {
        from: tx.from ?? null,
        to: tx.to,
        value: tx.value,
        data: previewHex(tx.data),
      },
    };

    try {
      diagnostics.walletChainId = await ethereumProvider.request?.({ method: 'eth_chainId' });
    } catch (chainErr) {
      diagnostics.walletChainIdError = chainErr instanceof Error ? chainErr.message : String(chainErr);
    }

    try {
      diagnostics.pendingNonce = await ethereumProvider.request?.({
        method: 'eth_getTransactionCount',
        params: [tx.from, 'pending'],
      });
    } catch (nonceErr) {
      diagnostics.pendingNonceError = nonceErr instanceof Error ? nonceErr.message : String(nonceErr);
    }

    try {
      diagnostics.estimateGas = await ethereumProvider.request?.({
        method: 'eth_estimateGas',
        params: [{ from: tx.from, to: tx.to, data: tx.data, value: tx.value }],
      });
    } catch (estimateErr) {
      diagnostics.estimateGasError = estimateErr instanceof Error ? estimateErr.message : String(estimateErr);
    }

    try {
      diagnostics.callResult = await ethereumProvider.request?.({
        method: 'eth_call',
        params: [{ from: tx.from, to: tx.to, data: tx.data, value: tx.value }, 'latest'],
      });
    } catch (callErr) {
      diagnostics.callError = callErr instanceof Error ? callErr.message : String(callErr);
    }

    console.warn('[Relay] EVM failure diagnostics', diagnostics);
  };

  const runRelayEvmPreflight = async (params: {
    ethereumProvider: { request?: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
    chainId: number;
    tx: { from?: string | null; to: string; data: string; value: string };
  }): Promise<{ ok: true } | { ok: false; retryableQuote: boolean; reason: string }> => {
    const { ethereumProvider, chainId, tx } = params;

    const walletChainIdRaw = await ethereumProvider.request?.({ method: 'eth_chainId' });
    const walletChainId = typeof walletChainIdRaw === 'string' ? Number.parseInt(walletChainIdRaw, 16) : Number.NaN;
    if (!Number.isFinite(walletChainId) || walletChainId <= 0 || walletChainId !== chainId) {
      return {
        ok: false,
        retryableQuote: false,
        reason: `Wallet is on chain ${String(walletChainIdRaw)} but Relay step requires chainId ${chainId}.`,
      };
    }

    if (tx.from) {
      const [latestNonce, pendingNonce] = await Promise.all([
        ethereumProvider.request?.({ method: 'eth_getTransactionCount', params: [tx.from, 'latest'] }),
        ethereumProvider.request?.({ method: 'eth_getTransactionCount', params: [tx.from, 'pending'] }),
      ]);
      console.log('[Relay] EVM preflight nonce snapshot', {
        chainId,
        from: tx.from,
        latestNonce,
        pendingNonce,
      });
    }

    try {
      await ethereumProvider.request?.({
        method: 'eth_estimateGas',
        params: [{ from: tx.from, to: tx.to, data: tx.data, value: tx.value }],
      });
    } catch (estimateErr) {
      const reason = estimateErr instanceof Error ? estimateErr.message : String(estimateErr);
      return {
        ok: false,
        retryableQuote: isRetryableRelayEvmError(estimateErr),
        reason: `Relay preflight estimateGas failed: ${reason}`,
      };
    }

    try {
      await ethereumProvider.request?.({
        method: 'eth_call',
        params: [{ from: tx.from, to: tx.to, data: tx.data, value: tx.value }, 'latest'],
      });
    } catch (callErr) {
      const reason = callErr instanceof Error ? callErr.message : String(callErr);
      return {
        ok: false,
        retryableQuote: isRetryableRelayEvmError(callErr),
        reason: `Relay preflight eth_call failed: ${reason}`,
      };
    }

    return { ok: true };
  };

  return async (intent: RelayIntent, cid?: string | null) => {
    if (!authenticated || !wallets?.length) {
      throw new Error('No authenticated wallet available.');
    }

    const wallet = wallets[0];
    const evmAddress = wallet.address ?? null;

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
    const isSolanaOrigin = originChainId === 792703809;
    const isSolanaDestination = destinationChainId === 792703809;
    const solanaRecipient = isSolanaDestination ? solanaWallets?.[0]?.address ?? null : null;
    const solanaUser = isSolanaOrigin ? solanaWallets?.[0]?.address ?? null : null;
    if ((isSolanaDestination && !solanaRecipient) || (isSolanaOrigin && !solanaUser)) {
      throw new Error('Missing Solana wallet address for Relay. Connect a Solana wallet in Privy.');
    }

    if (!isSolanaOrigin && !evmAddress) {
      throw new Error('Missing EVM wallet address for Relay execution.');
    }

    const originCurrency = isSolanaOrigin
      ? originToken.address
      : originToken.address.toLowerCase();
    const destinationCurrency = isSolanaDestination
      ? destinationToken.address
      : destinationToken.address.toLowerCase();
    const backendBaseUrl = getBackendBaseUrl();
    const cachedToken = await getCachedPrivyAccessToken(getAccessToken).catch(() => null);
    const sellWalletAddress = isSolanaOrigin ? solanaUser ?? null : evmAddress ?? null;
    const buyWalletAddress = isSolanaDestination ? solanaRecipient ?? null : evmAddress ?? null;
    const sellChainKey = normalizeBalanceChainKey(intent.sellTokenChain);
    const buyChainKey = normalizeBalanceChainKey(intent.buyTokenChain);
    const sellSnapshot = readCachedTokenSnapshot({
      chainKey: sellChainKey as 'BASE_MAINNET' | 'BASE_SEPOLIA' | 'ETH_MAINNET' | 'ETH_SEPOLIA' | 'SOLANA_MAINNET' | 'SOLANA_DEVNET',
      walletAddress: sellWalletAddress,
      symbol: originToken.symbol ?? intent.sell,
    });
    const buySnapshot = readCachedTokenSnapshot({
      chainKey: buyChainKey as 'BASE_MAINNET' | 'BASE_SEPOLIA' | 'ETH_MAINNET' | 'ETH_SEPOLIA' | 'SOLANA_MAINNET' | 'SOLANA_DEVNET',
      walletAddress: buyWalletAddress,
      symbol: destinationToken.symbol ?? buySymbol,
    });
    const gasTokenMeta = resolveNativeGasTokenMeta(originChainId);
    const gasSymbol = gasTokenMeta?.symbol ?? (isSolanaOrigin ? 'SOL' : 'ETH');
    const gasSnapshot = readCachedTokenSnapshot({
      chainKey: sellChainKey as 'BASE_MAINNET' | 'BASE_SEPOLIA' | 'ETH_MAINNET' | 'ETH_SEPOLIA' | 'SOLANA_MAINNET' | 'SOLANA_DEVNET',
      walletAddress: sellWalletAddress,
      symbol: gasSymbol,
    });
    const sellBalanceBeforeRaw = sellSnapshot.raw;
    const buyBalanceBeforeRaw = buySnapshot.raw;
    const gasBalanceBeforeRaw = gasSnapshot.raw;

    const relayRequest: RelayQuoteRequest = {
      user: isSolanaOrigin ? solanaUser ?? '' : evmAddress ?? '',
      originChainId,
      destinationChainId,
      originCurrency,
      destinationCurrency,
      amount: amountBase,
      tradeType: 'EXACT_INPUT',
      recipient: isSolanaDestination && solanaRecipient ? solanaRecipient : evmAddress ?? '',
      forceSolverExecution: true,
      useReceiver: true,
      useDepositAddress: false,
      strict: false,
      useExternalLiquidity: true,
      useFallbacks: true,
      ...(isSolanaOrigin
        ? {
            includeComputeUnitLimit: true,
            maxRouteLength: 3,
            useSharedAccounts: true,
            overridePriceImpact: true,
            disableOriginSwaps: false,
          }
        : {}),
    };
    console.log('[Relay] quote request', relayRequest);

    const maxQuoteAttempts = 3;
    const maxQuoteAgeMs = 12_000;
    let requestId: string | null = null;
    let relayQuote: RelayQuoteResponse | null = null;
    let quoteReceivedAtMs = 0;
    let totalRelayGasPaidRaw = 0n;
    let altairFeeMeta: { token: string; amount: string | null; decimals: number | null; bps: number } | null = null;

    for (let quoteAttempt = 1; quoteAttempt <= maxQuoteAttempts; quoteAttempt += 1) {
      relayQuote = await withWaitLogger(
        {
          file: 'altair_frontend1/src/lib/useRelay.ts',
          target: '/api/relay/quote',
          description: quoteAttempt === 1 ? 'Relay quote request' : 'Relay quote refresh request',
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
      quoteReceivedAtMs = Date.now();

      // Extract _altairFee metadata from the quote response
      altairFeeMeta = relayQuote?._altairFee ?? null;

      requestId = null;
      for (const step of relayQuote.steps) {
        if (!requestId && step.requestId) requestId = step.requestId;
        for (const item of step.items) {
          if (item?.check?.endpoint && !requestId) {
            const match = item.check.endpoint.match(/requestId=([^&]+)/i);
            if (match?.[1]) requestId = match[1];
          }
        }
      }

      console.log('[Relay] quote metadata', {
        quoteAttempt,
        maxQuoteAttempts,
        requestId,
        quoteReceivedAtMs,
        stepCount: relayQuote.steps.length,
      });

      let shouldRetryWithFreshQuote = false;

      for (const step of relayQuote.steps) {
        if (step.kind === 'signature') {
          throw new Error('Relay returned a signature step; signing is not implemented for Solana execution.');
        }
        if (step.kind !== 'transaction') {
          throw new Error(`Unsupported Relay step kind: ${step.kind}`);
        }
        for (const item of step.items) {
        const data = item?.data;
        console.log('[Relay] step payload', {
          id: step.id,
          kind: step.kind,
          action: step.action,
          description: step.description,
          data,
        });

        const hasSolanaPayload = Boolean(
          data?.transaction ||
            (Array.isArray(data?.instructions) && data?.instructions.length > 0) ||
            (Array.isArray(data?.addressLookupTableAddresses) && data?.addressLookupTableAddresses.length > 0)
        );
        const isSolanaStep = data?.chainId
          ? String(data.chainId) === '792703809'
          : hasSolanaPayload;

        if (isSolanaStep) {
          if (!solanaUser) {
            throw new Error('Missing Solana wallet address for Relay Solana transaction.');
          }
          const solanaWallet = solanaWallets?.[0];
          if (!solanaWallet) {
            throw new Error('Missing Solana wallet for Relay Solana transaction.');
          }
          const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
          const connection = new Connection(rpcUrl && rpcUrl.trim() ? rpcUrl.trim() : 'https://api.mainnet-beta.solana.com', 'confirmed');
          if (typeof data?.transaction === 'string' && data.transaction.length > 0) {
            const txBuffer = Buffer.from(data.transaction, 'base64');
            const versionedTx = VersionedTransaction.deserialize(txBuffer);
            const serialized = versionedTx.serialize();
            try {
              const sim = await withWaitLogger(
                {
                  file: 'altair_frontend1/src/lib/useRelay.ts',
                  target: 'Solana simulateTransaction',
                  description: 'Relay Solana simulation (base64 tx)'
                },
                () => connection.simulateTransaction(versionedTx, { sigVerify: false, replaceRecentBlockhash: true })
              );
              if (sim?.value?.err) {
                console.warn('[Relay] Solana simulation error', sim.value.err, sim.value.logs ?? []);
                const jupiterError = buildJupiterError(sim.value.err, sim.value.logs);
                if (jupiterError) throw jupiterError;
              }
            } catch (err) {
              console.warn('[Relay] Solana simulation failed', err);
            }

            const { signature } = await withWaitLogger(
              {
                file: 'altair_frontend1/src/lib/useRelay.ts',
                target: 'Privy signAndSendTransaction',
                description: 'Relay Solana transaction signing and submission',
              },
              () =>
                signAndSendTransaction({
                  transaction: serialized,
                  wallet: solanaWallet,
                  chain: 'solana:mainnet',
                })
            );
            const txHash = typeof signature === 'string' ? signature : bs58.encode(signature);
            console.log('[Relay] Solana transaction signature', txHash);
            
            // Dispatch swap-submitted event for relay transaction
            const sellChainKey = normalizeBalanceChainKey(intent.sellTokenChain) as 'BASE_MAINNET' | 'BASE_SEPOLIA' | 'ETH_MAINNET' | 'ETH_SEPOLIA' | 'SOLANA_MAINNET' | 'SOLANA_DEVNET';
            const buyChainKey = normalizeBalanceChainKey(intent.buyTokenChain) as 'BASE_MAINNET' | 'BASE_SEPOLIA' | 'ETH_MAINNET' | 'ETH_SEPOLIA' | 'SOLANA_MAINNET' | 'SOLANA_DEVNET';
            
            dispatchSwapSubmitted({
              sellToken: intent.sell?.toUpperCase() || '',
              buyToken: intent.type === 'BRIDGE_INTENT' ? intent.sell?.toUpperCase() || '' : intent.buy?.toUpperCase() || '',
              sellChain: sellChainKey,
              buyChain: buyChainKey,
              amount: intent.amount,
              txHash,
              timestamp: Date.now(),
            });
            
            // Mark involved tokens as stale due to swap initiation
            const now = Date.now();
            const tokensToMarkStale = new Set([
              intent.sell?.toUpperCase(),
              intent.type === 'BRIDGE_INTENT' ? intent.sell?.toUpperCase() : intent.buy?.toUpperCase(),
            ]);
            tokensToMarkStale.forEach((symbol) => {
              if (symbol) {
                dispatchBalanceStale({
                  chainKey: sellChainKey,
                  symbol,
                  reason: 'swap',
                  timestamp: now,
                });
                // Also mark on destination chain for cross-chain swaps
                if (intent.type === 'CROSS_CHAIN_SWAP_INTENT' || intent.type === 'BRIDGE_INTENT') {
                  dispatchBalanceStale({
                    chainKey: buyChainKey,
                    symbol,
                    reason: 'swap',
                    timestamp: now,
                  });
                }
              }
            });
            try {
              const feeLamports = await withWaitLogger(
                {
                  file: 'altair_frontend1/src/lib/useRelay.ts',
                  target: 'Solana getTransaction',
                  description: 'Relay Solana transaction fee lookup',
                },
                () =>
                  waitForSolanaTransactionFeeLamports({
                    connection,
                    signature: txHash,
                  })
              );
              if (feeLamports !== null && feeLamports > 0n) {
                totalRelayGasPaidRaw += feeLamports;
              }
            } catch (feeErr) {
              console.warn('[Relay] Solana fee lookup failed', feeErr);
            }
            continue;
          }

          const instructions = data?.instructions ?? [];
          if (!instructions.length) {
            console.warn('[Relay] Missing Solana tx data for step', step);
            throw new Error('Relay step missing transaction data.');
          }
          const payer = new PublicKey(data?.payer ?? solanaUser);
          const tx = new Transaction();
          tx.feePayer = payer;
          if (data?.recentBlockhash) {
            tx.recentBlockhash = data.recentBlockhash;
          } else {
            const latest = await withWaitLogger(
              {
                file: 'altair_frontend1/src/lib/useRelay.ts',
                target: 'Solana getLatestBlockhash',
                description: 'Relay Solana blockhash',
              },
              () => connection.getLatestBlockhash('confirmed')
            );
            tx.recentBlockhash = latest.blockhash;
          }
          instructions.forEach((ix) => {
            const keys = ix.keys.map((key) => ({
              pubkey: new PublicKey(key.pubkey),
              isSigner: key.isSigner,
              isWritable: key.isWritable,
            }));
            tx.add(
              new TransactionInstruction({
                programId: new PublicKey(ix.programId),
                data: Buffer.from(ix.data, 'hex'),
                keys,
              })
            );
          });

          const lutAddresses = data?.addressLookupTableAddresses ?? [];
          if (lutAddresses.length > 0) {
            const lookupTables = await withWaitLogger(
              {
                file: 'altair_frontend1/src/lib/useRelay.ts',
                target: 'Solana getAddressLookupTable',
                description: 'Relay Solana lookup tables',
              },
              () =>
                Promise.all(
                  lutAddresses.map(async (address) => {
                    const res = await connection.getAddressLookupTable(new PublicKey(address));
                    return res.value;
                  })
                )
            );
            const compiled = new TransactionMessage({
              payerKey: tx.feePayer ?? payer,
              recentBlockhash: tx.recentBlockhash ?? '',
              instructions: tx.instructions,
            }).compileToV0Message(lookupTables.filter(Boolean) as AddressLookupTableAccount[]);
            const versionedTx = new VersionedTransaction(compiled);
            try {
              const sim = await withWaitLogger(
                {
                  file: 'altair_frontend1/src/lib/useRelay.ts',
                  target: 'Solana simulateTransaction',
                  description: 'Relay Solana simulation (v0 tx)'
                },
                () => connection.simulateTransaction(versionedTx, { sigVerify: false, replaceRecentBlockhash: true })
              );
              if (sim?.value?.err) {
                console.warn('[Relay] Solana simulation error', sim.value.err, sim.value.logs ?? []);
                const jupiterError = buildJupiterError(sim.value.err, sim.value.logs);
                if (jupiterError) throw jupiterError;
              }
            } catch (err) {
              console.warn('[Relay] Solana simulation failed', err);
            }
            const serialized = versionedTx.serialize();
            const { signature } = await withWaitLogger(
              {
                file: 'altair_frontend1/src/lib/useRelay.ts',
                target: 'Privy signAndSendTransaction',
                description: 'Relay Solana transaction signing and submission',
              },
              () =>
                signAndSendTransaction({
                  transaction: serialized,
                  wallet: solanaWallet,
                  chain: 'solana:mainnet',
                })
            );
            const txHash = typeof signature === 'string' ? signature : bs58.encode(signature);
            console.log('[Relay] Solana transaction signature', txHash);
            try {
              const feeLamports = await withWaitLogger(
                {
                  file: 'altair_frontend1/src/lib/useRelay.ts',
                  target: 'Solana getTransaction',
                  description: 'Relay Solana transaction fee lookup',
                },
                () =>
                  waitForSolanaTransactionFeeLamports({
                    connection,
                    signature: txHash,
                  })
              );
              if (feeLamports !== null && feeLamports > 0n) {
                totalRelayGasPaidRaw += feeLamports;
              }
            } catch (feeErr) {
              console.warn('[Relay] Solana fee lookup failed', feeErr);
            }
          } else {
            try {
              const sim = await withWaitLogger(
                {
                  file: 'altair_frontend1/src/lib/useRelay.ts',
                  target: 'Solana simulateTransaction',
                  description: 'Relay Solana simulation (legacy tx)'
                },
                () => connection.simulateTransaction(tx)
              );
              if (sim?.value?.err) {
                console.warn('[Relay] Solana simulation error', sim.value.err, sim.value.logs ?? []);
                const jupiterError = buildJupiterError(sim.value.err, sim.value.logs);
                if (jupiterError) throw jupiterError;
              }
            } catch (err) {
              console.warn('[Relay] Solana simulation failed', err);
            }
            const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
            const { signature } = await withWaitLogger(
              {
                file: 'altair_frontend1/src/lib/useRelay.ts',
                target: 'Privy signAndSendTransaction',
                description: 'Relay Solana transaction signing and submission',
              },
              () =>
                signAndSendTransaction({
                  transaction: serialized,
                  wallet: solanaWallet,
                  chain: 'solana:mainnet',
                })
            );
            const txHash = typeof signature === 'string' ? signature : bs58.encode(signature);
            console.log('[Relay] Solana transaction signature', txHash);
            try {
              const feeLamports = await withWaitLogger(
                {
                  file: 'altair_frontend1/src/lib/useRelay.ts',
                  target: 'Solana getTransaction',
                  description: 'Relay Solana transaction fee lookup',
                },
                () =>
                  waitForSolanaTransactionFeeLamports({
                    connection,
                    signature: txHash,
                  })
              );
              if (feeLamports !== null && feeLamports > 0n) {
                totalRelayGasPaidRaw += feeLamports;
              }
            } catch (feeErr) {
              console.warn('[Relay] Solana fee lookup failed', feeErr);
            }
          }
          continue;
        }

        const fallbackEvmChainId = isSolanaOrigin && !isSolanaDestination
          ? destinationChainId
          : originChainId;
        const resolvedChainId = Number(data?.chainId ?? fallbackEvmChainId);
        const resolvedValue = data?.value ?? '0x0';

        const quoteAgeMs = quoteReceivedAtMs > 0 ? Date.now() - quoteReceivedAtMs : Number.POSITIVE_INFINITY;
        if (quoteAgeMs > maxQuoteAgeMs) {
          console.warn('[Relay] quote is stale before EVM send; re-quoting', {
            quoteAttempt,
            maxQuoteAttempts,
            quoteAgeMs,
            maxQuoteAgeMs,
            stepId: step.id,
          });
          shouldRetryWithFreshQuote = true;
          break;
        }

        if (!data?.to || !data?.data || !Number.isFinite(resolvedChainId) || resolvedChainId <= 0) {
          console.warn('[Relay] Missing tx data for step item', {
            stepId: step.id,
            item,
            resolvedChainId,
          });
          continue;
        }

        const txTo = data.to;
        const txData = data.data;

        const ethereumProvider = await wallet.getEthereumProvider();
        await ensureEvmChainForTx({
          ethereumProvider: ethereumProvider as { request?: (args: { method: string; params?: unknown[] }) => Promise<unknown> },
          chainId: resolvedChainId,
        });

        const preflight = await runRelayEvmPreflight({
          ethereumProvider: ethereumProvider as {
            request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
          },
          chainId: resolvedChainId,
          tx: {
            from: data.from ?? evmAddress,
            to: txTo,
            data: txData,
            value: resolvedValue,
          },
        });

        if (!preflight.ok) {
          console.warn('[Relay] EVM preflight failed', {
            stepId: step.id,
            quoteAttempt,
            maxQuoteAttempts,
            retryableQuote: preflight.retryableQuote,
            reason: preflight.reason,
          });
          if (preflight.retryableQuote && quoteAttempt < maxQuoteAttempts) {
            shouldRetryWithFreshQuote = true;
            break;
          }
          throw new Error(preflight.reason);
        }

        await withWaitLogger(
          {
            file: 'altair_frontend1/src/lib/useRelay.ts',
            target: 'eth_sendTransaction',
            description: 'Relay EVM transaction submission',
          },
          async () => {
            // For Relay route drift, retrying the same payload is usually ineffective.
            // Try once, then immediately re-quote on retryable failures.
            const maxAttempts = 2;
            let lastError: unknown = null;

            for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
              try {
                const txRequest = {
                  from: data.from ?? evmAddress,
                  to: txTo,
                  data: txData,
                  value: resolvedValue,
                  chainId: `0x${resolvedChainId.toString(16)}`,
                };

                const txHash = (await ethereumProvider.request?.({
                  method: 'eth_sendTransaction',
                  params: [txRequest],
                })) as string | undefined;

                if (!txHash || typeof txHash !== 'string') {
                  throw new Error('Relay EVM transaction submission returned no tx hash.');
                }

                const receipt = await waitForEvmTransactionReceipt({
                  ethereumProvider: ethereumProvider as {
                    request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
                  },
                  txHash,
                });

                const gasCostRaw = resolveEvmGasCostFromReceipt(receipt);
                if (gasCostRaw !== null && gasCostRaw > 0n) {
                  const previousTotal = totalRelayGasPaidRaw;
                  totalRelayGasPaidRaw += gasCostRaw;
                  console.log('[Relay] Gas accumulation for EVM transaction', {
                    txHash,
                    stepId: step.id,
                    gasCostWei: gasCostRaw.toString(),
                    gasCostEth: (Number(gasCostRaw) / 1e18).toFixed(18),
                    previousTotalWei: previousTotal.toString(),
                    newTotalWei: totalRelayGasPaidRaw.toString(),
                    newTotalEth: (Number(totalRelayGasPaidRaw) / 1e18).toFixed(18),
                  });
                } else {
                  console.warn('[Relay] No gas cost extracted from receipt', {
                    txHash,
                    stepId: step.id,
                    gasCostRaw,
                  });
                }

                // Success, stop retrying.
                return;
              } catch (err) {
                lastError = err;
                const retryable = isRetryableRelayEvmError(err);
                const transientRetryable = isTransientRelayEvmTransportError(err);
                const isLastAttempt = attempt >= maxAttempts;

                console.warn('[Relay] EVM transaction attempt failed', {
                  stepId: step.id,
                  attempt,
                  maxAttempts,
                  retryable,
                  transientRetryable,
                  error: err instanceof Error ? err.message : String(err),
                });

                if (retryable) {
                  await diagnoseRelayEvmFailure({
                    ethereumProvider: ethereumProvider as {
                      request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
                    },
                    stepId: step.id,
                    chainId: resolvedChainId,
                    tx: {
                      from: data.from ?? evmAddress ?? undefined,
                      to: txTo,
                      data: txData,
                      value: resolvedValue,
                    },
                    attempt,
                    quoteAttempt,
                    err,
                  });
                }

                if (retryable && quoteAttempt < maxQuoteAttempts) {
                  shouldRetryWithFreshQuote = true;
                  return;
                }

                if (transientRetryable && !isLastAttempt) {
                  await wait(550 * attempt + randomJitter(250));
                  continue;
                }

                if (transientRetryable && quoteAttempt < maxQuoteAttempts) {
                  shouldRetryWithFreshQuote = true;
                  return;
                }

                if (!retryable || isLastAttempt) {
                  throw err;
                }

                await wait(800 * attempt);
              }
            }

            throw lastError instanceof Error
              ? lastError
              : new Error('Relay EVM transaction submission failed after retries.');
          }
        );

        if (shouldRetryWithFreshQuote) break;
        }
      }

      if (shouldRetryWithFreshQuote) {
        console.warn('[Relay] re-quoting after retryable EVM failure on last tx attempt', {
          quoteAttempt,
          maxQuoteAttempts,
          requestId,
        });
        await wait(350 * quoteAttempt + randomJitter(200));
        continue;
      }

      break;
    }

    if (!relayQuote) {
      throw new Error('Relay quote response was empty.');
    }

    const quotedBuyAmountRaw = extractRelayQuotedBuyAmountRaw({
      relayQuote,
      destinationDecimals: destinationToken.decimals,
    });

    const buyAmountRaw = quotedBuyAmountRaw ?? '';

    const gasFeeRaw = totalRelayGasPaidRaw > 0n ? totalRelayGasPaidRaw : 0n;
    
    console.log('[Relay] Final gas fee summary', {
      totalGasWei: gasFeeRaw.toString(),
      totalGasEth: (Number(gasFeeRaw) / 1e18).toFixed(18),
      gasSymbol,
      originChain: intent.sellTokenChain,
      destinationChain: intent.buyTokenChain,
      requestId,
    });
    
    const sellSymbolNorm = (originToken.symbol ?? intent.sell).trim().toUpperCase();
    const buySymbolNorm = (destinationToken.symbol ?? buySymbol).trim().toUpperCase();
    const gasIsGasSell = sellSymbolNorm === gasSymbol;
    const gasIsGasBuy = buySymbolNorm === gasSymbol;

    // Compute authoritative post-swap balances from known inputs.
    // sellToken.balanceAfter  = balanceBefore - sellAmount
    // buyToken.balanceAfter   = balanceBefore + buyAmount  (minus gas if gas token = buy token)
    // gasToken.balanceAfter   = balanceBefore - gasFee     (only when gas token ≠ sell and ≠ buy)
    const computedSellBalanceAfterRaw: string | null = (() => {
      if (!sellBalanceBeforeRaw || !amountBase) return null;
      try {
        const before = BigInt(sellBalanceBeforeRaw);
        const amount = BigInt(amountBase);
        // If sell token is also the gas token, subtract gas fee too
        const gas = gasIsGasSell ? gasFeeRaw : 0n;
        const after = before - amount - gas;
        return after >= 0n ? after.toString() : '0';
      } catch {
        return null;
      }
    })();

    const computedBuyBalanceAfterRaw: string | null = (() => {
      if (!buyBalanceBeforeRaw || !buyAmountRaw) return null;
      try {
        const before = BigInt(buyBalanceBeforeRaw);
        const amount = BigInt(buyAmountRaw);
        // If buy token is also the gas token, subtract gas fee
        const gas = gasIsGasBuy ? gasFeeRaw : 0n;
        const after = before + amount - gas;
        return after >= 0n ? after.toString() : '0';
      } catch {
        return null;
      }
    })();

    const computedGasBalanceAfterRaw: string | null = (() => {
      // Only compute standalone gas balance when gas token is neither sell nor buy token
      if (gasIsGasSell || gasIsGasBuy) return null;
      if (!gasBalanceBeforeRaw || gasFeeRaw <= 0n) return null;
      try {
        const before = BigInt(gasBalanceBeforeRaw);
        const after = before - gasFeeRaw;
        return after >= 0n ? after.toString() : '0';
      } catch {
        return null;
      }
    })();

    console.log('[Relay] writeback computed balances', {
      sellBalanceBeforeRaw,
      computedSellBalanceAfterRaw,
      buyBalanceBeforeRaw,
      computedBuyBalanceAfterRaw,
      gasBalanceBeforeRaw,
      computedGasBalanceAfterRaw,
      sellAmountRaw: amountBase,
      buyAmountRaw,
      gasFeeRaw: gasFeeRaw.toString(),
      gasIsGasSell,
      gasIsGasBuy,
    });

    const relayWritebackPayload = {
      cid: cid ?? null,
      intentString: intent.type,
      _altairFee: altairFeeMeta,
      sellToken: {
        amount: amountBase,
        decimals: originToken.decimals,
        symbol: originToken.symbol ?? intent.sell,
        contractAddress: originToken.address,
        chain: intent.sellTokenChain,
        chainId: originChainId,
        walletAddress: isSolanaOrigin ? solanaUser ?? null : evmAddress ?? null,
        balanceBefore: sellBalanceBeforeRaw,
        balanceAfter: computedSellBalanceAfterRaw,
        fees: {
          gas: {
            token: gasSymbol,
            amount: gasFeeRaw > 0n ? gasFeeRaw.toString() : '',
            decimals: gasTokenMeta?.decimals ?? null,
            balanceBefore: gasBalanceBeforeRaw,
            balanceAfter: computedGasBalanceAfterRaw,
          },
          provider: { token: '', amount: '', decimals: null },
          altair: { token: '', amount: '', decimals: null },
        },
      },
      buyToken: {
        amount: buyAmountRaw,
        decimals: destinationToken.decimals,
        symbol: destinationToken.symbol ?? buySymbol,
        contractAddress: destinationToken.address,
        chain: intent.buyTokenChain,
        chainId: destinationChainId,
        walletAddress: isSolanaDestination ? solanaRecipient ?? null : evmAddress ?? null,
        balanceBefore: buyBalanceBeforeRaw,
        balanceAfter: computedBuyBalanceAfterRaw,
        fees: {
          gas: { token: '', amount: '', decimals: null },
          provider: { token: '', amount: '', decimals: null },
          altair: { token: '', amount: '', decimals: null },
        },
      },
      requestId: requestId ?? null,
    };

    // Dispatch altair:swap-complete after writeback so balanceUpdates from the
    // backend response can be used for immediate UI updates.
    let writebackBalanceUpdates: Array<{
      chain: string;
      symbol: string;
      balanceAfterRaw: string | null;
      decimals: number;
    }> = [];
    try {
      const backendBaseUrl = getBackendBaseUrl();
      console.log('[Relay] Sending writeback request', {
        url: `${backendBaseUrl}/api/relay/writeback`,
        payload: relayWritebackPayload,
      });
      const writebackRes = await fetch(`${backendBaseUrl}/api/relay/writeback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(relayWritebackPayload),
      });
      console.log('[Relay] Writeback response status', writebackRes.status);
      if (!writebackRes.ok) {
        const errorText = await writebackRes.text();
        console.error('[Relay] Writeback failed with status', writebackRes.status, errorText);
        throw new Error(`Writeback failed: ${errorText}`);
      }
      const writebackData = await writebackRes.json().catch(() => ({})) as { balanceUpdates?: typeof writebackBalanceUpdates };
      console.log('[Relay] Writeback response data', writebackData);
      if (Array.isArray(writebackData?.balanceUpdates)) {
        writebackBalanceUpdates = writebackData.balanceUpdates;
      }
    } catch (err) {
      console.error('[Relay] writeback failed', err);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('altair:swap-complete', {
          detail: {
            chain: intent.sellTokenChain,
            sellToken: sellSymbolNorm,
            buyToken: buySymbolNorm,
            requestId: requestId ?? undefined,
            balanceUpdates: writebackBalanceUpdates,
          },
        })
      );
    }

    return {
      requestId: requestId ?? null,
    };
  };
};
