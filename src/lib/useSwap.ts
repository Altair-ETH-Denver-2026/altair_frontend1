'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { ethers } from 'ethers';
import { withWaitLogger } from './waitLogger';
import { BLOCKCHAIN, CHAINS, GAS_TOKENS, SWAP_PROVIDER_OPTIONS, type ChainKey } from '@config/blockchain_config';
import { BASE_MAINNET, BASE_SEPOLIA, ETH_MAINNET, ETH_SEPOLIA, resolveRpcUrls } from '@config/chain_info';
import { dispatchSwapSubmitted, dispatchBalanceStale } from './eventTypes';
import { getBackendBaseUrl } from './backendUrl';
import { getCachedPrivyAccessToken } from './privyTokenCache';

const chainConfigs = {
  BASE_SEPOLIA,
  ETH_SEPOLIA,
  ETH_MAINNET,
  BASE_MAINNET,
} as const;

type EvmChainKey = Exclude<ChainKey, 'SOLANA_MAINNET' | 'SOLANA_DEVNET'>;
const isSolanaChain = (chainKey: ChainKey) => chainKey === 'SOLANA_MAINNET' || chainKey === 'SOLANA_DEVNET';

let swapQueue: Promise<void> = Promise.resolve();

const withSwapQueue = async <T>(task: () => Promise<T>): Promise<T> => {
  const run = swapQueue.then(task, task);
  swapQueue = run.then(() => undefined, () => undefined);
  return run;
};

export const resolveSelectedChain = (explicitChain?: ChainKey) => {
  if (explicitChain) return explicitChain;
  if (typeof window === 'undefined') return BLOCKCHAIN;
  const stored = localStorage.getItem('selectedChain');
  if (stored && stored in CHAINS) return stored as ChainKey;
  return BLOCKCHAIN;
};

export const readCachedTokenSnapshot = (params: {
  chainKey: ChainKey;
  walletAddress: string | null | undefined;
  symbol: string;
}): { raw: string | null; decimals: number | null } => {
  const { chainKey, walletAddress, symbol } = params;
  if (typeof window === 'undefined') return { raw: null, decimals: null };
  if (!walletAddress) return { raw: null, decimals: null };
  const normalizedSymbol = symbol.trim().toUpperCase();
  if (!normalizedSymbol) return { raw: null, decimals: null };

  // Normalize to lowercase so the key matches what UserMenu writes using the
  // Privy-returned address (which is always lowercase, not EIP-55 checksummed).
  const cacheKey = `cached:balances:${chainKey}:${walletAddress.toLowerCase()}`;
  const raw = localStorage.getItem(cacheKey);
  if (!raw) return { raw: null, decimals: null };

  try {
    const payload = JSON.parse(raw) as {
      source?: 'cache' | 'mongo' | 'blockchain' | 'stale';
      tokens?: Record<string, { symbol?: string; balance?: unknown; balanceRaw?: unknown; decimals?: unknown }>;
    };
    if (payload?.source === 'stale') {
      console.log('[readCachedTokenSnapshot] Cache marked as stale for', normalizedSymbol);
      return { raw: null, decimals: null };
    }
    const tokens = payload?.tokens;
    if (!tokens || typeof tokens !== 'object') {
      console.log('[readCachedTokenSnapshot] No tokens found for', normalizedSymbol);
      return { raw: null, decimals: null };
    }

    const direct = tokens[normalizedSymbol];
    const bySymbol = direct ?? Object.values(tokens).find((entry) => {
      if (!entry || typeof entry !== 'object') return false;
      const candidate = (entry as { symbol?: unknown }).symbol;
      return typeof candidate === 'string' && candidate.trim().toUpperCase() === normalizedSymbol;
    });

    if (!bySymbol || typeof bySymbol !== 'object') {
      console.log('[readCachedTokenSnapshot] Token not found:', normalizedSymbol);
      return { raw: null, decimals: null };
    }
    
    const decimals = typeof bySymbol.decimals === 'number' ? bySymbol.decimals : null;
    if (decimals === null || decimals < 0) {
      console.log('[readCachedTokenSnapshot] Invalid decimals for', normalizedSymbol, ':', bySymbol.decimals);
      return { raw: null, decimals: null };
    }

    // First, try to use balanceRaw if available (raw balance in smallest units)
    const rawBalance = bySymbol.balanceRaw;
    if (typeof rawBalance === 'string' && rawBalance.trim().length > 0) {
      console.log('[readCachedTokenSnapshot] Using balanceRaw for', normalizedSymbol, ':', rawBalance.trim(), 'decimals:', decimals);
      return { raw: rawBalance.trim(), decimals };
    }

    // Fall back to human-readable balance and convert to raw
    const human = bySymbol.balance;
    console.log('[readCachedTokenSnapshot] No balanceRaw, using human balance for', normalizedSymbol, ':', human, 'type:', typeof human, 'decimals:', decimals);
    
    if (typeof human === 'number' && Number.isFinite(human) && human >= 0) {
      const raw = ethers.parseUnits(human.toString(), decimals).toString();
      console.log('[readCachedTokenSnapshot] Converted number to raw:', human, '->', raw);
      return { raw, decimals };
    }
    if (typeof human === 'string' && human.trim().length > 0) {
      const raw = ethers.parseUnits(human.trim(), decimals).toString();
      console.log('[readCachedTokenSnapshot] Converted string to raw:', human.trim(), '->', raw);
      return { raw, decimals };
    }
    
    console.log('[readCachedTokenSnapshot] No valid balance found for', normalizedSymbol);
    return { raw: null, decimals };
  } catch (err) {
    console.error('[readCachedTokenSnapshot] Error reading cache for', normalizedSymbol, ':', err);
    return { raw: null, decimals: null };
  }
};

