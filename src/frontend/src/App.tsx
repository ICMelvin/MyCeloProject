import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, useAccount } from 'wagmi';
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { config } from './config/wagmi';
import Header from './components/Header';
import ContractSubmission from './components/ContractSubmission';
import ScanResults, { ScanResult } from './components/ScanResults';
import ScanHistory from './components/ScanHistory';

const queryClient = new QueryClient();

function MainContent({ isDarkMode, toggleDarkMode }: { isDarkMode: boolean; toggleDarkMode: () => void }) {
  const { address } = useAccount();
  const [activeTab, setActiveTab] = useState<'scan' | 'history'>('scan');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [history, setHistory] = useState<ScanResult[]>([]);

  // Load history whenever connected wallet address changes
  useEffect(() => {
    if (!address) {
      setHistory([]);
      return;
    }
    try {
      const storageKey = `falconguard_history_${address.toLowerCase()}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setHistory(JSON.parse(saved));
      } else {
        setHistory([]);
      }
    } catch {
      setHistory([]);
    }
  }, [address]);

  // Save scan result to history and state
  const handleScanComplete = (result: ScanResult) => {
    setScanResult(result);
    setIsScanning(false);

    if (address && !result.error && result.scanId) {
      try {
        const storageKey = `falconguard_history_${address.toLowerCase()}`;
        const existing = localStorage.getItem(storageKey);
        const list: ScanResult[] = existing ? JSON.parse(existing) : [];

        // Avoid duplicate scanIds
        const filtered = list.filter((item) => item.scanId !== result.scanId);
        const updated = [result, ...filtered];

        localStorage.setItem(storageKey, JSON.stringify(updated));
        setHistory(updated);
      } catch (err) {
        console.error('Failed to save scan history:', err);
      }
    }
  };

  const handleScanStart = () => {
    setScanResult(null);
    setIsScanning(true);
  };

  const handleClearHistory = () => {
    if (!address) return;
    try {
      const storageKey = `falconguard_history_${address.toLowerCase()}`;
      localStorage.removeItem(storageKey);
      setHistory([]);
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  };

  const handleSelectHistoryScan = (scan: ScanResult) => {
    setScanResult(scan);
    setActiveTab('scan');
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <Header
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
      />

      <main className="container mx-auto px-4 py-8 max-w-4xl pt-24">
        {/* Banner & Tab Control */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <p className="text-[var(--text-secondary)] text-sm">
              x402-metered smart contract security scanner on Celo
            </p>
          </div>

          <div className="flex items-center bg-[var(--bg-secondary)] p-1 rounded-xl border border-[var(--border-color)] text-sm">
            <button
              onClick={() => setActiveTab('scan')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'scan'
                  ? 'bg-primary-500 text-white shadow-md'
                  : 'text-[var(--text-secondary)] hover:text-white'
              }`}
            >
              New Audit
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'history'
                  ? 'bg-primary-500 text-white shadow-md'
                  : 'text-[var(--text-secondary)] hover:text-white'
              }`}
            >
              <span>Scan History</span>
              {history.length > 0 && (
                <span className="px-1.5 py-0.2 text-xs rounded-full bg-white/20 font-mono font-bold">
                  {history.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Tab 1: New Scan / Scan Results */}
        {activeTab === 'scan' && (
          <div className="space-y-6">
            {!scanResult && (
              <ContractSubmission
                onScanStart={handleScanStart}
                onScanComplete={handleScanComplete}
                isScanning={isScanning}
              />
            )}

            {scanResult && !isScanning && (
              <ScanResults
                result={scanResult}
                onResetScan={() => setScanResult(null)}
              />
            )}
          </div>
        )}

        {/* Tab 2: Scan History */}
        {activeTab === 'history' && (
          <ScanHistory
            history={history}
            onSelectScan={handleSelectHistoryScan}
            onClearHistory={handleClearHistory}
          />
        )}
      </main>
    </div>
  );
}

function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={isDarkMode ? darkTheme() : lightTheme()}>
          <MainContent isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;
