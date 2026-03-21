// ⚠️⚠️⚠️ CRITICAL SYNCHRONIZATION WARNING ⚠️⚠️⚠️
// This file MUST be kept IDENTICAL to altair_backend1/config/chain_info.ts
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
  name: 'Base Sepolia',
  isTestnet: true,
  chainId: 84532, // Base Sepolia chain ID used to initialize EVM providers
  rpcUrls: [
    `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY_PLACEHOLDER}`, // primary Base Sepolia RPC (Alchemy)
    'https://sepolia.base.org', // fallback Base Sepolia RPC for redundancy
  ],
  explorerUrl: 'https://sepolia.basescan.org', // block explorer base URL for transaction links
  uniswapAddresses: {
    router: '0x050E797f3625EC8785265e1d9BDd4799b97528A1', // Uniswap router used by Altair swaps on Base Sepolia
    factory: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24', // Uniswap factory address for pool discovery on Base Sepolia
    swapRouter: '0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4', // Uniswap V3 swap router for Base Sepolia trades
  },
};

export const ETH_SEPOLIA = {
  name: 'Sepolia',
  isTestnet: true,
  chainId: 11155111, // Ethereum Sepolia chain ID for testnet EVM operations
  rpcUrls: [
    `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY_PLACEHOLDER}`, // primary Ethereum Sepolia RPC (Alchemy)
    'https://rpc.sepolia.org', // fallback Sepolia RPC endpoint
  ],
  explorerUrl: 'https://sepolia.etherscan.io', // block explorer base URL for Sepolia transactions
  uniswapAddresses: {
    router: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD', // Uniswap router used by Altair swaps on Sepolia
    factory: '0x0227628f3F023bb0B980b67D528571c95c6DaC1c', // Uniswap factory address for Sepolia liquidity pools
    swapRouter: '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E', // Uniswap V3 swap router for Sepolia trades
  },
};

export const ETH_MAINNET = {
  name: 'Ethereum Mainnet',
  isTestnet: false,
  chainId: 1, // Ethereum mainnet chain ID for production EVM connections
  rpcUrls: [
    `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY_PLACEHOLDER}`, // primary Ethereum mainnet RPC (Alchemy)
    'https://cloudflare-eth.com', // public fallback Ethereum RPC
  ],
  explorerUrl: 'https://etherscan.io', // block explorer base URL for mainnet transactions
  uniswapAddresses: {
    router: '', // placeholder for mainnet Uniswap router when enabled
    factory: '', // placeholder for mainnet Uniswap factory when enabled
    swapRouter: '', // placeholder for mainnet Uniswap V3 router when enabled
  },
};

export const BASE_MAINNET = {
  name: 'Base Mainnet',
  isTestnet: false,
  chainId: 8453, // Base mainnet chain ID for production EVM connections
  rpcUrls: [
    `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY_PLACEHOLDER}`, // primary Base mainnet RPC (Alchemy)
    'https://mainnet.base.org', // public fallback Base RPC endpoint
  ],
  explorerUrl: 'https://basescan.org', // block explorer base URL for Base mainnet transactions
  uniswapAddresses: {
    router: '', // placeholder for Base mainnet Uniswap router when enabled
    factory: '', // placeholder for Base mainnet Uniswap factory when enabled
    swapRouter: '', // placeholder for Base mainnet Uniswap V3 router when enabled
  },
};

export const SOLANA_MAINNET = {
  name: 'Solana Mainnet',
  isTestnet: false,
  chainId: 792703809,
  rpcUrls: [
    'https://api.mainnet-beta.solana.com/', // Solana mainnet RPC for wallet, balances, and swap routes
  ],
  explorerUrl: 'https://solscan.io', // block explorer base URL for Solana transactions
};

export const SOLANA_DEVNET = {
  name: 'Solana Devnet',
  isTestnet: true,
  chainId: 901,
  rpcUrls: [
    'https://api.devnet.solana.com/', // Solana devnet RPC for wallet, balances, and swap routes
  ],
  explorerUrl: 'https://solscan.io/?cluster=devnet', // block explorer base URL for Solana devnet transactions
};