const ensureEvmChain = async (
  ethereumProvider: ethers.Eip1193Provider,
  chainKey: ChainKey,
) => {
  if (isSolanaChain(chainKey)) {
    throw new Error('Solana is not supported by the EVM swap flow.');
  }
  const chainConfig = chainConfigs[chainKey as EvmChainKey];
  console.log('[RPC] ensureEvmChain chainKey:', chainKey);
  console.log('[RPC] ensureEvmChain rpcUrls:', chainConfig.rpcUrls);
  const resolvedRpcUrls = resolveRpcUrls(chainConfig.rpcUrls);
  console.log('[RPC] ensureEvmChain resolvedRpcUrls:', resolvedRpcUrls);
  const targetChainId = `0x${chainConfig.chainId.toString(16)}`;
  const chainName = typeof chainConfig.name === 'string' && chainConfig.name.trim().length > 0
    ? chainConfig.name
    : chainKey;
  const explorerUrl = typeof chainConfig.explorerUrl === 'string' && chainConfig.explorerUrl.trim().length > 0
    ? chainConfig.explorerUrl
    : undefined;

  try {
    await ethereumProvider.request?.({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: targetChainId }],
    });
  } catch (switchError: unknown) {
    const error = switchError as { code?: number; message?: string };
    const unsupportedChain =
      error?.code === 4902 ||
      error?.code === -32602 ||
      (error?.message?.toLowerCase().includes('unsupported') ?? false);

    if (unsupportedChain) {
      await ethereumProvider.request?.({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: targetChainId,
            chainName,
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: resolvedRpcUrls,
            blockExplorerUrls: explorerUrl ? [explorerUrl] : [],
          },
        ],
      });
      return;
    }
    throw switchError;
  }
};

/**
 * Quote-phase errors that can never be "fixed" by trying a different swap provider.
 * The QUOTE phase is the only place we retry — once a swap tx is broadcast we
 * never re-broadcast, so this classifier only needs to cover quote-side failures.
 */
function isFatalQuoteError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  if (message.includes('user rejected')) return true;
  if (message.includes('user denied')) return true;
  if (message.includes('insufficient funds')) return true;
  if (message.includes('access token')) return true;
  if (message.includes('unauthorized')) return true;
  return false;
}

/**
 * Approve ERC-20 spending for the swap router. We try a normal `approve(MaxUint256)`
 * first; only if it reverts on top of a non-zero existing allowance do we fall back
 * to the USDT-style reset-to-0 dance. Most tokens take the one-tx path.
 */
