'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { ethers } from 'ethers';
import { BLOCKCHAIN, CHAINS, WRAP_ETH, type ChainKey } from '../../config/blockchain_config';
import { BASE_MAINNET, BASE_SEPOLIA, ETH_MAINNET, ETH_SEPOLIA, resolveRpcUrls } from '../../config/chain_info';
import { WETH as BASE_WETH } from '../../config/token_info/base_tokens';
import { WETH as BASE_SEPOLIA_WETH } from '../../config/token_info/base_testnet_sepolia_tokens';
import { WETH as ETH_WETH } from '../../config/token_info/eth_tokens';
import { WETH as ETH_SEPOLIA_WETH } from '../../config/token_info/eth_sepolia_testnet_tokens';

const chainConfigs = {
  BASE_SEPOLIA,
  ETH_SEPOLIA,
  ETH_MAINNET,
  BASE_MAINNET,
} as const;

const tokenConfigs = {
  BASE_SEPOLIA: { WETH: BASE_SEPOLIA_WETH },
  ETH_SEPOLIA: { WETH: ETH_SEPOLIA_WETH },
  ETH_MAINNET: { WETH: ETH_WETH },
  BASE_MAINNET: { WETH: BASE_WETH },
} as const;

const resolveSelectedChain = (explicitChain?: ChainKey) => {
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
  const chainConfig = chainConfigs[chainKey];
  console.log('[RPC] ensureEvmChain chainKey:', chainKey);
  console.log('[RPC] ensureEvmChain rpcUrls:', chainConfig.rpcUrls);
  const resolvedRpcUrls = resolveRpcUrls(chainConfig.rpcUrls);
  console.log('[RPC] ensureEvmChain resolvedRpcUrls:', resolvedRpcUrls);
  const targetChainId = `0x${chainConfig.chainId.toString(16)}`;
  const chainMeta: Record<ChainKey, { name: string; explorer: string }> = {
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
            chainName: chainMeta[chainKey].name,
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: resolvedRpcUrls,
            blockExplorerUrls: [chainMeta[chainKey].explorer],
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

  return async (sellToken: string, sellAmount: string, buyToken: string) => {
    if (!authenticated || !wallets?.length) {
      throw new Error('No authenticated wallet available.');
    }

    const selectedChain = resolveSelectedChain(explicitChain);
    console.log('[RPC] selectedChain:', selectedChain);
    const chainConfig = chainConfigs[selectedChain];
    console.log('[RPC] chainConfig rpcUrls:', chainConfig?.rpcUrls);
    const tokenConfig = tokenConfigs[selectedChain];
    if (!chainConfig) {
      throw new Error('Unsupported chain configuration.');
    }

    const wallet = wallets[0];
    const ethereumProvider = await wallet.getEthereumProvider();
    await ensureEvmChain(ethereumProvider, selectedChain);

    const provider = new ethers.BrowserProvider(ethereumProvider);
    const signer = await provider.getSigner();
    const recipient = await signer.getAddress();

    const normalizedSell = sellToken.toUpperCase();
    const normalizedBuy = buyToken.toUpperCase();
    const amountWei = ethers.parseEther(sellAmount);

    const effectiveSell = normalizedSell;

    if (WRAP_ETH && normalizedSell === 'ETH' && normalizedBuy === 'WETH') {
      const weth = new ethers.Contract(
        tokenConfig.WETH.address,
        ['function deposit() payable'],
        signer,
      );

      const wrapTx = await weth.deposit({ value: amountWei });
      await wrapTx.wait();

      return wrapTx.hash as string;
    }

    const routeResponse = await fetch('/api/test-swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        chain: selectedChain,
        sellToken: effectiveSell,
        buyToken: normalizedBuy,
        amount: amountWei.toString(),
        recipient,
      }),
    });

    if (!routeResponse.ok) {
      const errorPayload = await routeResponse.json().catch(() => ({}));
      throw new Error(errorPayload?.error ?? 'Failed to fetch swap route');
    }

    const routePayload = (await routeResponse.json()) as {
      methodParameters?: { to: string; calldata: string; value: string };
    };

    if (!routePayload.methodParameters) {
      throw new Error('No swap route found');
    }

    if (effectiveSell === 'WETH') {
      const wethApprove = new ethers.Contract(
        tokenConfig.WETH.address,
        ['function approve(address,uint256)'],
        signer,
      );

      await wethApprove.approve(routePayload.methodParameters.to, ethers.MaxUint256);
    }

    const tx = await signer.sendTransaction({
      to: routePayload.methodParameters.to,
      data: routePayload.methodParameters.calldata,
      value: routePayload.methodParameters.value,
      gasLimit: 1_000_000n,
    });

    await tx.wait();
    return tx.hash as string;
  };
};
