import React from 'react';
import { HeaderNav } from '../components/HeaderNav';
import { Footer } from '../components/Footer';
import { Shield, FileText, ExternalLink, ArrowLeft } from 'lucide-react';
import type { PageRoute } from '../App';

interface TermsPageProps {
  onNavigate: (page: PageRoute) => void;
  onOpenMcp: () => void;
  onOpenDiscovery: () => void;
}

export const TermsPage: React.FC<TermsPageProps> = ({
  onNavigate,
  onOpenMcp,
  onOpenDiscovery,
}) => {
  return (
    <div className="w-full bg-[#0a0a0a] text-neutral-400 font-sans antialiased min-h-screen flex flex-col justify-between">
      <HeaderNav
        currentPage="home"
        onNavigate={onNavigate}
        onOpenMcp={onOpenMcp}
        onOpenDiscovery={onOpenDiscovery}
      />

      <main className="flex-1 w-full">
        <div className="max-w-[900px] w-full mx-auto px-6 md:px-12 py-16 md:py-20">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="inline-flex items-center gap-2 text-xs font-mono text-neutral-400 hover:text-white transition-colors mb-8"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to Gateway</span>
          </button>

          <div className="flex items-center gap-2.5 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-xs font-mono text-neutral-300 w-fit mb-4">
            <FileText className="size-3.5 text-blue-400" />
            <span>Legal Specification</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-neutral-100 mb-3">
            Terms of Service
          </h1>
          <p className="text-xs font-mono text-neutral-500 mb-10">
            Last Updated: November 2026 • Effective Protocol Version: x402 v2
          </p>

          <div className="space-y-10 text-sm leading-relaxed text-neutral-300">
            <section className="space-y-3">
              <h2 className="text-lg font-medium text-neutral-100 flex items-center gap-2">
                <span className="text-blue-400 font-mono text-xs">01.</span>
                <span>Non-Custodial Architecture</span>
              </h2>
              <p>
                Relay provides decentralized, stateless HTTP-to-blockchain gateway routing and client SDKs implementing the canonical x402 protocol specification. Relay is non-custodial: neither Relay, its developers, nor gateway operators ever take custody of, hold, or manage private keys, funds, or wallet assets.
              </p>
              <p className="text-neutral-400 text-xs">
                All payment authorizations are cryptographically signed locally on user or agent hardware using EIP-712 structured typed data under ERC-3009 specifications.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-medium text-neutral-100 flex items-center gap-2">
                <span className="text-blue-400 font-mono text-xs">02.</span>
                <span>Autonomous Agent & Developer Usage</span>
              </h2>
              <p>
                Relay is engineered explicitly for autonomous AI runtimes, Model Context Protocol (MCP) clients, and automated software agents. Developers deploying automated agent spending loops agree to configure conservative client-side daily and per-call spending ceilings (<code className="text-neutral-200">MAX_PAYMENT_USDC</code> and <code className="text-neutral-200">MAX_DAILY_BUDGET_USDC</code>).
              </p>
              <p className="text-neutral-400 text-xs">
                You agree not to execute distributed denial-of-service (DDoS) attacks, exploit unmetered error responses, or attempt to bypass cryptographic signature verification.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-medium text-neutral-100 flex items-center gap-2">
                <span className="text-blue-400 font-mono text-xs">03.</span>
                <span>Settlement Finality on Base</span>
              </h2>
              <p>
                Micro-payments executed via Relay settle on the Base blockchain (Base Mainnet or Base Sepolia). Blockchain transactions are deterministic and irreversible once included in a finalized block. The gateway issues settlement receipts based strictly on confirmed on-chain transactions submitted via authorized settlement facilitators.
              </p>
              <p className="text-neutral-400 text-xs">
                Testnet configurations using Base Sepolia utilize test tokens with zero real-world financial value.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-medium text-neutral-100 flex items-center gap-2">
                <span className="text-blue-400 font-mono text-xs">04.</span>
                <span>Upstream Data Feeds & No Warranty</span>
              </h2>
              <p>
                Data returned through Relay endpoints (including crypto pricing, FX rates, weather, academic literature, and news) is sourced programmatically from third-party decentralized and open web APIs. Relay does not certify, warranty, or guarantee the accuracy, completeness, or real-time truth of upstream external sources.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-medium text-neutral-100 flex items-center gap-2">
                <span className="text-blue-400 font-mono text-xs">05.</span>
                <span>Limitation of Liability</span>
              </h2>
              <p className="text-xs text-neutral-400 leading-relaxed">
                THE RELAY SOFTWARE, SDKS, AND GATEWAY SERVICE ARE PROVIDED "AS IS" AND "AS AVAILABLE", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED. UNDER NO CIRCUMSTANCES SHALL THE PROTOCOL CONTRIBUTORS OR GATEWAY OPERATORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM SOFTWARE EXECUTION, RPC LATENCY, OR BLOCKCHAIN NETWORK REORGANIZATIONS.
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer
        onNavigate={onNavigate}
        onOpenMcp={onOpenMcp}
        onOpenDiscovery={onOpenDiscovery}
      />
    </div>
  );
};

export default TermsPage;
