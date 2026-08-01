import * as dotenv from 'dotenv';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celoSepolia } from 'viem/chains';
import { X402_CONFIG, getAttributionDataSuffix } from '../payments/x402Config.js';

dotenv.config();

// Contract addresses for automated volume testing
const CONTRACT_QUEUE = [
  './test-contracts/VulnerableVault.sol',
  './test-contracts/UnsafeDelegate.sol',
];

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000/scan';
const PRIVATE_KEY = process.env.CLIENT_AGENT_PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000000';

async function runAutoScanner() {
  console.log('[FalconGuard Client-Agent] Starting autonomous scanning queue...');
  console.log(`[FalconGuard Client-Agent] Using ERC-8021 Attribution Tag: ${X402_CONFIG.attributionTag}`);

  if (PRIVATE_KEY === '0x0000000000000000000000000000000000000000000000000000000000000000') {
    console.warn('[FalconGuard Client-Agent] WARNING: Using dummy private key in .env. Real x402 signing requires setting CLIENT_AGENT_PRIVATE_KEY in .env');
  } else {
    const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
    console.log(`[FalconGuard Client-Agent] Agent Wallet initialized: ${account.address}`);
  }

  // Get attribution suffix calldata to append to all transaction payment authorizations
  const attributionDataSuffix = getAttributionDataSuffix();

  for (const contractPath of CONTRACT_QUEUE) {
    console.log(`\n[FalconGuard Client-Agent] Queueing scan for: ${contractPath}`);

    try {
      /*
       * TODO: Aug 3/4 Implementation Step - x402 EIP-3009 Payment Signature Generation
       * Generate transferWithAuthorization signature incorporating attributionDataSuffix
       * Include Payment Header (X-PAYMENT) in POST request
       */

      const response = await fetch(SERVER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // 'X-PAYMENT': paymentHeaderSignature
        },
        body: JSON.stringify({ contractPath }),
      });

      if (response.status === 402) {
        console.log(`[FalconGuard Client-Agent] Server requested payment (HTTP 402):`, await response.json());
      } else if (response.ok) {
        const report = await response.json();
        console.log(`[FalconGuard Client-Agent] Scan successful! Report Summary:`);
        console.log(`  Scan ID: ${report.scanId}`);
        console.log(`  Target: ${report.target}`);
        console.log(`  Total Findings: ${report.summary.totalFindings} (Critical: ${report.summary.critical}, High: ${report.summary.high})`);
      } else {
        console.error(`[FalconGuard Client-Agent] Failed with status ${response.status}:`, await response.text());
      }
    } catch (err: any) {
      console.error(`[FalconGuard Client-Agent] Network/Execution Error: ${err.message}`);
    }
  }

  console.log('\n[FalconGuard Client-Agent] Batch queue processing complete.');
}

runAutoScanner();
