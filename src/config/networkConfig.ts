/**
 * Network Configuration for FalconGuard Scan-Agent
 * Single source of truth for network-specific URLs and addresses
 */

export interface NetworkConfig {
  chainId: number;
  networkName: 'celoSepolia' | 'celoMainnet';
  facilitatorUrl: string;
  explorerUrl: string;
  usdcAddress: `0x${string}`;
  rpcUrl: string;
}

export const NETWORK_CONFIGS: Record<number, NetworkConfig> = {
  // Celo Sepolia Testnet (Chain ID 11142220)
  11142220: {
    chainId: 11142220,
    networkName: 'celoSepolia',
    facilitatorUrl: 'https://api.x402.sepolia.celo.org',
    explorerUrl: 'https://sepolia.celoscan.io',
    usdcAddress: '0x01C5C0122039549AD1493B8220cABEdD739BC44E',
    rpcUrl: 'https://forno.celo-sepolia.celo-testnet.org',
  },
  // Celo Mainnet (Chain ID 42220)
  42220: {
    chainId: 42220,
    networkName: 'celoMainnet',
    facilitatorUrl: 'https://api.x402.celo.org',
    explorerUrl: 'https://celoscan.io',
    usdcAddress: '0xcEBA9300f2b948710d2653dD7B07f33A8B32118C',
    rpcUrl: 'https://forno.celo.org',
  },
};

/**
 * Get network configuration by chain ID
 * Throws error if chain ID is not supported
 */
export function getNetworkConfig(chainId: number): NetworkConfig {
  const config = NETWORK_CONFIGS[chainId];
  if (!config) {
    throw new Error(
      `Unsupported chain ID: ${chainId}. Supported networks: ${Object.keys(NETWORK_CONFIGS).join(', ')}`
    );
  }
  return config;
}

/**
 * Get network configuration from environment variable
 * Falls back to Celo Sepolia if NETWORK env var is not set
 */
export function getNetworkConfigFromEnv(): NetworkConfig {
  const network = process.env.NETWORK;
  if (network === 'celo-mainnet' || network === 'celo') {
    return NETWORK_CONFIGS[42220];
  }
  // Default to Celo Sepolia
  return NETWORK_CONFIGS[11142220];
}
