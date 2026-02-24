// Default to Base Sepolia so 0x swap quotes are more likely to find a route
export const BLOCKCHAIN = 'BASE_SEPOLIA' as const;
export const WRAP_ETH = true;

export const CHAINS = {
  BASE_SEPOLIA: 'BASE_SEPOLIA',
  ETH_SEPOLIA: 'ETH_SEPOLIA',
  ETH_MAINNET: 'ETH_MAINNET',
  BASE_MAINNET: 'BASE_MAINNET',
  ARBITRUM_ONE: 'ARBITRUM_ONE',
} as const;

export type ChainKey = keyof typeof CHAINS;
