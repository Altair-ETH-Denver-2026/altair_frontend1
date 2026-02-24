export const BLOCKCHAIN = 'ETH_SEPOLIA' as const;
export const WRAP_ETH = true;

export const CHAINS = {
  BASE_SEPOLIA: 'BASE_SEPOLIA',
  ETH_SEPOLIA: 'ETH_SEPOLIA',
  ETH_MAINNET: 'ETH_MAINNET',
  BASE_MAINNET: 'BASE_MAINNET',
} as const;

export type ChainKey = keyof typeof CHAINS;
