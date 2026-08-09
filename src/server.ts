import express, { Request, Response } from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { createPublicClient, http as viemHttp, isAddress } from 'viem';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { HTTPFacilitatorClient, type RoutesConfig } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { runSlitherScan } from './scanner/slitherRunner.js';
import { runCustomChecks } from './scanner/customChecks.js';
import { buildScanReport, ScanReport, generateMarkdownReport } from './scanner/reportBuilder.js';
import { fetchVerifiedSourceCode } from './scanner/sourceFetcher.js';
import {
  X402_CONFIG,
  getAttributionDataSuffix,
  USDC_ADDRESS,
  CELO_NETWORK,
} from './payments/x402Config.js';
import { getNetworkConfigFromEnv } from './config/networkConfig.js';

dotenv.config();

// ─── Network Configuration Validation ───────────────────────────────────────────
// Validate that env var overrides match the selected network
const networkConfig = getNetworkConfigFromEnv();
const networkName = networkConfig.networkName;

function validateNetworkOverride(
  envVarName: string,
  envValue: string | undefined,
  expectedValue: string,
  networkName: string
): void {
  if (!envValue) return; // No override, using default

  if (envValue !== expectedValue) {
    console.warn(`\n⚠️  NETWORK CONFIGURATION MISMATCH DETECTED ⚠️`);
    console.warn(`  Environment Variable: ${envVarName}`);
    console.warn(`  Current Network: ${networkName}`);
    console.warn(`  Expected Value: ${expectedValue}`);
    console.warn(`  Actual Override: ${envValue}`);
    console.warn(`  ⚠️  This override may belong to a different network!`);
    console.warn(`  ⚠️  Remove the env var or update it to match the selected network.\n`);
  }
}

// Validate each network-specific override
validateNetworkOverride(
  'FACILITATOR_URL',
  process.env.FACILITATOR_URL,
  networkConfig.facilitatorUrl,
  networkName
);

validateNetworkOverride(
  'USDC_ADDRESS',
  process.env.USDC_ADDRESS,
  networkConfig.usdcAddress,
  networkName
);

validateNetworkOverride(
  'RPC_URL',
  process.env.RPC_URL,
  networkConfig.rpcUrl,
  networkName
);

const app = express();
app.use(cors({
  exposedHeaders: ['payment-required', 'payment-response', 'x-payment-response', 'payment-signature', 'PAYMENT-SIGNATURE'],
}));
app.use(express.json({ limit: '2mb' }));

const PORT = process.env.PORT || 3000;

// ─── Celo RPC Public Client (for on-chain contract validation) ────────────────
// Use the same networkConfig.rpcUrl as everything else for consistency
const publicClient = createPublicClient({
  transport: viemHttp(networkConfig.rpcUrl),
});

// ─── x402 v2 Facilitator Setup (Celo-hosted) ───────────────────────────────────
const facilitator = new HTTPFacilitatorClient({
  url: X402_CONFIG.facilitatorUrl as `${string}:${string}`,
  createAuthHeaders: async () => {
    const apiKey = process.env.X402_API_KEY;
    if (!apiKey) {
      console.warn('⚠️  X402_API_KEY not set — /settle will return 401');
      return { verify: {}, settle: {}, supported: {} };
    }
    const h = { 'X-API-Key': apiKey };
    return { verify: h, settle: h, supported: h };
  },
});

const server = new x402ResourceServer(facilitator);
server.register('eip155:*', new ExactEvmScheme());

// ─── Health / Info endpoint (free, no payment required) ──────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'online',
    service: 'FalconGuard Scan-Agent',
    version: '1.0.0',
    debug: {
      networkConfig: {
        chainId: networkConfig.chainId,
        networkName: networkConfig.networkName,
        rpcUrl: networkConfig.rpcUrl,
        explorerUrl: networkConfig.explorerUrl,
        facilitatorUrl: networkConfig.facilitatorUrl,
      },
      envVars: {
        RPC_URL: process.env.RPC_URL || '(not set - using default)',
        NETWORK: process.env.NETWORK || '(not set - using default)',
      },
    },
    metering: {
      price: X402_CONFIG.pricePerScan,
      network: X402_CONFIG.network,
      facilitator: X402_CONFIG.facilitatorUrl,
      // payTo omitted from public endpoint for privacy
      attributionTag: X402_CONFIG.attributionTag,
      dataSuffix: X402_CONFIG.dataSuffix,
    },
  });
});

// ─── ERC-8004 Agent Metadata (public, no payment required) ─────────────────────
app.get('/.well-known/agent-card.json', (_req: Request, res: Response) => {
  res.json({
    type: "Agent",
    name: "FalconGuard Scan-Agent",
    description: "x402-metered smart contract security scanner on Celo. Pay-per-scan using real USDC settlement via EIP-3009. Powered by Slither static analysis and custom vulnerability detection rules.",
    endpoints: [
      {
        type: "wallet",
        address: "0x41dbdBBB116C5eFb9c0290b9A4A61502361b5bB9",
        chainId: 42220
      },
      {
        type: "api",
        url: "https://myceloproject-production.up.railway.app/scan",
        description: "POST endpoint for smart contract scans, x402-metered at $0.10 USDC per scan"
      }
    ],
    supportedTrust: ["reputation"]
  });
});

