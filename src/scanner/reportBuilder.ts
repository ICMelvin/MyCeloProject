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
    contractName?: string;
    onChainAddress?: string;
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

// ─── Markdown Report Generator ───────────────────────────────────────────────────
export function generateMarkdownReport(report: ScanReport): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${report.branding.product}`);
  lines.push(``);
  lines.push(`**Scan ID:** \`${report.scanId}\``);
  lines.push(`**Target:** \`${report.target}\``);
  lines.push(`**Timestamp:** ${report.timestamp}`);
  lines.push(`**Duration:** ${report.scanDurationMs}ms`);
  lines.push(`**Status:** ${report.status}`);
  lines.push(``);

  // Risk Score Badge
  const riskScore = report.summary.riskScore;
  let riskBadge = '🟢 LOW RISK';
  if (riskScore >= 75) riskBadge = '🔴 CRITICAL RISK';
  else if (riskScore >= 50) riskBadge = '🟠 HIGH RISK';
  else if (riskScore >= 25) riskBadge = '🟡 MEDIUM RISK';

  lines.push(`## Risk Assessment`);
  lines.push(`**Overall Risk Score:** ${riskScore}/100 ${riskBadge}`);
  lines.push(``);

  // Summary Table
  lines.push(`## Summary`);
  lines.push(`| Severity | Count |`);
  lines.push(`|----------|-------|`);
  lines.push(`| 🔴 Critical | ${report.summary.critical} |`);
  lines.push(`| 🟠 High | ${report.summary.high} |`);
  lines.push(`| 🟡 Medium | ${report.summary.medium} |`);
  lines.push(`| 🟢 Low | ${report.summary.low} |`);
  lines.push(`| ℹ️  Informational | ${report.summary.informational} |`);
  lines.push(`| **Total** | **${report.summary.totalFindings}** |`);
  lines.push(``);

  // Findings by Category
  if (report.findings.length > 0) {
    lines.push(`## Detailed Findings`);
    lines.push(``);

    const categoryGroups = new Map<string, SecurityFinding[]>();
    report.findings.forEach(f => {
      if (!categoryGroups.has(f.category)) {
        categoryGroups.set(f.category, []);
      }
      categoryGroups.get(f.category)!.push(f);
    });

    categoryGroups.forEach((findings, category) => {
      lines.push(`### ${category}`);
      lines.push(``);

      findings.forEach(finding => {
        const emoji = severityEmoji(finding.severity);
        lines.push(`#### ${emoji} - ${finding.title}`);
        lines.push(`**ID:** \`${finding.id}\``);
        if (finding.location) {
          const location = finding.location.file 
            ? `${finding.location.file}${finding.location.line ? `:${finding.location.line}` : ''}`
            : finding.location.line 
            ? `Line ${finding.location.line}`
            : 'Unknown';
          lines.push(`**Location:** ${location}`);
        }
        lines.push(``);
        lines.push(finding.description);
        lines.push(``);
        lines.push(`**💡 Remediation:** ${finding.remediation}`);
        lines.push(``);
        lines.push(`---`);
        lines.push(``);
      });
    });
  } else {
    lines.push(`## ✅ No Vulnerabilities Detected`);
    lines.push(`No security issues were found by the automated analysis.`);
    lines.push(``);
  }

  // Metadata
  lines.push(`## Scan Metadata`);
  lines.push(`- **Scanner Version:** ${report.metadata.scannerVersion}`);
  lines.push(`- **Engines:** ${report.metadata.engines.join(', ')}`);
  lines.push(`- **Slither Ran:** ${report.metadata.slitherRan ? '✅' : '❌'}`);
  lines.push(`- **Custom Checks Ran:** ${report.metadata.customChecksRan ? '✅' : '❌'}`);
  lines.push(`- **Network:** ${report.branding.network}`);
  lines.push(`- **Attribution Tag:** \`${report.branding.attributionTag}\``);
  lines.push(``);

  // Disclaimer
  lines.push(`---`);
  lines.push(``);
  lines.push(`*${report.branding.disclaimer}*`);

  return lines.join('\n');
}