async function approveTokenIfNeeded(params: {
  sellTokenAddress: string;
  spenderAddress: string;
  amountWei: bigint;
  recipient: string;
  managedSigner: ethers.NonceManager;
}): Promise<void> {
  const { sellTokenAddress, spenderAddress, amountWei, recipient, managedSigner } = params;

  const erc20 = new ethers.Contract(
    sellTokenAddress,
    ['function allowance(address,address) view returns (uint256)', 'function approve(address,uint256)'],
    managedSigner,
  );

  const currentAllowance: bigint = await withWaitLogger(
    {
      file: 'altair_frontend1/src/lib/useSwap.ts',
      target: 'ERC20.allowance',
      description: 'check token allowance',
    },
    () => erc20.allowance(recipient, spenderAddress)
  );

  console.log('[useSwap] Current allowance:', currentAllowance.toString(), 'Required:', amountWei.toString());

  if (currentAllowance >= amountWei) {
    console.log('[useSwap] Sufficient allowance, skipping approval');
    return;
  }

  const sendApprove = async (value: bigint, label: string) => {
    const tx = await withWaitLogger(
      {
        file: 'altair_frontend1/src/lib/useSwap.ts',
        target: `ERC20.approve${label}`,
        description: `token approval${label}`,
      },
      () => erc20.approve(spenderAddress, value)
    );
    await withWaitLogger(
      {
        file: 'altair_frontend1/src/lib/useSwap.ts',
        target: `ERC20.approve.wait${label}`,
        description: `token approval confirmation${label}`,
      },
      () => tx.wait()
    );
  };

  try {
    await sendApprove(ethers.MaxUint256, '');
  } catch (err) {
    if (currentAllowance > 0n) {
      console.warn('[useSwap] Direct approve(MaxUint256) failed; falling back to reset-to-0 dance', err);
      await sendApprove(0n, ' (reset)');
      await sendApprove(ethers.MaxUint256, ' (retry)');
    } else {
      throw err;
    }
  }

  const newAllowance: bigint = await withWaitLogger(
    {
      file: 'altair_frontend1/src/lib/useSwap.ts',
      target: 'ERC20.allowance (verify)',
      description: 'verify new allowance',
    },
    () => erc20.allowance(recipient, spenderAddress)
  );
  console.log('[useSwap] New allowance:', newAllowance.toString());

  if (newAllowance < amountWei) {
    throw new Error(`Approval succeeded but allowance is still insufficient: ${newAllowance.toString()} < ${amountWei.toString()}`);
  }
}

