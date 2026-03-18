// ⚠️⚠️⚠️ CRITICAL SYNCHRONIZATION WARNING ⚠️⚠️⚠️
// This file MUST be kept IDENTICAL to altair_backend1/config/blockchain_config.ts
// Any change made here MUST be duplicated in the other file immediately.
// Failure to synchronize will cause runtime errors and broken functionality.
//
// REASON: Both frontend and backend need identical blockchain configuration
// for token lists, chain definitions, and other shared constants.
//
// ✅ DO: Copy any addition/modification to both files
// ❌ DON'T: Modify only one file
//
// Last verified sync: $(date) - Ensure both files match line-for-line
// ⚠️⚠️⚠️ END WARNING ⚠️⚠️⚠️

export const BLOCKCHAIN = 'BASE_MAINNET' as const; // default chain context used by Altair's frontend to drive blockchain-specific UI and swap flows
export const WRAP_ETH = false; // toggle to auto-wrap native ETH for ERC-20 style swaps in Altair's blockchain workflows

export const CHAINS = {
  BASE_SEPOLIA: 'BASE_SEPOLIA', // Base testnet key used to tag chain-specific assets and routes in the project
  ETH_SEPOLIA: 'ETH_SEPOLIA', // Ethereum testnet key used for Altair's test swap and balance flows
  ETH_MAINNET: 'ETH_MAINNET', // Ethereum mainnet key for production swaps and portfolio data
  BASE_MAINNET: 'BASE_MAINNET', // Base mainnet key for production swaps and portfolio data
  SOLANA_MAINNET: 'SOLANA_MAINNET', // Solana mainnet key for Solana wallet, balances, and swap logic
} as const;

export type ChainKey = keyof typeof CHAINS; // union type for every supported chain identifier in Altair

export const GAS_RESERVES = {
  BASE_SEPOLIA: '0.001',
  ETH_SEPOLIA: '0.001',
  ETH_MAINNET: '0.01',
  BASE_MAINNET: '0.0005',
  SOLANA_MAINNET: '0.02',
};

export const GAS_TOKENS = {
  BASE_SEPOLIA: 'ETH',
  ETH_SEPOLIA: 'ETH',
  ETH_MAINNET: 'ETH',
  BASE_MAINNET: 'ETH',
  SOLANA_MAINNET: 'SOL',
};

export const FORCE_QUERY_CHAINS = {
  balances:  {
    login: true,
    refresh: true,
    openWallet: false,
    changeChain: false
  }
};

export const DEFAULT_TOKENS = {
    ETH_MAINNET: ['ETH', 'WETH', 'WSOL', 'USDC', 'DAI'],
    ETH_SEPOLIA: ['ETH', 'WETH', 'WSOL', 'USDC', 'DAI'],
    BASE_MAINNET: ['ETH', 'WETH', 'WSOL', 'USDC', 'DAI'],
    BASE_SEPOLIA: ['ETH', 'WETH', 'WSOL', 'USDC', 'DAI'],
    SOLANA_MAINNET: ['SOL', 'WETH', 'WBTC', 'USDC', 'USDu'],
};