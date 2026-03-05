/**
 * Maps Altair chain keys and token symbols to Relay API chain IDs and currency addresses.
 * Used by Chat bridge/cross-chain swap intents.
 *
 * Native currency on Relay: For all chains (EVM and Solana), Relay's quote API expects
 * the zero address 0x0000000000000000000000000000000000000000 for native currency
 * (ETH, SOL, etc.). See https://docs.relay.link/references/api/get-quote-v2
 * (originCurrency/destinationCurrency default) and Get Currencies (isNative).
 */
import type { ChainKey } from '../config/blockchain_config';
import { BASE_MAINNET, BASE_SEPOLIA, ETH_MAINNET, ETH_SEPOLIA } from '../config/chain_info';
import * as BaseTokens from '../config/token_info/base_tokens';
import * as BaseSepoliaTokens from '../config/token_info/base_testnet_sepolia_tokens';
import * as EthTokens from '../config/token_info/eth_tokens';
import * as EthSepoliaTokens from '../config/token_info/eth_sepolia_testnet_tokens';
import {
  RELAY_SOLANA_MAINNET_CHAIN_ID,
  RELAY_SOLANA_DEVNET_CHAIN_ID,
} from '../lib/relayAdapters';

const NATIVE_EVM = '0x0000000000000000000000000000000000000000';

const MAINNET_CHAIN_IDS: Record<Exclude<ChainKey, 'SOLANA_MAINNET'>, number> = {
  ETH_MAINNET: ETH_MAINNET.chainId,
  BASE_MAINNET: BASE_MAINNET.chainId,
  ETH_SEPOLIA: ETH_SEPOLIA.chainId,
  BASE_SEPOLIA: BASE_SEPOLIA.chainId,
};

const RELAY_MAINNET_CHAIN_IDS: Record<ChainKey, number> = {
  ...MAINNET_CHAIN_IDS,
  SOLANA_MAINNET: RELAY_SOLANA_MAINNET_CHAIN_ID,
};

const RELAY_TESTNET_CHAIN_IDS: Record<ChainKey, number> = {
  ETH_MAINNET: ETH_SEPOLIA.chainId,
  BASE_MAINNET: BASE_SEPOLIA.chainId,
  ETH_SEPOLIA: ETH_SEPOLIA.chainId,
  BASE_SEPOLIA: BASE_SEPOLIA.chainId,
  SOLANA_MAINNET: RELAY_SOLANA_DEVNET_CHAIN_ID,
};

export function getRelayChainId(chainKey: ChainKey, testnet: boolean): number {
  return testnet ? RELAY_TESTNET_CHAIN_IDS[chainKey] : RELAY_MAINNET_CHAIN_IDS[chainKey];
}

/** In Playground, Relay only supports these chains for bridge/cross-chain (Base Sepolia 84532, Ethereum Sepolia 11155111). */
export const RELAY_PLAYGROUND_CHAIN_KEYS: readonly ChainKey[] = ['BASE_SEPOLIA', 'ETH_SEPOLIA'] as const;

export function isRelayPlaygroundAllowedChain(chainKey: ChainKey): boolean {
  return (RELAY_PLAYGROUND_CHAIN_KEYS as readonly string[]).includes(chainKey);
}

type TokenMap = Record<string, { address: string; decimals: number }>;

function toMap(
  mod: Record<string, { address?: string; symbol?: string; decimals?: number }>
): TokenMap {
  return Object.values(mod).reduce<TokenMap>((acc, t) => {
    if (t?.symbol && t.address) acc[t.symbol.toUpperCase()] = { address: t.address, decimals: t.decimals ?? 18 };
    return acc;
  }, {});
}

const ETH_MAINNET_TOKENS = toMap(EthTokens as Record<string, { address?: string; symbol?: string; decimals?: number }>);
const BASE_MAINNET_TOKENS = toMap(BaseTokens as Record<string, { address?: string; symbol?: string; decimals?: number }>);
const ETH_SEPOLIA_TOKENS = toMap(EthSepoliaTokens as Record<string, { address?: string; symbol?: string; decimals?: number }>);
const BASE_SEPOLIA_TOKENS = toMap(BaseSepoliaTokens as Record<string, { address?: string; symbol?: string; decimals?: number }>);

export function getCurrencyAddress(
  chainKey: ChainKey,
  symbol: string,
  testnet: boolean
): string {
  const upper = symbol.toUpperCase().trim();
  if (chainKey === 'SOLANA_MAINNET') {
    // Relay uses 0x0 for native SOL on Solana (same as EVM native). See get-quote-v2 docs.
    if (upper === 'SOL' || upper === 'ETH') return NATIVE_EVM;
    return NATIVE_EVM;
  }
  if (upper === 'ETH') return NATIVE_EVM;
  const map =
    chainKey === 'ETH_MAINNET'
      ? ETH_MAINNET_TOKENS
      : chainKey === 'BASE_MAINNET'
        ? BASE_MAINNET_TOKENS
        : chainKey === 'ETH_SEPOLIA'
          ? ETH_SEPOLIA_TOKENS
          : BASE_SEPOLIA_TOKENS;
  const t = map[upper];
  return t?.address ?? NATIVE_EVM;
}

export function getCurrencyDecimals(
  chainKey: ChainKey,
  symbol: string
): number {
  const upper = symbol.toUpperCase().trim();
  if (upper === 'ETH' || upper === 'SOL') return 18;
  const map =
    chainKey === 'ETH_MAINNET'
      ? ETH_MAINNET_TOKENS
      : chainKey === 'BASE_MAINNET'
        ? BASE_MAINNET_TOKENS
        : chainKey === 'ETH_SEPOLIA'
          ? ETH_SEPOLIA_TOKENS
          : BASE_SEPOLIA_TOKENS;
  return map[upper]?.decimals ?? 18;
}

export function parseRelayChainKey(name: string): ChainKey | null {
  const n = name.toUpperCase().replace(/\s+/g, '_');
  const keys: ChainKey[] = [
    'ETH_MAINNET',
    'BASE_MAINNET',
    'SOLANA_MAINNET',
    'ETH_SEPOLIA',
    'BASE_SEPOLIA',
  ];
  if (keys.includes(n as ChainKey)) return n as ChainKey;
  if (/^ETH(EREUM)?(\s*MAINNET)?$/i.test(name)) return 'ETH_MAINNET';
  if (/^BASE(\s*MAINNET)?$/i.test(name)) return 'BASE_MAINNET';
  if (/^SOLANA(\s*MAINNET)?$/i.test(name)) return 'SOLANA_MAINNET';
  if (/^SEPOLIA$/i.test(name) && name.toLowerCase().includes('eth')) return 'ETH_SEPOLIA';
  if (/^BASE\s*SEPOLIA$/i.test(name)) return 'BASE_SEPOLIA';
  return null;
}
