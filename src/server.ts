import express, { Request, Response } from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { runSlitherScan } from './scanner/slitherRunner.js';
import { runCustomChecks } from './scanner/customChecks.js';
import { buildScanReport, ScanReport } from './scanner/reportBuilder.js';
import { X402_CONFIG, getAttributionDataSuffix } from './payments/x402Config.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'online',
    service: 'FalconGuard Scan-Agent',
    metering: {
      price: X402_CONFIG.pricePerScan,
      network: X402_CONFIG.network,
      facilitator: X402_CONFIG.facilitatorUrl,
      attributionTag: X402_CONFIG.attributionTag,
      dataSuffix: X402_CONFIG.dataSuffix,
    },
  });
});

// Core Security Scan Execution Function
export async function executeScan(targetPathOrCode: string, isCodeString: boolean = false): Promise<ScanReport> {
  const startTime = Date.now();
  let tempFilePath: string | null = null;
  let filePathToScan = targetPathOrCode;
  let rawSourceCode = '';

  if (isCodeString) {
    tempFilePath = path.join(os.tmpdir(), `fg-scan-${Date.now()}-${Math.floor(Math.random() * 10000)}.sol`);
    fs.writeFileSync(tempFilePath, targetPathOrCode);
    filePathToScan = tempFilePath;
    rawSourceCode = targetPathOrCode;
  } else if (fs.existsSync(targetPathOrCode) && fs.statSync(targetPathOrCode).isFile()) {
    rawSourceCode = fs.readFileSync(targetPathOrCode, 'utf-8');
  }

  // 1. Run Slither analysis
  const slitherResult = await runSlitherScan(filePathToScan, 30000);

  // 2. Run FalconGuard Custom Checks
  const customFindings = rawSourceCode ? runCustomChecks(rawSourceCode, path.basename(filePathToScan)) : [];

  // Cleanup temporary file if created
  if (tempFilePath && fs.existsSync(tempFilePath)) {
    try {
      fs.unlinkSync(tempFilePath);
    } catch {}
  }

  const combinedFindings = [...slitherResult.findings, ...customFindings];
  const scanDurationMs = Date.now() - startTime;

  return buildScanReport(
    filePathToScan,
    combinedFindings,
    slitherResult.slitherRan,
    true,
    scanDurationMs
  );
}

// POST /scan endpoint
app.post('/scan', async (req: Request, res: Response) => {
  try {
    const { contractPath, sourceCode } = req.body;

    if (!contractPath && !sourceCode) {
       res.status(400).json({ error: 'Either contractPath or sourceCode must be provided in request body.' });
       return;
    }

    /*
     * TODO: Aug 3 Implementation Step - x402 Facilitator Verification Gate
     * Check req.headers['payment-signature'] or req.headers['x-payment']
     * Verify and settle transaction via EIP-3009 transferWithAuthorization through Celo Facilitator
     * Ensure settled calldata includes ERC-8021 suffix: getAttributionDataSuffix()
     */

    const isCodeString = Boolean(sourceCode);
    const target = sourceCode || contractPath;
    const report = await executeScan(target, isCodeString);

    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: 'Scan execution failed', details: error.message });
  }
});

if (process.env.START_SERVER === 'true' || process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js')) {
  app.listen(PORT, () => {
    console.log(`[FalconGuard Scan-Agent] Server listening on port ${PORT}`);
    console.log(`[FalconGuard Scan-Agent] Payment Gate target: ${X402_CONFIG.payTo} on ${X402_CONFIG.network}`);
    console.log(`[FalconGuard Scan-Agent] ERC-8021 Attribution Tag: ${X402_CONFIG.attributionTag}`);
  });
}

export default app;
