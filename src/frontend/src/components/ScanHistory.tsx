import { ScanResult } from './ScanResults';

const EXPLORER_BASE = import.meta.env.VITE_NETWORK === 'mainnet'
  ? 'https://celoscan.io'
  : 'https://explorer.sepolia.celo.org';

interface ScanHistoryProps {
  history: ScanResult[];
  onSelectScan: (scan: ScanResult) => void;
  onClearHistory: () => void;
}

export default function ScanHistory({ history, onSelectScan, onClearHistory }: ScanHistoryProps) {
  if (history.length === 0) {
    return (
      <div className="mt-6 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-8 text-center shadow-xl">
        <svg className="w-12 h-12 mx-auto text-gray-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="text-lg font-bold">No Audit History Found</h3>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Scans completed with your connected wallet will be automatically saved here.
        </p>
      </div>
    );
  }

  const getSeverityBadge = (count: number, label: string, colorClass: string) => {
    if (count === 0) return null;
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-bold ${colorClass}`}>
        {count} {label}
      </span>
    );
  };

  return (
    <div className="mt-6 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-6 space-y-4 shadow-xl">
      <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
        <div>
          <h2 className="text-lg font-bold">Wallet Audit History</h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Showing {history.length} past contract security scan{history.length === 1 ? '' : 's'}
          </p>
        </div>

        <button
          onClick={onClearHistory}
          className="px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 text-xs font-medium rounded-lg transition-colors"
        >
          Clear History
        </button>
      </div>

      <div className="space-y-3">
        {history.map((scan, idx) => (
          <div
            key={scan.scanId || idx}
            onClick={() => onSelectScan(scan)}
            className="p-4 bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)] hover:border-primary-500/50 cursor-pointer transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-white group-hover:text-primary-400 transition-colors">
                  {scan.scanId}
                </span>
                {scan.timestamp && (
                  <span className="text-xs text-[var(--text-secondary)]">
                    • {new Date(scan.timestamp).toLocaleString()}
                  </span>
                )}
              </div>

              {scan.target && (
                <p className="text-xs font-mono text-[var(--text-secondary)] truncate max-w-md">
                  Target: {scan.target}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {getSeverityBadge(scan.summary.critical, 'Critical', 'bg-red-500/20 text-red-400 border border-red-500/30')}
                {getSeverityBadge(scan.summary.high, 'High', 'bg-orange-500/20 text-orange-400 border border-orange-500/30')}
                {getSeverityBadge(scan.summary.medium, 'Medium', 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30')}
                {getSeverityBadge(scan.summary.low, 'Low', 'bg-blue-500/20 text-blue-400 border border-blue-500/30')}
                {scan.summary.totalFindings === 0 && (
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Clean (0 Issues)
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {scan.txHash && (
                <a
                  href={`${EXPLORER_BASE}/tx/${scan.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs font-mono text-primary-400 hover:underline"
                >
                  Tx Receipt ↗
                </a>
              )}

              <button className="px-3 py-1.5 bg-primary-500 text-white rounded-lg text-xs font-medium group-hover:bg-primary-600 transition-colors">
                View Full Audit
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
