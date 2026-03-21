import { CHAINS, type ChainKey } from '../../config/blockchain_config';
import { BASE_MAINNET, BASE_SEPOLIA, ETH_MAINNET, ETH_SEPOLIA, SOLANA_MAINNET, SOLANA_DEVNET } from '../../config/chain_info';
import * as BaseTokens from '../../config/token_info/base_tokens';
import * as BaseSepoliaTokens from '../../config/token_info/base_testnet_sepolia_tokens';
import * as EthTokens from '../../config/token_info/eth_tokens';
import * as EthSepoliaTokens from '../../config/token_info/eth_sepolia_testnet_tokens';
import * as SolanaTokens from '../../config/token_info/solana_tokens';

type TokenInfo = { address: string; decimals: number; symbol?: string };

export const RELAY_NATIVE_TOKEN = '0x0000000000000000000000000000000000000000';

const chainIdByKey: Record<ChainKey, number> = {
  BASE_MAINNET: BASE_MAINNET.chainId,
  BASE_SEPOLIA: BASE_SEPOLIA.chainId,
  ETH_MAINNET: ETH_MAINNET.chainId,
  ETH_SEPOLIA: ETH_SEPOLIA.chainId,
  SOLANA_MAINNET: SOLANA_MAINNET.chainId ?? 792703809,
  SOLANA_DEVNET: SOLANA_DEVNET.chainId ?? 901901901,
};

const buildTokenMap = (tokensModule: Record<string, TokenInfo>): Record<string, TokenInfo> => {
  const map: Record<string, TokenInfo> = {};
  Object.entries(tokensModule).forEach(([key, token]) => {
    if (!token || typeof token !== 'object') return;
    const address = typeof token.address === 'string' ? token.address : '';
    const decimals = typeof token.decimals === 'number' ? token.decimals : undefined;
    if (!address || address.length < 4 || decimals === undefined) return;
    const symbol = typeof token.symbol === 'string' && token.symbol.length > 0 ? token.symbol : key;
    map[symbol.toUpperCase()] = { ...token, symbol };
  });
  return map;
};

const tokenConfigs: Record<ChainKey, Record<string, TokenInfo>> = {
  BASE_SEPOLIA: buildTokenMap(BaseSepoliaTokens as Record<string, TokenInfo>),
  ETH_SEPOLIA: buildTokenMap(EthSepoliaTokens as Record<string, TokenInfo>),
  ETH_MAINNET: buildTokenMap(EthTokens as Record<string, TokenInfo>),
  BASE_MAINNET: buildTokenMap(BaseTokens as Record<string, TokenInfo>),
  SOLANA_MAINNET: buildTokenMap(SolanaTokens as Record<string, TokenInfo>),
  SOLANA_DEVNET: buildTokenMap(SolanaTokens as Record<string, TokenInfo>),
};

const normalizeChainKey = (input: string): ChainKey | null => {
  const raw = input?.trim?.() ?? '';
  if (!raw) return null;
  if (raw in CHAINS) return raw as ChainKey;
  const normalized = raw.toLowerCase().replace(/[\s_-]+/g, '');
  const aliasMap: Record<string, ChainKey> = {
    ethereum: 'ETH_MAINNET',
    ethereummainnet: 'ETH_MAINNET',
    eth: 'ETH_MAINNET',
    ethmainnet: 'ETH_MAINNET',
    ethereumsepolia: 'ETH_SEPOLIA',
    ethereumsepoliatestnet: 'ETH_SEPOLIA',
    sepolia: 'ETH_SEPOLIA',
    ethsepolia: 'ETH_SEPOLIA',
    base: 'BASE_MAINNET',
    basemainnet: 'BASE_MAINNET',
    basesepolia: 'BASE_SEPOLIA',
    basesepoliatestnet: 'BASE_SEPOLIA',
    solana: 'SOLANA_MAINNET',
    solanamainnet: 'SOLANA_MAINNET',
    solanadevnet: 'SOLANA_DEVNET',
    devnet: 'SOLANA_DEVNET',
  };
  if (aliasMap[normalized]) return aliasMap[normalized];
  const normalizedKey = raw.trim().toUpperCase();
  if (normalizedKey in CHAINS) return normalizedKey as ChainKey;
  return null;
};

export const resolveRelayChainId = (chainKey: string): number | null => {
  const normalizedKey = normalizeChainKey(chainKey);
  if (!normalizedKey) return null;
  return chainIdByKey[normalizedKey] ?? null;
};

export const resolveRelayToken = (chainKey: string, symbol: string) => {
  const normalizedKey = normalizeChainKey(chainKey);
  if (!normalizedKey) return null;
  const tokenMap = tokenConfigs[normalizedKey];
  const normalized = symbol.toUpperCase();
  if (normalized === 'ETH' && normalizedKey !== 'SOLANA_MAINNET' && normalizedKey !== 'SOLANA_DEVNET') {
    return { address: RELAY_NATIVE_TOKEN, decimals: 18, symbol: 'ETH' };
  }
  return tokenMap[normalized] ?? null;
};

export const toBaseUnits = (amount: string, decimals: number): string => {
  const [whole, fraction = ''] = amount.split('.');
  const padded = fraction.padEnd(decimals, '0').slice(0, decimals);
  return `${whole}${padded}`.replace(/^0+(?=\d)/, '') || '0';
};
