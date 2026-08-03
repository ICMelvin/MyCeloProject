import express, { Request, Response } from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { HTTPFacilitatorClient, type RoutesConfig } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { runSlitherScan } from './scanner/slitherRunner.js';
import { runCustomChecks } from './scanner/customChecks.js';
import { buildScanReport, ScanReport } from './scanner/reportBuilder.js';
import {
  X402_CONFIG,
  getAttributionDataSuffix,
  USDC_ADDRESS,
  CELO_NETWORK,
} from './payments/x402Config.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const PORT = process.env.PORT || 3000;

// ─── x402 v2 Facilitator Setup (Celo-hosted) ───────────────────────────────────
const facilitatorUrl = CELO_NETWORK === 'eip155:42220'
  ? 'https://api.x402.celo.org'
  : 'https://api.x402.sepolia.celo.org';

const facilitator = new HTTPFacilitatorClient({
  url: facilitatorUrl,
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
    metering: {
      price: X402_CONFIG.pricePerScan,
      network: X402_CONFIG.network,
      facilitator: X402_CONFIG.facilitatorUrl,
      payTo: X402_CONFIG.payTo,
      attributionTag: X402_CONFIG.attributionTag,
      dataSuffix: X402_CONFIG.dataSuffix,
    },
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
        network: CELO_NETWORK,
        payTo: X402_CONFIG.payTo,
        price: {
          amount: '10000', // $0.01 — USDC has 6 decimals
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

app.use(paymentMiddleware(routes, server));

// ─── Core Scan Execution ─────────────────────────────────────────────────────
export async function executeScan(
  targetPathOrCode: string,
  isCodeString: boolean = false,
): Promise<ScanReport> {
  const startTime = Date.now();
  let tempFilePath: string | null = null;
  let filePathToScan = targetPathOrCode;
  let rawSourceCode = '';

  if (isCodeString) {
    // Write inline source code to a temp file so Slither can analyse it
    tempFilePath = path.join(
      os.tmpdir(),
      `fg-scan-${Date.now()}-${Math.floor(Math.random() * 10000)}.sol`,
    );
    fs.writeFileSync(tempFilePath, targetPathOrCode);
    filePathToScan = tempFilePath;
    rawSourceCode = targetPathOrCode;
  } else if (fs.existsSync(targetPathOrCode) && fs.statSync(targetPathOrCode).isFile()) {
    rawSourceCode = fs.readFileSync(targetPathOrCode, 'utf-8');
  }

  // 1. Run Slither static analysis (subprocess, sandboxed, no shell)
  const slitherResult = await runSlitherScan(filePathToScan, 30000);

  // 2. Run FalconGuard custom vulnerability pattern checks
  const customFindings = rawSourceCode
    ? runCustomChecks(rawSourceCode, path.basename(filePathToScan))
    : [];

  // Cleanup temp file
  if (tempFilePath && fs.existsSync(tempFilePath)) {
    try {
      fs.unlinkSync(tempFilePath);
    } catch {
      // Non-fatal
    }
  }

  const combinedFindings = [...slitherResult.findings, ...customFindings];
  const scanDurationMs = Date.now() - startTime;

  return buildScanReport(
    filePathToScan,
    combinedFindings,
    slitherResult.slitherRan,
    true,
    scanDurationMs,
  );
}

// ─── POST /scan — x402-gated scan endpoint ───────────────────────────────────
app.post('/scan', async (req: Request, res: Response) => {
  try {
    const { contractPath, sourceCode } = req.body;

    if (!contractPath && !sourceCode) {
      res.status(400).json({
        error: 'Either contractPath or sourceCode must be provided in request body.',
      });
      return;
    }

    const isCodeString = Boolean(sourceCode);
    const target = sourceCode || contractPath;
    const report = await executeScan(target, isCodeString);

    res.json(report);
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