export const RELAY_CHAIN_INFO: Record<string, { chainId: number; explorerUrl?: string; rpcUrls: string[] }> = {
  ethereum: { chainId: 1, explorerUrl: 'https://etherscan.io', rpcUrls: [] },
  optimism: { chainId: 10, explorerUrl: 'https://optimistic.etherscan.io', rpcUrls: [] },
  cronos: { chainId: 25, explorerUrl: 'https://cronoscan.com', rpcUrls: [] },
  bsc: { chainId: 56, explorerUrl: 'https://bscscan.com', rpcUrls: [] },
  gnosis: { chainId: 100, explorerUrl: 'https://gnosisscan.io', rpcUrls: [] },
  unichain: { chainId: 130, explorerUrl: 'https://uniscan.xyz', rpcUrls: [] },
  polygon: { chainId: 137, explorerUrl: 'https://polygonscan.com', rpcUrls: [] },
  monad: { chainId: 143, explorerUrl: 'https://monadvision.com', rpcUrls: [] },
  sonic: { chainId: 146, explorerUrl: 'https://sonicscan.org', rpcUrls: [] },
  'manta-pacific': { chainId: 169, explorerUrl: 'https://pacific-explorer.manta.network', rpcUrls: [] },
  mint: { chainId: 185, explorerUrl: 'https://explorer.mintchain.io', rpcUrls: [] },
  boba: { chainId: 288, explorerUrl: 'https://bobascan.com', rpcUrls: [] },
  zksync: { chainId: 324, explorerUrl: 'https://explorer.zksync.io', rpcUrls: [] },
  shape: { chainId: 360, explorerUrl: 'https://shapescan.xyz', rpcUrls: [] },
  appchain: { chainId: 466, explorerUrl: 'https://explorer.appchain.xyz', rpcUrls: [] },
  'world-chain': { chainId: 480, explorerUrl: 'https://worldscan.org', rpcUrls: [] },
  redstone: { chainId: 690, explorerUrl: 'https://explorer.redstone.xyz', rpcUrls: [] },
  'flow-evm': { chainId: 747, explorerUrl: 'https://evm.flowscan.io', rpcUrls: [] },
  stable: { chainId: 988, explorerUrl: 'https://stablescan.xyz', rpcUrls: [] },
  hyperevm: { chainId: 999, explorerUrl: 'https://hyperevmscan.io', rpcUrls: [] },
  metis: { chainId: 1088, explorerUrl: 'https://explorer.metis.io', rpcUrls: [] },
  'polygon-zkevm': { chainId: 1101, explorerUrl: 'https://zkevm.polygonscan.com', rpcUrls: [] },
  lisk: { chainId: 1135, explorerUrl: 'https://blockscout.lisk.com', rpcUrls: [] },
  sei: { chainId: 1329, explorerUrl: 'https://seitrace.com', rpcUrls: [] },
  hyperliquid: { chainId: 1337, explorerUrl: 'https://app.hyperliquid.xyz/explorer', rpcUrls: [] },
  perennial: { chainId: 1424, explorerUrl: 'https://explorer.perennial.foundation', rpcUrls: [] },
  story: { chainId: 1514, explorerUrl: 'https://storyscan.xyz', rpcUrls: [] },
  gravity: { chainId: 1625, explorerUrl: 'https://explorer.gravity.xyz', rpcUrls: [] },
  soneium: { chainId: 1868, explorerUrl: 'https://soneium.blockscout.com', rpcUrls: [] },
  swellchain: { chainId: 1923, explorerUrl: 'https://explorer.swellnetwork.io', rpcUrls: [] },
  ronin: { chainId: 2020, explorerUrl: 'https://app.roninchain.com', rpcUrls: [] },
  abstract: { chainId: 2741, explorerUrl: 'https://abscan.org', rpcUrls: [] },
  morph: { chainId: 2818, explorerUrl: 'https://explorer.morphl2.io', rpcUrls: [] },
  megaeth: { chainId: 4326, explorerUrl: 'https://megaeth.blockscout.com', rpcUrls: [] },
  mantle: { chainId: 5000, explorerUrl: 'https://mantlescan.xyz', rpcUrls: [] },
  somnia: { chainId: 5031, explorerUrl: 'https://explorer.somnia.network', rpcUrls: [] },
  superseed: { chainId: 5330, explorerUrl: 'https://explorer.superseed.xyz', rpcUrls: [] },
  cyber: { chainId: 7560, explorerUrl: 'https://cyberscan.co', rpcUrls: [] },
  'powerloom-v2': { chainId: 7869, explorerUrl: 'https://explorer-v2.powerloom.network', rpcUrls: [] },
  'arena-z': { chainId: 7897, explorerUrl: 'https://explorer.arena-z.gg', rpcUrls: [] },
  B3: { chainId: 8333, explorerUrl: 'https://explorer.b3.fun', rpcUrls: [] },
  base: { chainId: 8453, explorerUrl: 'https://basescan.org', rpcUrls: [] },
  plasma: { chainId: 9745, explorerUrl: 'https://plasmascan.to', rpcUrls: [] },
  apechain: { chainId: 33139, explorerUrl: 'https://apescan.io', rpcUrls: [] },
  funki: { chainId: 33979, explorerUrl: 'https://explorer.funkichain.com', rpcUrls: [] },
  mode: { chainId: 34443, explorerUrl: 'https://explorer.mode.network', rpcUrls: [] },
  mythos: { chainId: 42018, explorerUrl: 'https://mythos-mainnet.explorer.alchemy.com', rpcUrls: [] },
  arbitrum: { chainId: 42161, explorerUrl: 'https://arbiscan.io', rpcUrls: [] },
  'arbitrum-nova': { chainId: 42170, explorerUrl: 'https://nova.arbiscan.io', rpcUrls: [] },
  celo: { chainId: 42220, explorerUrl: 'https://celoscan.io', rpcUrls: [] },
  hemi: { chainId: 43111, explorerUrl: 'https://explorer.hemi.xyz', rpcUrls: [] },
  avalanche: { chainId: 43114, explorerUrl: 'https://snowtrace.io', rpcUrls: [] },
  gunz: { chainId: 43419, explorerUrl: 'https://gunzscan.io', rpcUrls: [] },
  zircuit: { chainId: 48900, explorerUrl: 'https://explorer.zircuit.com', rpcUrls: [] },
  superposition: { chainId: 55244, explorerUrl: 'https://explorer.superposition.so', rpcUrls: [] },
  ink: { chainId: 57073, explorerUrl: 'https://explorer.inkonchain.com', rpcUrls: [] },
  linea: { chainId: 59144, explorerUrl: 'https://lineascan.build', rpcUrls: [] },
  bob: { chainId: 60808, explorerUrl: 'https://explorer.gobob.xyz', rpcUrls: [] },
  animechain: { chainId: 69000, explorerUrl: 'https://explorer-animechain-39xf6m45e3.t.conduit.xyz', rpcUrls: [] },
  berachain: { chainId: 80094, explorerUrl: 'https://beratrail.io', rpcUrls: [] },
  blast: { chainId: 81457, explorerUrl: 'https://blastscan.io', rpcUrls: [] },
  plume: { chainId: 98866, explorerUrl: 'https://explorer.plume.org', rpcUrls: [] },
  taiko: { chainId: 167000, explorerUrl: 'https://taikoscan.io', rpcUrls: [] },
  syndicate: { chainId: 510003, explorerUrl: 'https://commons.explorer.syndicate.io', rpcUrls: [] },
  scroll: { chainId: 534352, explorerUrl: 'https://scrollscan.com', rpcUrls: [] },
  'zero-network': { chainId: 543210, explorerUrl: 'https://explorer.zero.network', rpcUrls: [] },
  xai: { chainId: 660279, explorerUrl: 'https://explorer.xai-chain.net', rpcUrls: [] },
  katana: { chainId: 747474, explorerUrl: 'https://explorer.katanarpc.com', rpcUrls: [] },
  lighter: { chainId: 3586256, explorerUrl: 'https://lighter.exchange/explorer', rpcUrls: [] },
  ethereal: { chainId: 5064014, explorerUrl: 'https://explorer.ethereal.trade', rpcUrls: [] },
  zora: { chainId: 7777777, explorerUrl: 'https://explorer.zora.energy', rpcUrls: [] },
  bitcoin: { chainId: 8253038, explorerUrl: 'https://mempool.space', rpcUrls: [] },
  eclipse: { chainId: 9286185, explorerUrl: 'https://eclipsescan.xyz', rpcUrls: [] },
  soon: { chainId: 9286186, explorerUrl: 'https://explorer.soo.network', rpcUrls: [] },
  corn: { chainId: 21000000, explorerUrl: 'https://cornscan.io', rpcUrls: [] },
  degen: { chainId: 666666666, explorerUrl: 'https://explorer.degen.tips', rpcUrls: [] },
  tron: { chainId: 728126428, explorerUrl: 'https://tronscan.org/#', rpcUrls: [] },
  solana: { chainId: 792703809, explorerUrl: 'https://solscan.io', rpcUrls: [] },
  ancient8: { chainId: 888888888, explorerUrl: 'https://scan.ancient8.gg', rpcUrls: [] },
  rari: { chainId: 1380012617, explorerUrl: 'https://mainnet.explorer.rarichain.org', rpcUrls: [] },
};