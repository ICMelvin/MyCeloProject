export interface SecurityFinding {
  id: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';
  category: 'REENTRANCY' | 'ACCESS_CONTROL' | 'UNCHECKED_CALL' | 'ARITHMETIC' | 'DELEGATECALL' | 'OTHER';
  description: string;
  location?: {
    file?: string;
    line?: number;
    function?: string;
  };
  remediation: string;
}

export interface ScanRequest {
  contractPath?: string;
  sourceCode?: string;
  contractAddress?: string;
}

export interface ScanReport {
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
  };
  findings: SecurityFinding[];
  metadata: {
    slitherRan: boolean;
    customChecksRan: boolean;
    scanDurationMs: number;
    scannerVersion: string;
  };
}

export function buildScanReport(
  target: string,
  findings: SecurityFinding[],
  slitherRan: boolean,
  customChecksRan: boolean,
  scanDurationMs: number
): ScanReport {
  const summary = {
    totalFindings: findings.length,
    critical: findings.filter((f) => f.severity === 'CRITICAL').length,
    high: findings.filter((f) => f.severity === 'HIGH').length,
    medium: findings.filter((f) => f.severity === 'MEDIUM').length,
    low: findings.filter((f) => f.severity === 'LOW').length,
    informational: findings.filter((f) => f.severity === 'INFORMATIONAL').length,
  };

  return {
    scanId: `fg-scan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    target,
    status: 'SUCCESS',
    summary,
    findings,
    metadata: {
      slitherRan,
      customChecksRan,
      scanDurationMs,
      scannerVersion: 'FalconGuard-ScanEngine-v1.0.0',
    },
  };
}
