import React from 'react';
import { HeaderNav } from '../components/HeaderNav';
import { Footer } from '../components/Footer';
import { ShieldCheck, Lock, EyeOff, ArrowLeft } from 'lucide-react';
import type { PageRoute } from '../App';

interface PrivacyPageProps {
  onNavigate: (page: PageRoute) => void;
  onOpenMcp: () => void;
  onOpenDiscovery: () => void;
}

export const PrivacyPage: React.FC<PrivacyPageProps> = ({
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
            <ShieldCheck className="size-3.5 text-emerald-400" />
            <span>Privacy Architecture</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-neutral-100 mb-3">
            Privacy Policy
          </h1>
          <p className="text-xs font-mono text-neutral-500 mb-10">
            Last Updated: November 2026 • Machine-Native Zero-Data Commitment
          </p>

          <div className="space-y-10 text-sm leading-relaxed text-neutral-300">
            <section className="space-y-3">
              <h2 className="text-lg font-medium text-neutral-100 flex items-center gap-2">
                <span className="text-emerald-400 font-mono text-xs">01.</span>
                <span>Zero Personal Identification</span>
              </h2>
              <p>
                Relay is engineered from the ground up for autonomous software agents and pseudonymous developers. We do not collect, request, store, or sell any personally identifiable information (PII). Relay requires no user accounts, passwords, email addresses, phone numbers, or KYC verification.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-medium text-neutral-100 flex items-center gap-2">
                <span className="text-emerald-400 font-mono text-xs">02.</span>
                <span>Zero Tracking Cookies & Analytics Pixels</span>
              </h2>
              <p>
                The Relay frontend and gateway do not deploy marketing cookies, tracking pixels, or third-party behavioral profiling scripts. We do not track your browsing habits across external sites.
              </p>
              <p className="text-neutral-400 text-xs">
                Because Relay operates with zero non-essential cookies, we do not require or present invasive cookie consent banners.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-medium text-neutral-100 flex items-center gap-2">
                <span className="text-emerald-400 font-mono text-xs">03.</span>
                <span>Public Blockchain Data</span>
              </h2>
              <p>
                When you or an autonomous agent execute a paid request, cryptographic authorizations are settled on the Base blockchain. Your public wallet address, transaction hash, and timestamp become part of the immutable public ledger. Relay does not associate your public blockchain address with any real-world identity.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-medium text-neutral-100 flex items-center gap-2">
                <span className="text-emerald-400 font-mono text-xs">04.</span>
                <span>Local Key Security & Client-Side Storage</span>
              </h2>
              <p>
                Private keys, daily budget configuration files, and local session settlement histories are stored strictly on your local hardware or browser memory. Private keys are never transmitted to Relay servers or API gateways under any circumstance.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-medium text-neutral-100 flex items-center gap-2">
                <span className="text-emerald-400 font-mono text-xs">05.</span>
                <span>Security & Contact</span>
              </h2>
              <p>
                For security vulnerabilities, disclosure, or questions regarding protocol privacy, contact <a href="mailto:builders@relay.org" className="text-blue-400 underline underline-offset-4">builders@relay.org</a> or open an issue on the open-source repository.
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

export default PrivacyPage;
