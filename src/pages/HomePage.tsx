import React, { useState } from 'react';
import { Hero9, defaultBackground } from '../components/Hero9';
import { FaArrowRight, FaCheck } from 'react-icons/fa6';
import { ChevronDown } from 'lucide-react';
import { Footer } from '../components/Footer';

interface HomePageProps {
  onNavigate: (page: 'home' | 'capabilities' | 'playground' | 'protocol' | 'docs') => void;
  onOpenMcp: () => void;
  onOpenDiscovery?: () => void;
  onSelectQueryForPlayground: (query: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onNavigate,
  onOpenMcp,
  onOpenDiscovery,
  onSelectQueryForPlayground
}) => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = [
    {
      question: 'What is Relay and how does it work?',
      answer:
        'Relay is an open pay-per-use capability infrastructure for autonomous AI agents and developers. Instead of locking into monthly subscriptions or managing private API keys, agents pay per individual request directly in micro-USDC using the RFC x402 payment protocol on Base.'
    },
    {
      question: 'How do payments settle without holding ETH for gas?',
      answer:
        'Relay leverages native Base USDC transfer authorizations under ERC-3009 and EIP-712. Your agent wallet only holds USDC. When an HTTP 402 challenge is received, the client signs an off-chain authorization payload. The Relay facilitator submits the transaction and covers network gas, eliminating the need to bootstrap agents with native ETH.'
    },
    {
      question: 'Do I need an account, credit card, or API key?',
      answer:
        'No. Relay requires zero accounts, credit cards, or pre-provisioned developer keys. Any agent or client with a funded Base wallet can discover available endpoints via the machine manifest (/.well-known/x402.json) and execute capability requests immediately.'
    },
    {
      question: 'What data capabilities are currently live on Relay?',
      answer:
        'Relay provides 12 production endpoints across five primary categories: academic literature search and DOI retrieval (OpenAlex), cryptocurrency spot prices and market metrics (CoinGecko), foreign exchange reference rates (Frankfurter / ECB), weather forecasts and geocoding (Open-Meteo and Photon), public holiday verification (Nager.Date), Wikidata entity lookups, real-time news headlines, and deterministic multi-source research packs.'
    },
    {
      question: 'How do autonomous agents and LLMs integrate with Relay?',
      answer:
        'Agents can connect to Relay using our native Model Context Protocol (MCP) server for Claude Desktop, Cursor, and Windsurf, or programmatically via lightweight TypeScript/Viem and Python SDK snippets. All requests follow standardized JSON schemas with predictable, verified outputs.'
    },
    {
      question: 'Which blockchain networks and settlement assets are supported?',
      answer:
        'Relay operates on Base Mainnet (Chain ID 8453) and Base Sepolia testnet (Chain ID 84532), settling exclusively in native Circle USDC.'
    }
  ];

  const handleNav = (href: string) => {
    if (href === '#capabilities') onNavigate('capabilities');
    else if (href === '#playground') onNavigate('playground');
    else if (href === '#protocol') onNavigate('protocol');
    else if (href === '#docs') onNavigate('docs');
    else if (href === '#mcp') onOpenMcp();
    else if (href === '#discovery') onOpenDiscovery?.();
    else if (href === '#home') onNavigate('home');
  };

  return (
    <div className="w-full bg-[#0a0a0a] text-neutral-400 font-sans antialiased min-h-screen flex flex-col">
      {/* Hero Section: Hero9 Template (Left as it is per user instruction) */}
      <Hero9
        logoText="Relay"
        title={'Programmatic Data & Capabilities\nfor AI Agents on Base'}
        description={'Pay per API request in micro-USDC with zero subscriptions,\ncredit cards, or API keys. Reviving HTTP 402 on Coinbase L2.'}
        eyebrowText="Live x402 Micropayments on Base"
        emailPlaceholder="Try: bitcoin price, weather in tokyo, quantum computing"
        submitText="Execute x402"
        ctaText="Interactive Playground"
        onCtaClick={() => onNavigate('playground')}
        onNavigate={handleNav}
        onSubmitForm={(q) => {
          onSelectQueryForPlayground(q);
          onNavigate('playground');
        }}
      />

      {/* Rest of the landing page sections without visible divider lines */}
      <section className="w-full bg-[#0a0a0a]">
        <div className="max-w-[1400px] w-full mx-auto px-6 md:px-12 lg:px-16 py-20 md:py-28 flex flex-col gap-24">
          
          {/* Section 1: Traditional Web2 APIs vs Relay Architecture */}
          <div>
            <div className="max-w-2xl mb-12">
              <span className="text-xs font-mono uppercase tracking-wider text-neutral-500 mb-2 block font-medium">
                Autonomous Commerce Shift
              </span>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-medium tracking-tight text-neutral-100 mb-4 text-balance">
                Why traditional API subscriptions fail AI agents
              </h2>
              <p className="text-[15px] leading-relaxed text-neutral-400">
                Legacy Web2 APIs force autonomous agents to manage human credit cards, monthly subscription commitments, and static API keys. Relay provides pay-per-request programmatic capabilities settled natively in micro-USDC on Base.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Previous Generation: Traditional Web2 APIs */}
              <div className="rounded-2xl bg-neutral-900/30 border border-neutral-800/60 p-7 md:p-8 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-mono text-neutral-500 uppercase tracking-wider">Legacy Model</span>
                    <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-neutral-800 text-neutral-400">Web2 APIs</span>
                  </div>
                  <h3 className="text-lg font-medium text-neutral-100 mb-3">Traditional SaaS APIs</h3>
                  <ul className="space-y-3 text-[14px] font-mono text-neutral-400">
                    <li className="flex items-start gap-2.5">
                      <span className="text-neutral-500 font-bold">•</span>
                      <span>Requires human credit card billing cycles and monthly tiers</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="text-neutral-500 font-bold">•</span>
                      <span>Requires manual dashboard signups and static developer API keys</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="text-neutral-500 font-bold">•</span>
                      <span>Incompatible with autonomous on-chain agent wallets and micro-payments</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Current Standard: Relay on Base */}
              <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800/60 p-7 md:p-8 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-mono text-blue-400 uppercase tracking-wider font-medium">New Standard</span>
                    <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400">Base L2</span>
                  </div>
                  <h3 className="text-lg font-medium text-neutral-100 mb-3">Relay on Base</h3>
                  <ul className="space-y-3 text-[14px] font-mono text-neutral-300">
                    <li className="flex items-start gap-2.5">
                      <FaCheck className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-1" />
                      <span>Settled in native USD Coin (<code className="text-neutral-200 bg-neutral-800 px-1 py-0.5 rounded text-xs">0x8335...2913</code>)</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <FaCheck className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-1" />
                      <span><strong className="text-white font-medium">Zero ETH gas needed:</strong> Off-chain EIP-712 ERC-3009 transfer authorizations</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <FaCheck className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-1" />
                      <span>Native integration with Coinbase AgentKit, Cursor, and Claude MCP</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: 4-Step Wire Protocol Sequence */}
          <div>
            <div className="max-w-2xl mb-12">
              <span className="text-xs font-mono uppercase tracking-wider text-neutral-500 mb-2 block font-medium">
                Execution Cycle
              </span>
              <h2 className="text-2xl sm:text-3xl font-medium tracking-tight text-neutral-100 mb-4">
                How autonomous agents call Relay via x402
              </h2>
              <p className="text-[15px] leading-relaxed text-neutral-400">
                A simple 4-step programmatic handshake reviving HTTP status 402 for machine-to-machine commerce.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="rounded-2xl bg-neutral-900/40 border border-neutral-800/60 p-6 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-mono font-medium text-neutral-500 mb-2 block">01 / REQUEST</span>
                  <h4 className="text-base font-medium text-neutral-100 mb-2">Unauthenticated Call</h4>
                  <p className="text-xs text-neutral-400 leading-relaxed font-mono">
                    Agent sends standard HTTP POST to any Relay endpoint without API keys or credentials.
                  </p>
                </div>
                <div className="mt-4 text-[11px] font-mono text-neutral-500">
                  <code>POST /api/v1/academic/works</code>
                </div>
              </div>

              <div className="rounded-2xl bg-neutral-900/40 border border-neutral-800/60 p-6 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-mono font-medium text-amber-400 mb-2 block">02 / CHALLENGE</span>
                  <h4 className="text-base font-medium text-neutral-100 mb-2">HTTP 402 Challenge</h4>
                  <p className="text-xs text-neutral-400 leading-relaxed font-mono">
                    Gateway responds with status 402, USDC price, payee address, Base chain ID, and nonce.
                  </p>
                </div>
                <div className="mt-4 text-[11px] font-mono text-amber-400/90">
                  <code>Status: 402 Payment Required</code>
                </div>
              </div>

              <div className="rounded-2xl bg-neutral-900/40 border border-neutral-800/60 p-6 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-mono font-medium text-blue-400 mb-2 block">03 / SIGNATURE</span>
                  <h4 className="text-base font-medium text-neutral-100 mb-2">EIP-712 Authorization</h4>
                  <p className="text-xs text-neutral-400 leading-relaxed font-mono">
                    Agent signs gasless off-chain transfer authorization. Zero ETH gas spent by the agent.
                  </p>
                </div>
                <div className="mt-4 text-[11px] font-mono text-blue-400/90">
                  <code>X-Payment-Proof: 0x...</code>
                </div>
              </div>

              <div className="rounded-2xl bg-neutral-900/40 border border-neutral-800/60 p-6 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-mono font-medium text-emerald-400 mb-2 block">04 / DELIVERY</span>
                  <h4 className="text-base font-medium text-neutral-100 mb-2">HTTP 200 Fulfilled</h4>
                  <p className="text-xs text-neutral-400 leading-relaxed font-mono">
                    Gateway validates cryptographic proof and returns authoritative live payload instantly.
                  </p>
                </div>
                <div className="mt-4 text-[11px] font-mono text-emerald-400/90">
                  <code>Status: 200 OK • Data Returned</code>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Frequently Asked Questions */}
          <div>
            <div className="max-w-2xl mb-12">
              <span className="text-xs font-mono uppercase tracking-wider text-neutral-500 mb-2 block font-medium">
                Frequently Asked Questions
              </span>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-medium tracking-tight text-neutral-100 mb-4 text-balance">
                Everything you need to know about Relay
              </h2>
              <p className="text-[15px] leading-relaxed text-neutral-400">
                Common questions about x402 micropayments, zero gas settlement on Base, and autonomous agent capabilities.
              </p>
            </div>

            <div className="space-y-3.5">
              {faqs.map((faq, index) => {
                const isOpen = openFaq === index;
                return (
                  <div
                    key={index}
                    className="rounded-2xl bg-neutral-900/40 border border-neutral-800/60 overflow-hidden transition-colors hover:border-neutral-700/80"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : index)}
                      className="w-full px-6 py-5 sm:px-7 sm:py-6 text-left flex items-center justify-between gap-4 cursor-pointer"
                      aria-expanded={isOpen}
                    >
                      <span className="text-base sm:text-lg font-medium text-neutral-100 tracking-tight">
                        {faq.question}
                      </span>
                      <ChevronDown
                        className={`size-5 text-neutral-400 shrink-0 transition-transform duration-200 ${
                          isOpen ? 'rotate-180 text-white' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-6 pb-6 sm:px-7 sm:pb-7 pt-0 text-[14px] sm:text-[15px] text-neutral-400 leading-relaxed font-sans border-t border-neutral-800/40 mt-1">
                        <p className="pt-3">{faq.answer}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 4: Call to Action Banner with Hero9 Background */}
          <div>
            <div className="relative isolate overflow-hidden rounded-3xl bg-sky-300 p-10 sm:p-14 lg:p-16 text-center flex flex-col items-center justify-center text-slate-950 shadow-2xl">
              <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
                <img
                  src={defaultBackground}
                  alt=""
                  className="h-full w-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/20" />
              </div>

              <span className="text-xs font-mono uppercase tracking-wider text-slate-900 mb-3 px-3.5 py-1 rounded-full bg-white/70 backdrop-blur-sm font-semibold border border-white/60">
                Live Testbench
              </span>

              <h3 className="text-2xl sm:text-3xl lg:text-4xl font-medium tracking-[-0.03em] text-slate-950 mb-3.5 max-w-2xl text-balance">
                Ready to test live x402 capability calls?
              </h3>
              <p className="text-[15px] sm:text-[16px] text-slate-900/85 max-w-xl mx-auto mb-8 leading-relaxed">
                Execute live requests against CoinGecko, OpenAlex, Open-Meteo, and Wikidata in the interactive playground testbench.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => onNavigate('playground')}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-slate-950 text-white px-6 text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm active:scale-[0.98]"
                >
                  <span>Open interactive playground</span>
                  <FaArrowRight className="size-3" />
                </button>
                <button
                  onClick={() => onNavigate('capabilities')}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-950/20 bg-white/85 text-slate-950 px-6 text-sm font-medium hover:bg-white transition-colors backdrop-blur-sm shadow-sm active:scale-[0.98]"
                >
                  <span>Browse 12 capabilities</span>
                </button>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Footer20 Implementation */}
      <Footer
        onNavigate={onNavigate}
        onOpenMcp={onOpenMcp}
        onOpenDiscovery={onOpenDiscovery}
      />
    </div>
  );
};