export const useSwap = (explicitChain?: ChainKey) => {
  const { authenticated, getAccessToken } = usePrivy();
  const { wallets } = useWallets();

  return async (sellToken: string, sellAmount: string, buyToken: string, CID?: string | null) =>
    withSwapQueue(async () => {
      if (!authenticated || !wallets?.length) {
        throw new Error('No authenticated wallet available.');
      }

      const selectedChain = resolveSelectedChain(explicitChain);
      console.log('[RPC] selectedChain:', selectedChain);
      if (isSolanaChain(selectedChain)) {
        throw new Error('Solana is not supported by useSwap. Use useSolanaSwap instead.');
      }
      const evmChain = selectedChain as EvmChainKey;
      const chainConfig = chainConfigs[evmChain];
      console.log('[RPC] chainConfig rpcUrls:', chainConfig?.rpcUrls);
      if (!chainConfig) {
        throw new Error('Unsupported chain configuration.');
      }

      const wallet = wallets[0];
      const ethereumProvider = await withWaitLogger(
        {
          file: 'altair_frontend1/src/lib/useSwap.ts',
          target: 'Privy wallet.getEthereumProvider',
          description: 'EVM provider for swap',
        },
        () => wallet.getEthereumProvider()
      );
      await withWaitLogger(
        {
          file: 'altair_frontend1/src/lib/useSwap.ts',
          target: 'wallet_switchEthereumChain',
          description: `ensure chain ${selectedChain}`,
        },
        () => ensureEvmChain(ethereumProvider, selectedChain)
      );

      const provider = new ethers.BrowserProvider(ethereumProvider);
      const signer = await withWaitLogger(
        {
          file: 'altair_frontend1/src/lib/useSwap.ts',
          target: 'ethers.getSigner',
          description: 'EVM signer for swap',
        },
        () => provider.getSigner()
      );
      const managedSigner = new ethers.NonceManager(signer);
      const recipient = await withWaitLogger(
        {
          file: 'altair_frontend1/src/lib/useSwap.ts',
          target: 'ethers.getAddress',
          description: 'EVM recipient address',
        },
        () => managedSigner.getAddress()
      );

      const normalizedSell = sellToken.toUpperCase();
      const normalizedBuy = buyToken.toUpperCase();
      const amountWei = ethers.parseEther(sellAmount);

      const effectiveSell = normalizedSell;
      const gasSymbol = (GAS_TOKENS[selectedChain] ?? 'ETH').toUpperCase();
      const sellSnapshot = readCachedTokenSnapshot({ chainKey: selectedChain, walletAddress: recipient, symbol: effectiveSell });
      const buySnapshot = readCachedTokenSnapshot({ chainKey: selectedChain, walletAddress: recipient, symbol: normalizedBuy });
      const gasSnapshot = readCachedTokenSnapshot({ chainKey: selectedChain, walletAddress: recipient, symbol: gasSymbol });

      // Fetch the Privy access token once for the whole swap. We send it as a
      // Bearer header on both /api/test-swap calls because cross-site cookies do
      // not reach the prod backend (different registrable domain). On localhost
      // the cookie still works as a fallback. A token-fetch failure is non-fatal;
      // the backend will simply 401 the writeback, which Fix 2 now swallows.
      const accessToken = await getCachedPrivyAccessToken(getAccessToken).catch(() => null);

      // Phase 1 — QUOTE. Provider fallback is only allowed in this phase. Once
      // we leave it we have either an approval or a swap tx on-chain and we
      // must never silently re-submit.
      const providersForChain = (SWAP_PROVIDER_OPTIONS as unknown as Record<string, readonly string[]>)[selectedChain];
      const providers = providersForChain && providersForChain.length > 0 ? providersForChain : ['0x v2', '0x v1'];
      const maxIterations = SWAP_PROVIDER_OPTIONS.maxAttemptsPerOption || 2;

      type RoutePayload = {
        methodParameters: { to: string; calldata: string; value: string };
        sellTokenAddress?: string;
        integratorFee?: { token: string; amount: string; type: string } | null;
      };

      let routePayload: RoutePayload | null = null;
      let providerUsed: string | null = null;
      let lastQuoteError: Error | null = null;

      quoteLoop: for (let iteration = 0; iteration < maxIterations; iteration++) {
        for (const providerName of providers) {
          try {
            console.log(`[useSwap] Fetching quote from ${providerName} (iteration ${iteration + 1}/${maxIterations})`);

            const routeResponse = await withWaitLogger(
              {
                file: 'altair_frontend1/src/lib/useSwap.ts',
                target: '/api/test-swap',
                description: `swap route response (${providerName})`,
              },
              () =>
                fetch(`${getBackendBaseUrl()}/api/test-swap`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                  },
                  credentials: 'include',
                  body: JSON.stringify({
                    chain: selectedChain,
                    sellToken: effectiveSell,
                    buyToken: normalizedBuy,
                    amount: sellAmount,
                    recipient,
                    provider: providerName,
                    CID: CID ?? null,
                    balanceSnapshots: {
                      sellTokenBeforeRaw: sellSnapshot.raw,
                      buyTokenBeforeRaw: buySnapshot.raw,
                      gasTokenBeforeRaw: gasSnapshot.raw,
                      gasTokenSymbol: gasSymbol,
                      gasTokenDecimals: gasSnapshot.decimals ?? (gasSymbol === 'SOL' ? 9 : 18),
                    },
                  }),
                })
            );

            if (!routeResponse.ok) {
              const errorPayload = await routeResponse.json().catch(() => ({}));
              const message = typeof errorPayload?.error === 'string'
                ? errorPayload.error
                : 'Failed to fetch swap route';
              const err = new Error(message) as Error & {
                code?: string;
                payload?: unknown;
                status?: number;
              };
              err.code = typeof errorPayload?.code === 'string' ? errorPayload.code : undefined;
              err.payload = errorPayload;
              err.status = routeResponse.status;
              throw err;
            }

            const payload = (await routeResponse.json()) as Partial<RoutePayload>;
            if (!payload.methodParameters) {
              throw new Error('No swap route found');
            }

            routePayload = payload as RoutePayload;
            providerUsed = providerName;
            break quoteLoop;
          } catch (error) {
            console.error(`[useSwap] Quote failed with ${providerName}:`, error);
            lastQuoteError = error instanceof Error ? error : new Error(String(error));
            if (isFatalQuoteError(error)) throw error;
            // Otherwise fall through to next provider / next iteration.
          }
        }
      }

      if (!routePayload || !providerUsed) {
        throw lastQuoteError ?? new Error('All swap providers failed to provide a quote');
      }

      const methodParameters = routePayload.methodParameters;

      // Phase 2 — EXECUTE. No provider fallback past this line. Approval and swap
      // transactions are sent at most once; any failure here surfaces directly
      // to the caller so we never re-broadcast a swap that may already have
      // landed on-chain.
      if (effectiveSell !== 'ETH') {
        const sellTokenAddress = routePayload.sellTokenAddress;
        if (!sellTokenAddress) {
          throw new Error('Missing sell token address for approval');
        }
        await approveTokenIfNeeded({
          sellTokenAddress,
          spenderAddress: methodParameters.to,
          amountWei,
          recipient,
          managedSigner,
        });
      }

      const tx = await withWaitLogger(
        {
          file: 'altair_frontend1/src/lib/useSwap.ts',
          target: 'sendTransaction',
          description: `swap transaction submission (${providerUsed})`,
        },
        () =>
          managedSigner.sendTransaction({
            to: methodParameters.to,
            data: methodParameters.calldata,
            value: methodParameters.value,
            gasLimit: 1_000_000n,
          })
      );

      dispatchSwapSubmitted({
        sellToken: effectiveSell,
        buyToken: normalizedBuy,
        sellChain: selectedChain,
        buyChain: selectedChain,
        amount: sellAmount,
        txHash: tx.hash,
        intentId: CID ?? null,
        timestamp: Date.now(),
      });

      const now = Date.now();
      const tokensToMarkStale = new Set([effectiveSell, normalizedBuy, gasSymbol]);
      tokensToMarkStale.forEach((symbol) => {
        if (symbol) {
          dispatchBalanceStale({
            chainKey: selectedChain,
            symbol,
            reason: 'swap',
            timestamp: now,
          });
        }
      });

      const receipt = await withWaitLogger(
        {
          file: 'altair_frontend1/src/lib/useSwap.ts',
          target: 'sendTransaction.wait',
          description: `swap transaction confirmation (${providerUsed})`,
        },
        () => tx.wait()
      );

      if (receipt && receipt.status === 0) {
        throw new Error(`Transaction reverted on-chain (${providerUsed})`);
      }

      const emitComplete = (balanceUpdates: unknown) => {
        if (typeof window === 'undefined') return;
        window.dispatchEvent(
          new CustomEvent('altair:swap-complete', {
            detail: {
              chain: selectedChain,
              sellToken: effectiveSell,
              buyToken: normalizedBuy,
              txHash: tx.hash,
              intentId: CID ?? null,
              balanceUpdates: Array.isArray(balanceUpdates) ? balanceUpdates : [],
            },
          })
        );
      };

      // Writeback is bookkeeping only and is allowed to fail without taking the
      // confirmed on-chain swap down with it.
      try {
        await withWaitLogger(
          {
            file: 'altair_frontend1/src/lib/useSwap.ts',
            target: '/api/test-swap writeback',
            description: 'swap writeback after confirmation',
          },
          async () => {
            const writebackRes = await fetch(`${getBackendBaseUrl()}/api/test-swap`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
              },
              credentials: 'include',
              body: JSON.stringify({
                chain: selectedChain,
                sellToken: effectiveSell,
                buyToken: normalizedBuy,
                amount: sellAmount,
                recipient,
                CID: CID ?? null,
                txHash: tx.hash,
                integratorFee: routePayload?.integratorFee ?? null,
                balanceSnapshots: {
                  sellTokenBeforeRaw: sellSnapshot.raw,
                  buyTokenBeforeRaw: buySnapshot.raw,
                  gasTokenBeforeRaw: gasSnapshot.raw,
                  gasTokenSymbol: gasSymbol,
                  gasTokenDecimals: gasSnapshot.decimals,
                },
              }),
            });
            const writebackPayload = await writebackRes.json().catch(() => ({} as {
              error?: string;
              balanceUpdates?: Array<{ chain: ChainKey; symbol: string; balanceAfterRaw: string | null; decimals: number }>;
            }));
            if (!writebackRes.ok) {
              throw new Error(
                typeof writebackPayload?.error === 'string'
                  ? writebackPayload.error
                  : 'Swap writeback failed'
              );
            }
            emitComplete(writebackPayload?.balanceUpdates);
          }
        );
      } catch (writebackErr) {
        console.error('[useSwap] writeback failed after confirmed swap (non-fatal)', writebackErr);
        emitComplete([]);
      }

      console.log(`[useSwap] Swap succeeded with ${providerUsed}`);
      return tx.hash as string;
    });
};