// ─── x402 Payment Gate (v2 API) ───────────────────────────────────────────────
// Every POST /scan requires a valid x402 micropayment (USDC on Celo Sepolia).
// The middleware:
//   1. Returns HTTP 402 + payment instructions on first call
//   2. Verifies the PAYMENT-SIGNATURE header via Celo facilitator
//   3. Settles the EIP-3009 transferWithAuthorization on-chain
//   4. Calls next() to deliver the scan result
//
// All settled transactions carry ERC-8021 attribution tag: celo_4d19a013cc70
// injected via toDataSuffix(['falconguard_scan', 'celo_4d19a013cc70'])
// on the client side (see autoScanner.ts).
const routes: RoutesConfig = {
  'POST /scan': {
    accepts: [
      {
        scheme: 'exact',
        network: CELO_NETWORK as `${string}:${string}`,
        payTo: X402_CONFIG.payTo,
        price: {
          amount: '100000', // $0.10 — USDC has 6 decimals
          asset: USDC_ADDRESS,
          extra: {
            name: 'USDC',
            version: '2',
          },
        },
      },
    ],
    description: 'FalconGuard smart contract security scan — powered by Slither + custom audit rules',
  },
};

// ─── Security Validation Functions ─────────────────────────────────────────────
// Pure function to validate contract address format (no Express dependencies)
export function isValidContractAddress(input: string): boolean {
  if (!input || typeof input !== 'string') {
    return false;
  }
  return /^0x[a-fA-F0-9]{40}$/.test(input);
}

// Dev-only payment bypass for testing (NEVER enable in production)
const SKIP_PAYMENT = process.env.SKIP_PAYMENT_FOR_TESTS === 'true' && process.env.NODE_ENV !== 'production';
if (SKIP_PAYMENT) {
  console.warn('⚠️  WARNING: PAYMENT MIDDLEWARE BYPASSED (SKIP_PAYMENT_FOR_TESTS=true, NODE_ENV != production)');
  console.warn('⚠️  THIS FLAG MUST NEVER BE SET IN PRODUCTION');
}

// Apply payment middleware only if not bypassed
if (!SKIP_PAYMENT) {
  console.log('🔒 Payment middleware enabled - all /scan requests require x402 payment');
  app.use(paymentMiddleware(routes, server));
} else {
  console.log('⚠️  PAYMENT MIDDLEWARE BYPASSED - scans will be FREE');
}

// ─── Core Scan Execution ─────────────────────────────────────────────────────
// Public API: Scan from source code string (safe, no filesystem access)
export async function executeScanFromSource(sourceCode: string): Promise<ScanReport> {
  const startTime = Date.now();
  const tempFilePath = path.join(
    os.tmpdir(),
    `fg-scan-${Date.now()}-${Math.floor(Math.random() * 10000)}.sol`,
  );
  fs.writeFileSync(tempFilePath, sourceCode);

  try {
    // 1. Run Slither static analysis (subprocess, sandboxed, no shell)
    const slitherResult = await runSlitherScan(tempFilePath, 30000);

    // 2. Run FalconGuard custom vulnerability pattern checks
    const customFindings = runCustomChecks(sourceCode, path.basename(tempFilePath));

    const combinedFindings = [...slitherResult.findings, ...customFindings];
    const scanDurationMs = Date.now() - startTime;

    return buildScanReport(
      tempFilePath,
      combinedFindings,
      slitherResult.slitherRan,
      true,
      scanDurationMs,
    );
  } finally {
    // Cleanup temp file
    if (fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch {
        // Non-fatal
      }
    }
  }
}

// Internal use only: Scan from local file path (for autoScanner.ts and test-contracts/)
// WARNING: Do NOT call this with user-controlled input from the public API
export async function executeScanFromLocalFile(filePath: string): Promise<ScanReport> {
  const startTime = Date.now();
  
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error(`File not found or not a regular file: ${filePath}`);
  }

  const rawSourceCode = fs.readFileSync(filePath, 'utf-8');

  // 1. Run Slither static analysis (subprocess, sandboxed, no shell)
  const slitherResult = await runSlitherScan(filePath, 30000);

  // 2. Run FalconGuard custom vulnerability pattern checks
  const customFindings = runCustomChecks(rawSourceCode, path.basename(filePath));

  const combinedFindings = [...slitherResult.findings, ...customFindings];
  const scanDurationMs = Date.now() - startTime;

  return buildScanReport(
    filePath,
    combinedFindings,
    slitherResult.slitherRan,
    true,
    scanDurationMs,
  );
}

