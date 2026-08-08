import { useState } from 'react';

const EXPLORER_BASE = import.meta.env.VITE_NETWORK === 'mainnet'
  ? 'https://celoscan.io'
  : 'https://sepolia.celoscan.io';

export interface Finding {
  id: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL' | string;
  category: string;
  description: string;
  location?: {
    file?: string;
    line?: number;
  };
  remediation?: string;
}

export interface ScanResult {
  scanId: string;
  timestamp?: string;
  target?: string;
  summary: {
    totalFindings: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    informational?: number;
    riskScore?: number;
  };
  findings?: Finding[];
  metadata?: {
    slitherRan?: boolean;
    customChecksRan?: boolean;
    scanDurationMs?: number;
    scannerVersion?: string;
    engines?: string[];
  };
  txHash?: string;
  error?: string;
}

interface ScanResultsProps {
  result: ScanResult;
  onResetScan?: () => void;
}

export default function ScanResults({ result, onResetScan }: ScanResultsProps) {
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');

  if (result.error) {
    return (
      <div className="mt-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="font-semibold text-red-700 dark:text-red-400">Scan Failed</h3>
        </div>
        <p className="mt-2 text-red-600 dark:text-red-300">{result.error}</p>
        {onResetScan && (
          <button
            onClick={onResetScan}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Try Scanning Again
          </button>
        )}
      </div>
    );
  }

  const findings = result.findings || [];

  const filteredFindings = filterSeverity === 'ALL'
    ? findings
    : findings.filter(f => f.severity.toUpperCase() === filterSeverity.toUpperCase());

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity.toUpperCase()) {
      case 'CRITICAL':
        return 'bg-red-500/10 text-red-500 border-red-500/30';
      case 'HIGH':
        return 'bg-orange-500/10 text-orange-500 border-orange-500/30';
      case 'MEDIUM':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30';
      case 'LOW':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/30';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
    }
  };

  const getSeverityCountColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-500';
      case 'high':
        return 'text-orange-500';
      case 'medium':
        return 'text-yellow-500';
      case 'low':
        return 'text-blue-500';
      default:
        return 'text-[var(--text-secondary)]';
    }
  };

  return (
    <div className="mt-6 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-6 space-y-6 shadow-xl">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border-color)]">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <div>
              <h2 className="text-xl font-bold">Audit Complete</h2>
              <p className="text-xs text-[var(--text-secondary)] font-mono">Scan ID: {result.scanId}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {result.txHash && (
            <a
              href={`${EXPLORER_BASE}/tx/${result.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-primary-500/10 text-primary-400 border border-primary-500/30 hover:bg-primary-500/20 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors"
            >
              <span>On-Chain Receipt</span>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}

          {onResetScan && (
            <button
              onClick={onResetScan}
              className="px-3 py-1.5 bg-[var(--bg-primary)] border border-[var(--border-color)] hover:bg-[var(--border-color)] text-xs font-medium rounded-lg transition-colors"
            >
              Scan Another Contract
            </button>
          )}
        </div>
      </div>

      {/* Summary Score & Severity Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] flex flex-col justify-between">
          <span className="text-xs text-[var(--text-secondary)] font-medium">Total Findings</span>
          <span className="text-3xl font-extrabold mt-1">{result.summary.totalFindings}</span>
        </div>

        {[
          { label: 'Critical', count: result.summary.critical, key: 'CRITICAL', color: 'critical' },
          { label: 'High', count: result.summary.high, key: 'HIGH', color: 'high' },
          { label: 'Medium', count: result.summary.medium, key: 'MEDIUM', color: 'medium' },
          { label: 'Low', count: result.summary.low, key: 'LOW', color: 'low' },
        ].map((item) => (
          <div
            key={item.key}
            onClick={() => setFilterSeverity(filterSeverity === item.key ? 'ALL' : item.key)}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              filterSeverity === item.key
                ? 'bg-primary-500/10 border-primary-500 ring-1 ring-primary-500'
                : 'bg-[var(--bg-primary)] border-[var(--border-color)] hover:border-gray-600'
            }`}
          >
            <span className="text-xs text-[var(--text-secondary)] capitalize block">{item.label}</span>
            <span className={`text-2xl font-bold ${getSeverityCountColor(item.color)}`}>
              {item.count}
            </span>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between pt-2 border-t border-[var(--border-color)]">
        <h3 className="text-base font-semibold">Vulnerability Analysis ({filteredFindings.length})</h3>

        <div className="flex items-center gap-1 bg-[var(--bg-primary)] p-1 rounded-lg border border-[var(--border-color)] text-xs">
          {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => (
            <button
              key={sev}
              onClick={() => setFilterSeverity(sev)}
              className={`px-2.5 py-1 rounded-md font-medium capitalize transition-colors ${
                filterSeverity === sev
                  ? 'bg-primary-500 text-white'
                  : 'text-[var(--text-secondary)] hover:text-white'
              }`}
            >
              {sev.toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Vulnerabilities Cards List */}
      {filteredFindings.length === 0 ? (
        <div className="p-8 text-center bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)]">
          <svg className="w-10 h-10 mx-auto text-emerald-500/60 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <p className="text-sm font-medium">No vulnerabilities found in this severity category.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredFindings.map((finding, idx) => (
            <div
              key={finding.id || idx}
              className="p-5 bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)] space-y-3 hover:border-gray-700 transition-colors"
            >
              {/* Finding Title & Badges */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold border tracking-wide uppercase ${getSeverityBadgeClass(finding.severity)}`}>
                    {finding.severity}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-300 text-xs font-mono">
                    {finding.category}
                  </span>
                </div>
                {finding.location?.line && (
                  <span className="text-xs font-mono text-[var(--text-secondary)] bg-gray-800/60 px-2 py-1 rounded">
                    📍 Line {finding.location.line}
                  </span>
                )}
              </div>

              {/* Title & Description */}
              <div>
                <h4 className="text-base font-bold text-white">{finding.title}</h4>
                <p className="text-sm text-gray-300 mt-1 leading-relaxed">{finding.description}</p>
              </div>

              {/* Remediation Box */}
              {finding.remediation && (
                <div className="p-3.5 bg-emerald-950/20 border border-emerald-800/40 rounded-lg text-xs space-y-1">
                  <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>Recommended Remediation</span>
                  </div>
                  <p className="text-emerald-200/90 leading-normal">{finding.remediation}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
