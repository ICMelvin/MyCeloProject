
/**
 * FalconGuard Scan-Agent — Autonomous Client
 *
 * Autonomously submits smart contracts to the x402-gated /scan endpoint.
 * Each request:
 *  1. Gets the HTTP 402 payment instructions from the server
 *  2. Signs an EIP-3009 transferWithAuthorization payload using the agent wallet
 *  3. Includes the ERC-8021 attribution data suffix (toDataSuffix)
 *  4. Retries the request with the X-PAYMENT header
 *  5. Logs every tx hash to tx-log.md for proof of activity
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { createWalletClient, http, createPublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celoAlfajores } from 'viem/chains';
import { x402HTTPClient, x402Client } from '@x402/core/client';
import { registerExactEvmScheme } from '@x402/evm/exact/client';
import { X402_CONFIG, ASSIGNED_ATTRIBUTION_TAG, INTERNAL_APP_TAG, USDC_ADDRESS, CELO_NETWORK } from '../payments/x402Config.js';

dotenv.config();

// ─── Config ───────────────────────────────────────────────────────────────────
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000/scan';
const PRIVATE_KEY = process.env.CLIENT_AGENT_PRIVATE_KEY as `0x${string}` | undefined;
const TX_LOG_PATH = path.resolve('./tx-log.md');

// Celo Sepolia chain definition for viem
// Chain ID 11142220
const celoSepolia = {
  ...celoAlfajores,
  id: 11142220,
  name: 'Celo Sepolia',
  network: 'celo-sepolia',
  rpcUrls: {
    default: {
      http: [process.env.RPC_URL || 'https://forno.celo-sepolia.celo-testnet.org'],
    },
    public: {
      http: [process.env.RPC_URL || 'https://forno.celo-sepolia.celo-testnet.org'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Celo Sepolia Explorer',
      url: 'https://explorer.sepolia.celo.org',
    },
  },
  testnet: true,
} as const;

// ─── Scan Targets ─────────────────────────────────────────────────────────────
// Mix of local test contracts (for dev) + real Celo ecosystem contract addresses
// Real addresses are passed as sourceCode via on-chain fetching or known code
const LOCAL_CONTRACTS = [
  './test-contracts/VulnerableVault.sol',
  './test-contracts/UnsafeDelegate.sol',
  './test-contracts/FlashLoanVulnerable.sol',
  './test-contracts/TimestampManipulation.sol',
  './test-contracts/GasLimitIssue.sol',
];

// Real Celo Sepolia ecosystem contracts to scan
const CELO_SEPOLIA_CONTRACTS = [
  // USDC on Celo Sepolia (officially supported by x402 facilitator)
  '0x01C5C0122039549AD1493B8220cABEdD739BC44E',
];

// ─── Tx Logger ────────────────────────────────────────────────────────────────
function initTxLog(): void {
  if (!fs.existsSync(TX_LOG_PATH)) {
    fs.writeFileSync(
      TX_LOG_PATH,
      `# FalconGuard Scan-Agent — Transaction Log\n\n` +
      `> ERC-8021 Attribution Tag: \`${ASSIGNED_ATTRIBUTION_TAG}\`\n` +
      `> Internal Tag: \`${INTERNAL_APP_TAG}\`\n` +
      `> Network: ${X402_CONFIG.network}\n\n` +
      `| # | Timestamp | Contract | Tx Hash | Explorer |\n` +
      `|---|-----------|----------|---------|----------|\n`,
    );
  }
}

function logTx(index: number, contractName: string, txHash: string): void {
  const explorerUrl = `https://explorer.sepolia.celo.org/tx/${txHash}`;
  const row = `| ${index} | ${new Date().toISOString()} | \`${contractName}\` | \`${txHash}\` | [View](${explorerUrl}) |\n`;
  fs.appendFileSync(TX_LOG_PATH, row);
  console.log(`  📝 Tx logged: ${explorerUrl}`);
}

// ─── Contract Source Fetcher ───────────────────────────────────────────────────
async function fetchContractSourceCode(
  address: string,
  publicClient: any,
): Promise<string | null> {
  try {
    // Try to get contract code from RPC
    const code = await publicClient.getBytecode({ address: address as `0x${string}` });
    if (code && code !== '0x') {
      // For now, return a placeholder indicating we have bytecode
      // In production, we'd use a block explorer API to get verified source code
      console.log(`  ℹ️  Contract at ${address} has bytecode (${code.length / 2 - 1} bytes)`);
      return `// Contract bytecode available at ${address}\n// Source code verification via block explorer required for full analysis`;
    }
    return null;
  } catch (err: any) {
    console.error(`  ❌ Failed to fetch contract code: ${err.message}`);
    return null;
  }
}

// ─── Payment Flow ─────────────────────────────────────────────────────────────
async function scanWithPayment(
  contractPath: string,
  walletClient: ReturnType<typeof createWalletClient>,
  account: ReturnType<typeof privateKeyToAccount>,
  scanIndex: number,
  publicClient?: any,
): Promise<void> {
  console.log(`\n[FalconGuard] Scanning: ${contractPath}`);

  const contractName = path.basename(contractPath);
  let sourceCode: string | undefined;
  let requestBody: Record<string, string>;

  // Check if it's a contract address (0x prefix)
  if (contractPath.startsWith('0x')) {
    // It's a real contract address - try to fetch source code
    if (publicClient) {
      const fetchedCode = await fetchContractSourceCode(contractPath, publicClient);
      if (fetchedCode) {
        sourceCode = fetchedCode;
        requestBody = { sourceCode };
      } else {
        console.error(`  ❌ Could not fetch source code for ${contractPath}`);
        return;
      }
    } else {
      console.error(`  ❌ Public client not available for fetching contract code`);
      return;
    }
  } else if (contractPath.startsWith('./') || contractPath.startsWith('/')) {
    // Load source code if local file
    const fullPath = path.resolve(contractPath);
    if (!fs.existsSync(fullPath)) {
      console.error(`  ❌ File not found: ${fullPath}`);
      return;
    }
    sourceCode = fs.readFileSync(fullPath, 'utf-8');
    requestBody = { sourceCode };
  } else {
    // Treat as a contract path identifier
    requestBody = { contractPath };
  }

  try {
    // Create x402 client with ExactEvmScheme
    const client = new x402Client();
    registerExactEvmScheme(client, {
      signer: account as any,
    });
    const httpClient = new x402HTTPClient(client);

    // ── Step 1: Initial request — expect 402 ──────────────────────────────
    const initialRes = await fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (initialRes.status !== 402) {
      if (initialRes.ok) {
        // Payment gate bypassed (dev mode / free)
        const report = await initialRes.json();
        console.log(`  ✅ Scan complete (no payment required in this mode)`);
        console.log(`     Findings: ${report.summary?.totalFindings ?? 'N/A'}`);
      } else {
        console.error(`  ❌ Unexpected status ${initialRes.status}: ${await initialRes.text()}`);
      }
      return;
    }

    // ── Step 2: Parse payment requirements using x402HTTPClient ──────────
    const paymentRequired = httpClient.getPaymentRequiredResponse(
      (name) => initialRes.headers.get(name),
      await initialRes.json(),
    );

    console.log(`  💳 Payment required (HTTP 402). Signing EIP-3009 authorization...`);

    // ── Step 3: Create payment payload ─────────────────────────────────
    const paymentPayload = await httpClient.createPaymentPayload(paymentRequired);

    // ── Step 4: Encode payment signature header ────────────────────────
    const paymentHeaders = httpClient.encodePaymentSignatureHeader(paymentPayload);

    console.log(`  🔏 Payment headers:`, JSON.stringify(paymentHeaders));

    // ── Step 5: Retry with payment ────────────────────────────────────────
    console.log(`  🔏 Payment header created. Submitting to facilitator...`);

    const paidRes = await fetch(SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...paymentHeaders,
      },
      body: JSON.stringify(requestBody),
    });

    // ── Step 6: Parse result ──────────────────────────────────────────────
    const result = await httpClient.processPaymentResult(
      paymentPayload,
      (name) => paidRes.headers.get(name),
      paidRes.status,
    );

    if (paidRes.ok) {
      const report = await paidRes.json();
      const totalFindings = report.summary?.totalFindings ?? 0;
      const critical = report.summary?.critical ?? 0;
      const high = report.summary?.high ?? 0;

      console.log(`  ✅ Scan successful!`);
      console.log(`     Scan ID   : ${report.scanId}`);
      console.log(`     Findings  : ${totalFindings} (Critical: ${critical}, High: ${high})`);
      console.log(`     Duration  : ${report.scanDurationMs}ms`);

      // Extract tx hash from settle response
      if (result.settleResponse) {
        const txHash = result.settleResponse.transaction as string;

        if (txHash) {
          console.log(`  🔗 Tx Hash: ${txHash}`);
          logTx(scanIndex, contractName, txHash);
        } else {
          console.log(`  ℹ️  Payment response (no tx hash extracted):`, JSON.stringify(result.settleResponse).substring(0, 200));
        }
      }
    } else {
      const errText = await paidRes.text();
      const errHeaders: Record<string, string> = {};
      paidRes.headers.forEach((value, key) => {
        errHeaders[key] = value;
      });
      console.error(`  ❌ Scan failed after payment: ${paidRes.status}`);
      console.error(`     Headers:`, JSON.stringify(errHeaders));
      console.error(`     Body:`, errText.substring(0, 500));
    }
  } catch (err: any) {
    console.error(`  ❌ Error: ${err.message}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function runAutoScanner(): Promise<void> {
  console.log(`\n╔══════════════════════════════════════════════════════╗`);
  console.log(`║   🦅  FalconGuard Client-Agent  v1.0.0              ║`);
  console.log(`╚══════════════════════════════════════════════════════╝`);
  console.log(`  Server      : ${SERVER_URL}`);
  console.log(`  Network     : ${X402_CONFIG.network}`);
  console.log(`  Attribution : ${X402_CONFIG.attributionTag}`);

  // ── Wallet setup ──────────────────────────────────────────────────────────
  const isDummyKey =
    !PRIVATE_KEY ||
    PRIVATE_KEY === '0x0000000000000000000000000000000000000000000000000000000000000000';

  if (isDummyKey) {
    console.warn(`\n  ⚠️  WARNING: No real CLIENT_AGENT_PRIVATE_KEY configured.`);
    console.warn(`     x402 payment signing requires a funded Celo Sepolia wallet.`);
    console.warn(`     Set CLIENT_AGENT_PRIVATE_KEY in .env and fund it with testnet USDC.`);
    console.warn(`     Running in unsigned mode — server will return 402 without settlement.\n`);
  }

  let walletClient: ReturnType<typeof createWalletClient> | null = null;
  let account: ReturnType<typeof privateKeyToAccount> | null = null;

  if (!isDummyKey) {
    account = privateKeyToAccount(PRIVATE_KEY!);
    walletClient = createWalletClient({
      account,
      chain: celoSepolia,
      transport: http(process.env.RPC_URL || 'https://forno.celo-sepolia.celo-testnet.org'),
    });
    console.log(`  Agent Wallet: ${account.address}`);
  }

  // ── Public client for contract fetching ────────────────────────────────────
  const publicClient = createPublicClient({
    chain: celoSepolia,
    transport: http(process.env.RPC_URL || 'https://forno.celo-sepolia.celo-testnet.org'),
  });

  // ── Tx log init ───────────────────────────────────────────────────────────
  initTxLog();

  // ── Scan queue ────────────────────────────────────────────────────────────
  const ALL_CONTRACTS = [...LOCAL_CONTRACTS, ...CELO_SEPOLIA_CONTRACTS];
  console.log(`\n  Queuing ${ALL_CONTRACTS.length} contracts (${LOCAL_CONTRACTS.length} local + ${CELO_SEPOLIA_CONTRACTS.length} Celo Sepolia)...\n`);

  let scanIndex = 1;
  for (const contractPath of ALL_CONTRACTS) {
    if (walletClient && account) {
      await scanWithPayment(contractPath, walletClient, account, scanIndex, publicClient);
    } else {
      // No wallet: just probe the endpoint to confirm 402 is returned
      try {
        const probe = await fetch(SERVER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contractPath }),
        });
        console.log(`\n[FalconGuard] Probe ${contractPath}: HTTP ${probe.status}`);
        if (probe.status === 402) {
          const details = await probe.json();
          console.log(`  ✅ Payment gate active. Required: ${JSON.stringify(details?.accepts?.[0]?.price ?? 'see 402 body')}`);
        }
      } catch (err: any) {
        console.error(`  ❌ Probe failed: ${err.message}`);
      }
    }
    scanIndex++;
  }

  console.log(`\n  ✅ Batch complete. Transaction log: ${TX_LOG_PATH}\n`);
}

runAutoScanner().catch(console.error);
