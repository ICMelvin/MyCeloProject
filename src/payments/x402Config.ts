import * as dotenv from 'dotenv';
import { toDataSuffix } from '@celo/attribution-tags';

dotenv.config();

export const ASSIGNED_ATTRIBUTION_TAG = 'celo_4d19a013cc70';
export const INTERNAL_APP_TAG = 'falconguard_scan';

/**
 * Returns the hex calldata suffix containing both internal and assigned Celo hackathon attribution tags
 */
export function getAttributionDataSuffix(): `0x${string}` {
  return toDataSuffix([INTERNAL_APP_TAG, ASSIGNED_ATTRIBUTION_TAG]) as `0x${string}`;
}

export const X402_CONFIG = {
  payTo: process.env.PAYTO_ADDRESS || '0x0000000000000000000000000000000000000000',
  network: process.env.NETWORK || 'celoSepolia',
  facilitatorUrl: process.env.FACILITATOR_URL || 'https://x402.celo.org',
  pricePerScan: process.env.PRICE_PER_SCAN || '$0.01',
  thirdwebClientId: process.env.THIRDWEB_CLIENT_ID || '',
  thirdwebSecretKey: process.env.THIRDWEB_SECRET_KEY || '',
  attributionTag: ASSIGNED_ATTRIBUTION_TAG,
  dataSuffix: getAttributionDataSuffix(),
};
