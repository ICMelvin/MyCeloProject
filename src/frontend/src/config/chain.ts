import { defineChain } from 'viem';

// ─── Celo Sepolia Testnet ─────────────────────────────────────────────────────
export const celoSepolia = defineChain({
  id: 11142220,
  name: 'Celo Sepolia',
  network: 'celo-sepolia',
  nativeCurrency: {
    decimals: 18,
    name: 'Celo',
    symbol: 'CELO',
  },
  rpcUrls: {
    default: { http: ['https://forno.celo-sepolia.celo-testnet.org'] },
    public:  { http: ['https://forno.celo-sepolia.celo-testnet.org'] },
  },
  blockExplorers: {
    default: {
      name: 'Celo Sepolia Explorer',
      url: 'https://sepolia.celoscan.io',
    },
  },
  testnet: true,
});

// ─── Celo Mainnet ─────────────────────────────────────────────────────────────
export const celoMainnet = defineChain({
  id: 42220,
  name: 'Celo',
  network: 'celo',
  nativeCurrency: {
    decimals: 18,
    name: 'Celo',
    symbol: 'CELO',
  },
  rpcUrls: {
    default: { http: ['https://forno.celo.org'] },
    public:  { http: ['https://forno.celo.org'] },
  },
  blockExplorers: {
    default: {
      name: 'Celo Explorer',
      url: 'https://celoscan.io',
    },
  },
  testnet: false,
});
