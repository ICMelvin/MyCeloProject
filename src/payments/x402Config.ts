import * as dotenv from 'dotenv';
import { toDataSuffix } from '@celo/attribution-tags';

dotenv.config();

// ─── ERC-8021 Attribution Tags ───────────────────────────────────────────────
export const ASSIGNED_ATTRIBUTION_TAG = 'celo_4d19a013cc70';
export const INTERNAL_APP_TAG = 'falconguard_scan';

/**
 * Returns the hex calldata suffix containing both internal and assigned
 * Celo hackathon attribution tags, per ERC-8021.
 */
export function getAttributionDataSuffix(): `0x${string}` {
  return toDataSuffix([INTERNAL_APP_TAG, ASSIGNED_ATTRIBUTION_TAG]) as `0x${string}`;
}

// ─── Network Configuration ───────────────────────────────────────────────────
// Celo Sepolia testnet (Chain ID 11142220)
// Celo Mainnet          (Chain ID 42220)
const IS_MAINNET = process.env.NETWORK === 'celo-mainnet';

export const CELO_NETWORK = IS_MAINNET ? 'eip155:42220' : 'eip155:11142220';

// USDC contract addresses (EIP-3009 compatible, required by x402 facilitator)
// cUSD / USDm use EIP-2612 (permit) and are NOT supported by x402.celo.org
// Can be overridden via USDC_ADDRESS env var
export const USDC_ADDRESS = (process.env.USDC_ADDRESS as `0x${string}`) || (
  IS_MAINNET
    ? '0xcEBA9300f2b948710d2653dD7B07f33A8B32118C'   // USDC — Celo Mainnet
    : '0x01C5C0122039549AD1493B8220cABEdD739BC44E'   // USDC — Celo Sepolia
);

// ─── x402 Payment Asset Config ───────────────────────────────────────────────
export const USDC_ASSET_CONFIG = {
  address: USDC_ADDRESS as `0x${string}`,
  decimals: 6,
  eip712: {
    name: 'USDC',
    version: '2',
  },
};

// ─── x402 Config ───────────────────────────────────────────────────────────────
export const X402_CONFIG = {
  // Seller wallet — all scan payments land here
  payTo: (process.env.PAYTO_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`,

  network: CELO_NETWORK,
  facilitatorUrl: process.env.FACILITATOR_URL || 'https://x402.celo.org',
  pricePerScan: process.env.PRICE_PER_SCAN || '$0.10',

  // ERC-8021 attribution
  attributionTag: ASSIGNED_ATTRIBUTION_TAG,
  dataSuffix: getAttributionDataSuffix(),
} as const;
