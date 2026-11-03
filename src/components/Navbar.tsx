import React from 'react';
import { ExternalLink, Cpu, Wallet, Layers } from 'lucide-react';

interface NavbarProps {
  network: 'base' | 'base-sepolia';
  setNetwork: (net: 'base' | 'base-sepolia') => void;
  agentBalance: number;
  onOpenMcp: () => void;
  onOpenDiscovery: () => void;
  onResetBalance: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  network,
  setNetwork,
  agentBalance,
  onOpenMcp,
  onOpenDiscovery,
  onResetBalance
}) => {
  return (
    <header className="sticky top-0 z-50 border-b border-surface-border bg-background/95 backdrop-blur-sm">

      {/* Main navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <a href="#" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-base flex items-center justify-center text-white">
              <Layers className="w-4 h-4" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-semibold text-base tracking-tight text-ink-primary font-mono">Relay</span>
              <span className="text-[11px] text-ink-muted font-mono">x402</span>
            </div>
          </a>

          <nav className="hidden md:flex items-center gap-1 text-xs font-mono text-ink-secondary">
            <a href="#playground" className="px-2.5 py-1.5 rounded-md hover:text-ink-primary hover:bg-surface-raised transition-colors">
              Playground
            </a>
            <a href="#endpoints" className="px-2.5 py-1.5 rounded-md hover:text-ink-primary hover:bg-surface-raised transition-colors">
              Endpoints (12)
            </a>
            <a href="#protocol" className="px-2.5 py-1.5 rounded-md hover:text-ink-primary hover:bg-surface-raised transition-colors">
              Protocol spec
            </a>
            <button
              onClick={onOpenMcp}
              className="px-2.5 py-1.5 rounded-md text-ink-secondary hover:text-ink-primary hover:bg-surface-raised transition-colors flex items-center gap-1.5"
            >
              <Cpu className="w-3.5 h-3.5 text-ink-muted" />
              <span>Claude MCP</span>
            </button>
            <button
              onClick={onOpenDiscovery}
              className="px-2.5 py-1.5 rounded-md text-ink-muted hover:text-ink-primary hover:bg-surface-raised transition-colors"
            >
              Discovery
            </button>
          </nav>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-3">
          {/* Network Switcher */}
          <div className="hidden sm:flex items-center bg-surface border border-surface-border rounded-md p-0.5 text-xs font-mono">
            <button
              onClick={() => setNetwork('base')}
              className={`px-2.5 py-1 rounded transition-colors ${
                network === 'base'
                  ? 'bg-surface-raised text-ink-primary font-medium border border-surface-border'
                  : 'text-ink-muted hover:text-ink-secondary'
              }`}
            >
              Base Mainnet
            </button>
            <button
              onClick={() => setNetwork('base-sepolia')}
              className={`px-2.5 py-1 rounded transition-colors ${
                network === 'base-sepolia'
                  ? 'bg-surface-raised text-ink-primary font-medium border border-surface-border'
                  : 'text-ink-muted hover:text-ink-secondary'
              }`}
            >
              Base Sepolia
            </button>
          </div>

          {/* Test Agent Wallet */}
          <div className="flex items-center gap-2.5 bg-surface border border-surface-border rounded-md px-3 py-1.5">
            <Wallet className="w-3.5 h-3.5 text-ink-muted" />
            <div className="text-right">
              <span className="text-[10px] text-ink-muted block font-mono leading-none">Agent balance</span>
              <span className="text-xs font-mono font-medium text-ink-primary tabular-nums">
                ${agentBalance.toFixed(2)} <span className="text-[10px] text-ink-muted">USDC</span>
              </span>
            </div>
            {agentBalance < 1 && (
              <button
                onClick={onResetBalance}
                title="Top up test wallet"
                className="ml-1 text-[11px] text-ink-secondary hover:text-ink-primary px-1.5 py-0.5 rounded bg-surface-raised border border-surface-border font-mono transition-colors"
              >
                Top up
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
