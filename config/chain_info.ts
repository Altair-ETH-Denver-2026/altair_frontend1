export const ALCHEMY_API_KEY_PLACEHOLDER = 'NEXT_PUBLIC_ALCHEMY_API_KEY';

export const resolveRpcUrls = (rpcUrls: string[]) => {
  const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  const resolved = rpcUrls
    .map((url) => (apiKey ? url.replace(ALCHEMY_API_KEY_PLACEHOLDER, apiKey) : url))
    .filter((url) => !url.includes(ALCHEMY_API_KEY_PLACEHOLDER));
  console.log('[RPC] resolveRpcUrls input:', rpcUrls);
  console.log('[RPC] resolveRpcUrls output:', resolved);
  return resolved;
};

export const BASE_SEPOLIA = {
  chainId: 84532,
  rpcUrls: [
    `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY_PLACEHOLDER}`,
    'https://sepolia.base.org',
  ],
  scanUrl: 'https://sepolia.basescan.org',
  uniswapAddresses: {
    router: '0x050E797f3625EC8785265e1d9BDd4799b97528A1',
    factory: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24',
    swapRouter: '0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4',
  },
};

export const ETH_SEPOLIA = {
  chainId: 11155111,
  rpcUrls: [
    `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY_PLACEHOLDER}`,
    'https://rpc.sepolia.org',
  ],
  scanUrl: 'https://sepolia.etherscan.io',
  uniswapAddresses: {
    router: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
    factory: '0x0227628f3F023bb0B980b67D528571c95c6DaC1c',
    swapRouter: '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E',
  },
};

export const ETH_MAINNET = {
  chainId: 1,
  rpcUrls: [
    `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY_PLACEHOLDER}`,
    'https://cloudflare-eth.com',
  ],
  scanUrl: 'https://etherscan.io',
  uniswapAddresses: {
    router: '',
    factory: '',
    swapRouter: '',
  },
};

export const BASE_MAINNET = {
  chainId: 8453,
  rpcUrls: [
    `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY_PLACEHOLDER}`,
    'https://mainnet.base.org',
  ],
  scanUrl: 'https://basescan.org',
  uniswapAddresses: {
    router: '',
    factory: '',
    swapRouter: '',
  },
};
