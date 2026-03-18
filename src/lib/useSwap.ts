'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { ethers } from 'ethers';
import { withWaitLogger } from './waitLogger';
import { BLOCKCHAIN, CHAINS, type ChainKey } from '@config/blockchain_config';
import { BASE_MAINNET, BASE_SEPOLIA, ETH_MAINNET, ETH_SEPOLIA, resolveRpcUrls } from '@config/chain_info';

const chainConfigs = {
  BASE_SEPOLIA,
  ETH_SEPOLIA,
  ETH_MAINNET,
  BASE_MAINNET,
} as const;

type EvmChainKey = Exclude<ChainKey, 'SOLANA_MAINNET'>;

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

const ensureEvmChain = async (
  ethereumProvider: ethers.Eip1193Provider,
  chainKey: ChainKey,
) => {
  if (chainKey === 'SOLANA_MAINNET') {
    throw new Error('Solana is not supported by the EVM swap flow.');
  }
  const chainConfig = chainConfigs[chainKey as EvmChainKey];
  console.log('[RPC] ensureEvmChain chainKey:', chainKey);
  console.log('[RPC] ensureEvmChain rpcUrls:', chainConfig.rpcUrls);
  const resolvedRpcUrls = resolveRpcUrls(chainConfig.rpcUrls);
  console.log('[RPC] ensureEvmChain resolvedRpcUrls:', resolvedRpcUrls);
  const targetChainId = `0x${chainConfig.chainId.toString(16)}`;
  const chainMeta: Record<EvmChainKey, { name: string; explorer: string }> = {
    ETH_MAINNET: { name: 'Ethereum Mainnet', explorer: 'https://etherscan.io' },
    ETH_SEPOLIA: { name: 'Sepolia', explorer: 'https://sepolia.etherscan.io' },
    BASE_MAINNET: { name: 'Base Mainnet', explorer: 'https://basescan.org' },
    BASE_SEPOLIA: { name: 'Base Sepolia', explorer: 'https://sepolia.basescan.org' },
  };

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
            chainName: chainMeta[chainKey as EvmChainKey].name,
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: resolvedRpcUrls,
            blockExplorerUrls: [chainMeta[chainKey as EvmChainKey].explorer],
          },
        ],
      });
      return;
    }
    throw switchError;
  }
};

export const useSwap = (explicitChain?: ChainKey) => {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();

  return async (sellToken: string, sellAmount: string, buyToken: string, CID?: string | null) =>
    withSwapQueue(async () => {
      if (!authenticated || !wallets?.length) {
        throw new Error('No authenticated wallet available.');
      }

      const selectedChain = resolveSelectedChain(explicitChain);
      console.log('[RPC] selectedChain:', selectedChain);
      if (selectedChain === 'SOLANA_MAINNET') {
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

      const routeResponse = await withWaitLogger(
        {
          file: 'altair_frontend1/src/lib/useSwap.ts',
          target: '/api/test-swap',
          description: 'swap route response',
        },
        () =>
          fetch('/api/test-swap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              chain: selectedChain,
              sellToken: effectiveSell,
              buyToken: normalizedBuy,
              amount: sellAmount,
              recipient,
              CID: CID ?? null,
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

      const routePayload = (await routeResponse.json()) as {
        methodParameters?: { to: string; calldata: string; value: string };
        sellTokenAddress?: string;
      };

      if (!routePayload.methodParameters) {
        throw new Error('No swap route found');
      }

      const methodParameters = routePayload.methodParameters;

      if (effectiveSell !== 'ETH') {
        const sellTokenAddress = routePayload.sellTokenAddress;
        if (!sellTokenAddress) {
          throw new Error('Missing sell token address for approval');
        }
        const erc20Approve = new ethers.Contract(
          sellTokenAddress,
          ['function approve(address,uint256)'],
          managedSigner,
        );
        const approveTx = await withWaitLogger(
          {
            file: 'altair_frontend1/src/lib/useSwap.ts',
            target: 'ERC20.approve',
            description: 'token approval transaction submission',
          },
          () => erc20Approve.approve(methodParameters.to, ethers.MaxUint256)
        );
        await withWaitLogger(
          {
            file: 'altair_frontend1/src/lib/useSwap.ts',
            target: 'ERC20.approve.wait',
            description: 'token approval confirmation',
          },
          () => approveTx.wait()
        );
      }

      const tx = await withWaitLogger(
        {
          file: 'altair_frontend1/src/lib/useSwap.ts',
          target: 'sendTransaction',
          description: 'swap transaction submission',
        },
        () =>
          managedSigner.sendTransaction({
            to: methodParameters.to,
            data: methodParameters.calldata,
            value: methodParameters.value,
            gasLimit: 1_000_000n,
          })
      );

      await withWaitLogger(
        {
          file: 'altair_frontend1/src/lib/useSwap.ts',
          target: 'sendTransaction.wait',
          description: 'swap transaction confirmation',
        },
        () => tx.wait()
      );
      await withWaitLogger(
        {
          file: 'altair_frontend1/src/lib/useSwap.ts',
          target: '/api/test-swap writeback',
          description: 'swap writeback after confirmation',
        },
        () =>
          fetch('/api/test-swap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              chain: selectedChain,
              sellToken: effectiveSell,
              buyToken: normalizedBuy,
              amount: sellAmount,
              recipient,
              CID: CID ?? null,
              txHash: tx.hash,
            }),
          })
      );
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('altair:swap-complete', {
            detail: { chain: selectedChain, sellToken: effectiveSell, buyToken: normalizedBuy },
          })
        );
      }
      return tx.hash as string;
    });
};
