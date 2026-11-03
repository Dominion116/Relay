import React from 'react';
import { ArrowRight, Bot, Check, Layers } from 'lucide-react';

interface HeroProps {
  onExplorePlayground: () => void;
  onOpenMcp: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onExplorePlayground, onOpenMcp }) => {
  return (
    <section className="pt-16 pb-12 border-b border-surface-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Terminal context label */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-surface border border-surface-border text-xs font-mono text-ink-secondary">
            <span className="text-settled font-semibold">&gt;_</span>
            <span>vibestarter $ vibeathon --edition 02 --theme night-shift</span>
          </div>
        </div>

        {/* Hero headline and subhead */}
        <div className="max-w-3xl mb-8">
          <h1 className="text-3xl sm:text-5xl font-medium tracking-tight text-ink-primary mb-4 leading-tight">
            Pay-per-use information infrastructure on Base
          </h1>
          <p className="text-base sm:text-lg text-ink-secondary font-normal leading-relaxed">
            Twelve live endpoints for AI agents and vibecoders. Paid per request in USDC via the open x402 standard. Zero subscriptions, zero API keys, zero accounts.
          </p>
        </div>

        {/* Primary and secondary action */}
        <div className="flex flex-wrap items-center gap-3 mb-12">
          <button
            onClick={onExplorePlayground}
            className="px-5 py-2.5 rounded-md bg-ink-primary hover:bg-white text-background font-mono text-xs font-medium flex items-center gap-2 transition-colors"
          >
            <span>Launch playground</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onOpenMcp}
            className="px-5 py-2.5 rounded-md bg-surface hover:bg-surface-raised border border-surface-border text-ink-primary font-mono text-xs font-medium flex items-center gap-2 transition-colors"
          >
            <Bot className="w-3.5 h-3.5 text-ink-muted" />
            <span>Claude & Cursor MCP</span>
          </button>
        </div>

        {/* Concrete architecture comparison: Web2 APIs vs Relay */}
        <div className="bg-surface border border-surface-border rounded-lg p-5">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-surface-border text-xs font-mono text-ink-muted">
            <span>Protocol evolution</span>
            <span>Replacing SaaS Subscriptions with x402 Micropayments</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div className="bg-background/60 p-4 rounded border border-surface-border">
              <div className="text-ink-muted font-medium mb-2.5">
                Traditional Web2 APIs
              </div>
              <ul className="space-y-2 text-ink-muted text-[11px]">
                <li className="flex items-start gap-2">
                  <span className="text-ink-muted">•</span>
                  <span>Requires human credit card and monthly commitments</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-ink-muted">•</span>
                  <span>Requires manual developer API key management</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-ink-muted">•</span>
                  <span>Incompatible with autonomous EVM agent wallets</span>
                </li>
              </ul>
            </div>

            <div className="bg-background/60 p-4 rounded border border-surface-border">
              <div className="text-ink-primary font-medium mb-2.5 flex items-center gap-2">
                <span>Relay on Base</span>
                <span className="px-1.5 py-0.2 text-[10px] text-settled border border-settled/30 rounded">Native</span>
              </div>
              <ul className="space-y-2 text-ink-secondary text-[11px]">
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-settled shrink-0 mt-0.2" />
                  <span>Settled in native Base USDC (Chain 8453 and 84532)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-settled shrink-0 mt-0.2" />
                  <span>Gasless off-chain EIP-712 transferWithAuthorization</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-settled shrink-0 mt-0.2" />
                  <span>Native MCP server for Claude Desktop and Cursor vibecoders</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};
