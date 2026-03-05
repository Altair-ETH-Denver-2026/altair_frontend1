'use client';

import { createWalletClient, custom, type WalletClient } from 'viem';
import { mainnet } from 'viem/chains';
import { adaptViemWallet } from '@relayprotocol/relay-sdk';
import type { ChainKey } from '../../config/blockchain_config';
import { BASE_MAINNET, BASE_SEPOLIA, ETH_MAINNET, ETH_SEPOLIA } from '../../config/chain_info';

const EVM_CHAIN_MAP: Record<Exclude<ChainKey, 'SOLANA_MAINNET'>, { chainId: number }> = {
  ETH_MAINNET: { chainId: ETH_MAINNET.chainId },
  BASE_MAINNET: { chainId: BASE_MAINNET.chainId },
  ETH_SEPOLIA: { chainId: ETH_SEPOLIA.chainId },
  BASE_SEPOLIA: { chainId: BASE_SEPOLIA.chainId },
};

function chainIdToViemChain(chainId: number) {
  if (chainId === 1) return mainnet;
  const chains = [
    mainnet,
    { id: 8453, name: 'Base', nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' }, rpcUrls: { default: { http: ['https://mainnet.base.org'] } } },
    { id: 11155111, name: 'Sepolia', nativeCurrency: { decimals: 18, name: 'Sepolia Ether', symbol: 'ETH' }, rpcUrls: { default: { http: ['https://rpc.sepolia.org'] } } },
    { id: 84532, name: 'Base Sepolia', nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' }, rpcUrls: { default: { http: ['https://sepolia.base.org'] } } },
  ] as const;
  const c = chains.find((ch) => ch.id === chainId);
  return c ?? { id: chainId, name: `Chain ${chainId}`, nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' }, rpcUrls: { default: { http: [] } } };
}

/**
 * Create a viem WalletClient from Privy's EIP-1193 provider, then adapt it for Relay SDK.
 */
export async function createPrivyEvmRelayAdapter(
  ethereumProvider: unknown,
  options?: { chainId?: number; chainKey?: Exclude<ChainKey, 'SOLANA_MAINNET'> }
): Promise<ReturnType<typeof adaptViemWallet>> {
  const chainId = options?.chainId ?? (options?.chainKey ? EVM_CHAIN_MAP[options.chainKey].chainId : 1);
  const chain = chainIdToViemChain(chainId);
  const client = createWalletClient({
    chain,
    transport: custom(ethereumProvider as import('viem').EIP1193Provider),
  }) as WalletClient;
  const accounts = await client.getAddresses();
  if (!accounts?.length) {
    await client.requestAddresses();
  }
  return adaptViemWallet(client);
}

/** Relay chain ID for Solana mainnet (from Relay GET /chains). */
export const RELAY_SOLANA_MAINNET_CHAIN_ID = 792703809;
/** Relay chain ID for Solana devnet when using testnet API. */
export const RELAY_SOLANA_DEVNET_CHAIN_ID = 792703810;

type SignAndSendSolanaTx = (serializedTransaction: Uint8Array) => Promise<string>;

/**
 * Create a Relay AdaptedWallet for SVM (Solana) using Helius Connection and Privy sign-and-send.
 * Does not use @solana/kit. connection should use NEXT_PUBLIC_SOLANA_RPC_URL (Helius).
 */
export function createPrivySolanaRelayAdapter(
  connection: import('@solana/web3.js').Connection,
  walletAddress: string,
  signAndSendTransaction: SignAndSendSolanaTx,
  relaySolanaChainId: number = RELAY_SOLANA_MAINNET_CHAIN_ID
): unknown {
  return {
    vmType: 'svm',
    address: () => Promise.resolve(walletAddress),
    getChainId: () => Promise.resolve(relaySolanaChainId),
    switchChain: async () => {},
    handleSignMessageStep: async () => {
      throw new Error('Solana message signing not implemented for Relay');
    },
    handleSendTransactionStep: async (
      _chainId: number,
      item: { data?: { transaction?: string; serializedTransaction?: string } },
      _step: unknown
    ) => {
      const data = item?.data;
      const raw = data?.transaction ?? data?.serializedTransaction;
      if (!raw) throw new Error('Missing Solana transaction in step item');
      const buf = typeof raw === 'string' ? Buffer.from(raw, 'base64') : raw;
      const serialized = new Uint8Array(buf);
      return signAndSendTransaction(serialized);
    },
    handleConfirmTransactionStep: async (
      txHash: string,
      _chainId: number,
      _onReplaced?: () => void,
      _onCancelled?: () => void
    ) => {
      const maxAttempts = 60;
      for (let i = 0; i < maxAttempts; i++) {
        const status = await connection.getSignatureStatus(txHash);
        if (status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized') {
          return { signature: txHash, confirmed: true };
        }
        if (status?.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      throw new Error('Transaction confirmation timeout');
    },
  };
}