// Legacy function for backward compatibility (internal use only)
export async function executeScan(
  targetPathOrCode: string,
  isCodeString: boolean = false,
): Promise<ScanReport> {
  if (isCodeString) {
    return executeScanFromSource(targetPathOrCode);
  } else {
    return executeScanFromLocalFile(targetPathOrCode);
  }
}

// ─── POST /scan — x402-gated scan endpoint ───────────────────────────────────
app.post('/scan', async (req: Request, res: Response) => {
  try {
    const { contractPath, sourceCode } = req.body;
    const format = req.query.format as string || 'json'; // Support 'json' or 'markdown'

    if (!contractPath && !sourceCode) {
      res.status(400).json({
        error: 'Either contractPath or sourceCode must be provided in request body.',
      });
      return;
    }

    // ── Security: contractPath must be a valid 0x address only ────────────────
    // Reject any non-address contractPath to prevent path traversal attacks
    if (contractPath && !isValidContractAddress(contractPath)) {
      res.status(400).json({
        error: 'Invalid contract path format.',
        hint: 'contractPath must be a valid 42-character hex address (0x...). For scanning local files, use the sourceCode parameter instead.',
      });
      return;
    }

    // ── On-chain contract validation (when contractPath is a 0x address) ──────
    // Reject EOA (regular wallet) addresses before executing any scan or charge.
    if (contractPath) {
      if (!isAddress(contractPath)) {
        res.status(400).json({
          error: 'Invalid Ethereum address format.',
          hint: 'Contract addresses must be a valid 42-character hex address (0x...).',
        });
        return;
      }

      try {
        const bytecode = await publicClient.getBytecode({
          address: contractPath as `0x${string}`,
        });

        // Check if address has bytecode (contracts have bytecode, EOAs don't)
        // Valid contract bytecode is longer than '0x' (2 characters)
        if (!bytecode || bytecode === '0x' || bytecode.length <= 2) {
          res.status(400).json({
            error: 'Address is not a smart contract.',
            hint: 'The provided address appears to be a regular wallet (EOA) or an undeployed address. Please provide a deployed contract address.',
            address: contractPath,
          });
          return;
        }
      } catch (rpcErr: any) {
        // Non-fatal: if RPC fails, continue with source fetch attempt
        // The source fetcher will fail if the contract doesn't exist
        console.warn(`⚠️  RPC bytecode check failed for ${contractPath}: ${rpcErr.message}`);
      }
    }

    // ── Execute scan using safe public API function ─────────────────────────
    let report: ScanReport;
    if (sourceCode) {
      // Direct source code provided by user
      report = await executeScanFromSource(sourceCode);
    } else if (contractPath) {
      // Fetch verified source code from Blockscout for on-chain address
      const fetchedSource = await fetchVerifiedSourceCode(contractPath);
      
      if (!fetchedSource) {
        res.status(400).json({
          error: 'Contract source is not verified on Celo Sepolia block explorer.',
          hint: 'Please provide sourceCode directly in your request, or verify your contract on the block explorer first.',
          address: contractPath,
        });
        return;
      }
      
      // Scan the fetched source code
      report = await executeScanFromSource(fetchedSource.sourceCode);
      
      // Enrich report metadata with contract info
      report.metadata = {
        ...report.metadata,
        contractName: fetchedSource.contractName,
        onChainAddress: contractPath,
      };
    } else {
      res.status(400).json({
        error: 'Either contractPath (on-chain address) or sourceCode must be provided.',
      });
      return;
    }

    // Return markdown if requested, otherwise JSON
    if (format === 'markdown' || format === 'md') {
      res.set('Content-Type', 'text/markdown');
      res.send(generateMarkdownReport(report));
    } else {
      res.json(report);
    }
  } catch (error: any) {
    res.status(500).json({
      error: 'Scan execution failed',
      details: error.message,
    });
  }
});

// ─── Server Bootstrap ─────────────────────────────────────────────────────────
if (
  process.env.START_SERVER === 'true' ||
  process.argv[1]?.endsWith('server.ts') ||
  process.argv[1]?.endsWith('server.js')
) {
  app.listen(PORT, () => {
    console.log(`\n╔══════════════════════════════════════════════════════╗`);
    console.log(`║   🦅  FalconGuard Scan-Agent  v1.0.0                ║`);
    console.log(`╚══════════════════════════════════════════════════════╝`);
    console.log(`  Port       : ${PORT}`);
    console.log(`  Network    : ${X402_CONFIG.network}`);
    console.log(`  Pay-To     : ${X402_CONFIG.payTo}`);
    console.log(`  Facilitator: ${X402_CONFIG.facilitatorUrl}`);
    console.log(`  Price/Scan : ${X402_CONFIG.pricePerScan} USDC`);
    console.log(`  ERC-8021   : ${X402_CONFIG.attributionTag}`);
    console.log(`  Data Suffix: ${X402_CONFIG.dataSuffix}`);
    console.log(`  ✅ x402 payment gate active on POST /scan\n`);
  });
}

export default app;
