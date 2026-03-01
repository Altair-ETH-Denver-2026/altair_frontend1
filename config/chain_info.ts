export const ALCHEMY_API_KEY_PLACEHOLDER = 'NEXT_PUBLIC_ALCHEMY_API_KEY'; // placeholder token injected into RPC URLs to pull the Alchemy key at runtime

export const resolveRpcUrls = (rpcUrls: string[]) => {
  const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY; // reads the browser-safe Alchemy key for blockchain RPC access
  const resolved = rpcUrls
    .map((url) => (apiKey ? url.replace(ALCHEMY_API_KEY_PLACEHOLDER, apiKey) : url)) // substitutes the key so Altair can connect to the configured chain
    .filter((url) => !url.includes(ALCHEMY_API_KEY_PLACEHOLDER)); // drops URLs that still require a missing key to avoid broken RPC calls
  console.log('[RPC] resolveRpcUrls input:', rpcUrls); // debug log for RPC inputs used by chain config
  console.log('[RPC] resolveRpcUrls output:', resolved); // debug log for resolved RPC endpoints
  return resolved; // returns usable RPC URLs for the swap/balance pipelines
};

export const BASE_SEPOLIA = {
  chainId: 84532, // Base Sepolia chain ID used to initialize EVM providers
  rpcUrls: [
    `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY_PLACEHOLDER}`, // primary Base Sepolia RPC (Alchemy)
    'https://sepolia.base.org', // fallback Base Sepolia RPC for redundancy
  ],
  scanUrl: 'https://sepolia.basescan.org', // block explorer base URL for transaction links
  uniswapAddresses: {
    router: '0x050E797f3625EC8785265e1d9BDd4799b97528A1', // Uniswap router used by Altair swaps on Base Sepolia
    factory: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24', // Uniswap factory address for pool discovery on Base Sepolia
    swapRouter: '0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4', // Uniswap V3 swap router for Base Sepolia trades
  },
};

export const ETH_SEPOLIA = {
  chainId: 11155111, // Ethereum Sepolia chain ID for testnet EVM operations
  rpcUrls: [
    `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY_PLACEHOLDER}`, // primary Ethereum Sepolia RPC (Alchemy)
    'https://rpc.sepolia.org', // fallback Sepolia RPC endpoint
  ],
  scanUrl: 'https://sepolia.etherscan.io', // block explorer base URL for Sepolia transactions
  uniswapAddresses: {
    router: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD', // Uniswap router used by Altair swaps on Sepolia
    factory: '0x0227628f3F023bb0B980b67D528571c95c6DaC1c', // Uniswap factory address for Sepolia liquidity pools
    swapRouter: '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E', // Uniswap V3 swap router for Sepolia trades
  },
};

export const ETH_MAINNET = {
  chainId: 1, // Ethereum mainnet chain ID for production EVM connections
  rpcUrls: [
    `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY_PLACEHOLDER}`, // primary Ethereum mainnet RPC (Alchemy)
    'https://cloudflare-eth.com', // public fallback Ethereum RPC
  ],
  scanUrl: 'https://etherscan.io', // block explorer base URL for mainnet transactions
  uniswapAddresses: {
    router: '', // placeholder for mainnet Uniswap router when enabled
    factory: '', // placeholder for mainnet Uniswap factory when enabled
    swapRouter: '', // placeholder for mainnet Uniswap V3 router when enabled
  },
};

export const BASE_MAINNET = {
  chainId: 8453, // Base mainnet chain ID for production EVM connections
  rpcUrls: [
    `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY_PLACEHOLDER}`, // primary Base mainnet RPC (Alchemy)
    'https://mainnet.base.org', // public fallback Base RPC endpoint
  ],
  scanUrl: 'https://basescan.org', // block explorer base URL for Base mainnet transactions
  uniswapAddresses: {
    router: '', // placeholder for Base mainnet Uniswap router when enabled
    factory: '', // placeholder for Base mainnet Uniswap factory when enabled
    swapRouter: '', // placeholder for Base mainnet Uniswap V3 router when enabled
  },
};

export const SOLANA_MAINNET = {
  rpcUrls: [
    'https://api.mainnet-beta.solana.com/', // Solana mainnet RPC for wallet, balances, and swap routes
  ],
  scanUrl: 'https://solscan.io', // block explorer base URL for Solana transactions
};
