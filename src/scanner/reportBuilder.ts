/**
 * FalconGuard Scan-Agent — Report Builder
 *
 * Builds structured JSON vulnerability reports with severity classification,
 * remediation guidance, and FalconGuard Pro branding metadata.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SecurityFinding {
  id: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';
  category:
    | 'REENTRANCY'
    | 'ACCESS_CONTROL'
    | 'UNCHECKED_CALL'
    | 'ARITHMETIC'
    | 'DELEGATECALL'
    | 'DENIAL_OF_SERVICE'
    | 'FLASH_LOAN'
    | 'FRONT_RUNNING'
    | 'OTHER';
  description: string;
  location?: {
    file?: string;
    line?: number;
    function?: string;
  };
  remediation: string;
  /** CWE or SWC reference identifier, when available */
  reference?: string;
}

export interface ScanRequest {
  contractPath?: string;
  sourceCode?: string;
  contractAddress?: string;
}

export interface ScanReport {
  /** Unique scan identifier */
  scanId: string;
  timestamp: string;
  target: string;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  summary: {
    totalFindings: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    informational: number;
    riskScore: number;  // 0–100 composite risk score
  };
  findings: SecurityFinding[];
  scanDurationMs: number;
  metadata: {
    slitherRan: boolean;
    customChecksRan: boolean;
    scanDurationMs: number;
    scannerVersion: string;
    engines: string[];
  };
  branding: {
    product: string;
    tagline: string;
    attributionTag: string;
    network: string;
    disclaimer: string;
  };
}

// ─── Risk Score ───────────────────────────────────────────────────────────────
// Weighted composite: CRITICAL×25 + HIGH×10 + MEDIUM×4 + LOW×1, capped at 100

function calculateRiskScore(findings: SecurityFinding[]): number {
  const raw =
    findings.filter((f) => f.severity === 'CRITICAL').length * 25 +
    findings.filter((f) => f.severity === 'HIGH').length * 10 +
    findings.filter((f) => f.severity === 'MEDIUM').length * 4 +
    findings.filter((f) => f.severity === 'LOW').length * 1;
  return Math.min(100, raw);
}

// ─── Severity label for console display ───────────────────────────────────────
export function severityEmoji(severity: SecurityFinding['severity']): string {
  const map: Record<SecurityFinding['severity'], string> = {
    CRITICAL: '🔴 CRITICAL',
    HIGH: '🟠 HIGH',
    MEDIUM: '🟡 MEDIUM',
    LOW: '🟢 LOW',
    INFORMATIONAL: 'ℹ️  INFO',
  };
  return map[severity];
}

// ─── Report Builder ───────────────────────────────────────────────────────────
export function buildScanReport(
  target: string,
  findings: SecurityFinding[],
  slitherRan: boolean,
  customChecksRan: boolean,
  scanDurationMs: number,
): ScanReport {
  // De-duplicate findings by id
  const seen = new Set<string>();
  const uniqueFindings = findings.filter((f) => {
    if (seen.has(f.id)) return false;
    seen.add(f.id);
    return true;
  });

  // Sort: CRITICAL → HIGH → MEDIUM → LOW → INFORMATIONAL
  const severityOrder: Record<string, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
    INFORMATIONAL: 4,
  };
  uniqueFindings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const summary = {
    totalFindings: uniqueFindings.length,
    critical: uniqueFindings.filter((f) => f.severity === 'CRITICAL').length,
    high: uniqueFindings.filter((f) => f.severity === 'HIGH').length,
    medium: uniqueFindings.filter((f) => f.severity === 'MEDIUM').length,
    low: uniqueFindings.filter((f) => f.severity === 'LOW').length,
    informational: uniqueFindings.filter((f) => f.severity === 'INFORMATIONAL').length,
    riskScore: calculateRiskScore(uniqueFindings),
  };

  // Determine overall status
  const status: ScanReport['status'] =
    !slitherRan && !customChecksRan
      ? 'FAILED'
      : !slitherRan
      ? 'PARTIAL'
      : 'SUCCESS';

  return {
    scanId: `fg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    target,
    status,
    summary,
    findings: uniqueFindings,
    scanDurationMs,
    metadata: {
      slitherRan,
      customChecksRan,
      scanDurationMs,
      scannerVersion: 'FalconGuard-ScanEngine-v1.0.0',
      engines: [
        ...(slitherRan ? ['Slither v0.10+'] : []),
        ...(customChecksRan ? ['FalconGuard Custom Rules v1.0'] : []),
      ],
    },
    branding: {
      product: 'FalconGuard Pro — Smart Contract Security Scanner',
      tagline: 'Autonomous AI-powered vulnerability detection on Celo',
      attributionTag: 'celo_4d19a013cc70',
      network: process.env.NETWORK || 'celo-sepolia',
      disclaimer:
        'Automated analysis only. Results should be reviewed by a qualified security auditor ' +
        'before deploying to production. FalconGuard does not guarantee exhaustive coverage.',
    },
  };
}
