import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useBalance } from 'wagmi';

interface HeaderProps {
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export default function Header({ isDarkMode, onToggleDarkMode }: HeaderProps) {
  const { address, isConnected, chainId } = useAccount();
  const { data: celoBalance } = useBalance({
    address,
    chainId,
  });

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">FG</span>
          </div>
          <h2 className="font-semibold">FalconGuard Scan-Agent</h2>
        </div>

        <div className="flex items-center gap-4">
          {isConnected && address && (
            <div className="hidden md:flex items-center gap-4 text-sm">
              <div className="text-[var(--text-secondary)]">
                <span className="block text-xs">CELO Balance</span>
                <span className="font-mono">
                  {celoBalance ? `${parseFloat(celoBalance.formatted).toFixed(4)} CELO` : 'Loading...'}
                </span>
              </div>
              <div className="text-[var(--text-secondary)]">
                <span className="block text-xs">Address</span>
                <span className="font-mono text-xs">
                  {address.slice(0, 6)}...{address.slice(-4)}
                </span>
              </div>
            </div>
          )}

          <button
            onClick={onToggleDarkMode}
            className="p-2 rounded-lg hover:bg-[var(--border-color)] transition-colors"
            aria-label="Toggle dark mode"
          >
            {isDarkMode ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
