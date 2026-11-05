import React, { useState } from 'react';
import { Hero9 } from '../components/Hero9';
import { Check, ChevronDown, ArrowRight, Minus } from 'lucide-react';
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
        'Relay provides 12 production endpoints across five primary categories: academic literature search and DOI retrieval (OpenAlex), cryptocurrency spot prices and market metrics (Binance), foreign exchange reference rates (Frankfurter / ECB), weather forecasts and geocoding (Open-Meteo and Photon), public holiday verification (Nager.Date), Wikidata entity lookups, real-time news headlines, and deterministic multi-source research packs.'
    },
    {
      question: 'How do autonomous agents and LLMs integrate with Relay?',
      answer:
        'Agents can connect to Relay using our native Model Context Protocol (MCP) server for Claude Desktop, Cursor, and Windsurf, or programmatically via lightweight TypeScript/Viem and Python SDK snippets. All requests follow standardized JSON schemas with predictable, verified outputs.'
    },
    {
      question: 'Which blockchain networks and settlement assets are supported?',
      answer:
        'Relay operates strictly on Base Mainnet (Chain ID 8453), settling exclusively in native Circle USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913).'
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
      {/* Hero Section: Hero9 Template */}
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

      {/* Main Content Sections */}
      <main className="w-full bg-[#0a0a0a]">
        <div className="max-w-[1400px] w-full mx-auto px-6 md:px-12 lg:px-16 py-20 md:py-28 flex flex-col gap-24">
          
          {/* Section 1: Autonomous Commerce Shift */}
          <section aria-labelledby="shift-heading">
            <div className="max-w-2xl mb-12">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-xs font-mono text-neutral-400 mb-4">
                <span className="size-1.5 rounded-full bg-blue-500" />
                <span>Autonomous commerce shift</span>
              </div>
              <h2 id="shift-heading" className="text-2xl sm:text-3xl lg:text-4xl font-medium tracking-tight text-neutral-100 mb-4 text-balance">
                Why traditional API subscriptions fail AI agents
              </h2>
              <p className="text-[15px] leading-relaxed text-neutral-400">
                Legacy Web2 APIs force autonomous agents to manage human credit cards, monthly recurring commitments, and static developer keys. Relay provides pay-per-request programmatic capabilities settled natively in micro-USDC on Base.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
              {/* Legacy Model */}
              <div className="rounded-2xl bg-neutral-900/30 border border-neutral-800/80 p-6 sm:p-8 flex flex-col justify-between hover:border-neutral-700/80 transition-colors">
                <div>
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-neutral-800/80">
                    <div>
                      <span className="text-xs font-mono text-neutral-500 block mb-1">Architecture</span>
                      <h3 className="text-lg font-medium text-neutral-100">Traditional SaaS APIs</h3>
                    </div>
                    <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-neutral-800/80 text-neutral-400 border border-neutral-700/60">
                      Legacy model
                    </span>
                  </div>

                  <ul className="space-y-4 text-sm text-neutral-300">
                    <li className="flex items-start gap-3">
                      <div className="mt-0.5 size-5 rounded-full bg-neutral-800/80 border border-neutral-700/60 flex items-center justify-center shrink-0 text-neutral-400">
                        <Minus className="size-3 text-neutral-400" />
                      </div>
                      <div>
                        <strong className="font-medium text-neutral-200">Human billing commitments:</strong> Requires credit card invoicing, monthly plan tiers, and manual spend ceilings.
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="mt-0.5 size-5 rounded-full bg-neutral-800/80 border border-neutral-700/60 flex items-center justify-center shrink-0 text-neutral-400">
                        <Minus className="size-3 text-neutral-400" />
                      </div>
                      <div>
                        <strong className="font-medium text-neutral-200">Static credential lock-in:</strong> Requires manual portal signups, account verification, and leaked API key liabilities.
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="mt-0.5 size-5 rounded-full bg-neutral-800/80 border border-neutral-700/60 flex items-center justify-center shrink-0 text-neutral-400">
                        <Minus className="size-3 text-neutral-400" />
                      </div>
                      <div>
                        <strong className="font-medium text-neutral-200">Agent wallet incompatibility:</strong> Incapable of streaming payments directly from autonomous on-chain smart wallets.
                      </div>
                    </li>
                  </ul>
                </div>

                <div className="mt-8 pt-4 border-t border-neutral-800/60 flex items-center justify-between text-xs font-mono text-neutral-500">
                  <span>Billing: Recurring subscriptions</span>
                  <span>Provisioning: Manual</span>
                </div>
              </div>

              {/* Relay on Base */}
              <div className="rounded-2xl bg-neutral-900/50 border border-neutral-800/80 p-6 sm:p-8 flex flex-col justify-between hover:border-neutral-700/80 transition-colors relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
                <div>
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-neutral-800/80">
                    <div>
                      <span className="text-xs font-mono text-blue-400 block mb-1">rfc x402 on base</span>
                      <h3 className="text-lg font-medium text-neutral-100">Relay on Base</h3>
                    </div>
                    <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                      Base L2 standard
                    </span>
                  </div>

                  <ul className="space-y-4 text-sm text-neutral-300">
                    <li className="flex items-start gap-3">
                      <div className="mt-0.5 size-5 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0 text-blue-400">
                        <Check className="size-3 text-blue-400" />
                      </div>
                      <div>
                        <strong className="font-medium text-neutral-100">Native USDC microtransactions:</strong> Settled in canonical Base USD Coin (<code className="text-neutral-200 bg-neutral-800 px-1 py-0.5 rounded text-xs font-mono">0x8335...2913</code>) at exact per-call costs.
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="mt-0.5 size-5 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0 text-blue-400">
                        <Check className="size-3 text-blue-400" />
                      </div>
                      <div>
                        <strong className="font-medium text-neutral-100">Zero ETH gas needed:</strong> Gasless EIP-712 transfer authorizations under ERC-3009. Agents sign off-chain; facilitator covers execution.
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="mt-0.5 size-5 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0 text-blue-400">
                        <Check className="size-3 text-blue-400" />
                      </div>
                      <div>
                        <strong className="font-medium text-neutral-100">Autonomous toolchain ready:</strong> Instant plug-and-play with Coinbase AgentKit, CDP Wallets, Cursor, and Claude via native MCP.
                      </div>
                    </li>
                  </ul>
                </div>

                <div className="mt-8 pt-4 border-t border-neutral-800/60 flex items-center justify-between text-xs font-mono text-neutral-400">
                  <span className="text-blue-400">Billing: Per request ($0.01 - $0.12)</span>
                  <span className="text-neutral-300">Setup: Zero accounts</span>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Execution Cycle */}
          <section aria-labelledby="cycle-heading">
            <div className="max-w-2xl mb-12">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-xs font-mono text-neutral-400 mb-4">
                <span className="size-1.5 rounded-full bg-neutral-500" />
                <span>Execution cycle</span>
              </div>
              <h2 id="cycle-heading" className="text-2xl sm:text-3xl lg:text-4xl font-medium tracking-tight text-neutral-100 mb-4">
                How autonomous agents call Relay via x402
              </h2>
              <p className="text-[15px] leading-relaxed text-neutral-400">
                A 4-step cryptographic wire handshake reviving the HTTP 402 Payment Required status code for machine-to-machine commerce on Base.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Step 1 */}
              <div className="rounded-2xl bg-neutral-900/30 border border-neutral-800/80 p-6 flex flex-col justify-between hover:border-neutral-700/80 transition-colors">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700/60">
                      Step 1
                    </span>
                    <span className="text-[11px] font-mono text-neutral-500">Client → Gateway</span>
                  </div>
                  <h3 className="text-base font-medium text-neutral-100 mb-2">Unauthenticated call</h3>
                  <p className="text-sm text-neutral-400 leading-relaxed font-sans">
                    Agent sends standard HTTP POST to any Relay endpoint without API keys, accounts, or session tokens.
                  </p>
                </div>
                <div className="mt-5 pt-3 border-t border-neutral-800/80 text-[11px] font-mono text-neutral-400 bg-black/40 rounded-lg p-2.5 border border-neutral-800">
                  <span className="text-neutral-500 block mb-0.5">Wire invocation:</span>
                  <code className="text-neutral-200">POST /api/v1/academic/search</code>
                </div>
              </div>

              {/* Step 2 */}
              <div className="rounded-2xl bg-neutral-900/30 border border-neutral-800/80 p-6 flex flex-col justify-between hover:border-neutral-700/80 transition-colors">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700/60">
                      Step 2
                    </span>
                    <span className="text-[11px] font-mono text-neutral-500">Gateway → Client</span>
                  </div>
                  <h3 className="text-base font-medium text-neutral-100 mb-2">HTTP 402 challenge</h3>
                  <p className="text-sm text-neutral-400 leading-relaxed font-sans">
                    Gateway responds with status 402, required micro-USDC price, payee address, Base chain ID, and fresh nonce.
                  </p>
                </div>
                <div className="mt-5 pt-3 border-t border-neutral-800/80 text-[11px] font-mono text-neutral-400 bg-black/40 rounded-lg p-2.5 border border-neutral-800">
                  <span className="text-neutral-500 block mb-0.5">Response status:</span>
                  <code className="text-neutral-200">402 Payment Required</code>
                </div>
              </div>

              {/* Step 3 */}
              <div className="rounded-2xl bg-neutral-900/30 border border-neutral-800/80 p-6 flex flex-col justify-between hover:border-neutral-700/80 transition-colors">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30">
                      Step 3
                    </span>
                    <span className="text-[11px] font-mono text-neutral-500">Client (Signer)</span>
                  </div>
                  <h3 className="text-base font-medium text-neutral-100 mb-2">EIP-712 authorization</h3>
                  <p className="text-sm text-neutral-400 leading-relaxed font-sans">
                    Agent signs off-chain gasless transfer authorization with local wallet. Zero ETH spent by the agent.
                  </p>
                </div>
                <div className="mt-5 pt-3 border-t border-neutral-800/80 text-[11px] font-mono text-neutral-400 bg-black/40 rounded-lg p-2.5 border border-neutral-800">
                  <span className="text-neutral-500 block mb-0.5">Header proof:</span>
                  <code className="text-blue-400">X-Payment-Proof: 0x...</code>
                </div>
              </div>

              {/* Step 4 */}
              <div className="rounded-2xl bg-neutral-900/30 border border-neutral-800/80 p-6 flex flex-col justify-between hover:border-neutral-700/80 transition-colors">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700/60">
                      Step 4
                    </span>
                    <span className="text-[11px] font-mono text-neutral-500">Gateway → Client</span>
                  </div>
                  <h3 className="text-base font-medium text-neutral-100 mb-2">HTTP 200 fulfilled</h3>
                  <p className="text-sm text-neutral-400 leading-relaxed font-sans">
                    Gateway validates cryptographic proof on Base and delivers authoritative live data payload in sub-second time.
                  </p>
                </div>
                <div className="mt-5 pt-3 border-t border-neutral-800/80 text-[11px] font-mono text-neutral-400 bg-black/40 rounded-lg p-2.5 border border-neutral-800">
                  <span className="text-neutral-500 block mb-0.5">Fulfilled response:</span>
                  <code className="text-neutral-200">200 OK • Payload delivered</code>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: Frequently Asked Questions */}
          <section aria-labelledby="faq-heading">
            <div className="max-w-2xl mb-12">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-xs font-mono text-neutral-400 mb-4">
                <span className="size-1.5 rounded-full bg-neutral-500" />
                <span>Frequently asked questions</span>
              </div>
              <h2 id="faq-heading" className="text-2xl sm:text-3xl lg:text-4xl font-medium tracking-tight text-neutral-100 mb-4 text-balance">
                Everything you need to know about Relay
              </h2>
              <p className="text-[15px] leading-relaxed text-neutral-400">
                Clear answers regarding x402 micropayments, gasless settlement on Base, and autonomous agent capabilities.
              </p>
            </div>

            <div className="space-y-3">
              {faqs.map((faq, index) => {
                const isOpen = openFaq === index;
                const questionId = `faq-q-${index}`;
                const panelId = `faq-p-${index}`;
                return (
                  <div
                    key={index}
                    className={`rounded-2xl border transition-all duration-200 ${
                      isOpen
                        ? 'bg-neutral-900/50 border-neutral-700/80 shadow-lg shadow-black/20'
                        : 'bg-neutral-900/30 border-neutral-800/60 hover:border-neutral-700/60'
                    }`}
                  >
                    <button
                      type="button"
                      id={questionId}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => setOpenFaq(isOpen ? null : index)}
                      className="w-full px-6 py-5 sm:px-7 sm:py-5 text-left flex items-center justify-between gap-4 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 rounded-2xl"
                    >
                      <span className="text-base sm:text-[17px] font-medium text-neutral-100 tracking-tight">
                        {faq.question}
                      </span>
                      <div className={`size-7 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                        isOpen ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                      }`}>
                        <ChevronDown
                          className={`size-4 transition-transform duration-200 ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                    </button>
                    {isOpen && (
                      <div
                        id={panelId}
                        role="region"
                        aria-labelledby={questionId}
                        className="px-6 pb-6 sm:px-7 sm:pb-6 pt-0 text-[14px] sm:text-[15px] text-neutral-400 leading-relaxed font-sans border-t border-neutral-800/60 mt-1"
                      >
                        <p className="pt-4">{faq.answer}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Section 4: Call to Action Banner (Unified Dark Theme) */}
          <section aria-labelledby="cta-heading">
            <div className="relative isolate overflow-hidden rounded-3xl bg-neutral-900/60 border border-neutral-800 p-8 sm:p-12 lg:p-16 text-center flex flex-col items-center justify-center">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-800/80 border border-neutral-700/60 text-xs font-mono text-neutral-300 mb-4">
                <span className="size-1.5 rounded-full bg-blue-500" />
                <span>Interactive testbench</span>
              </div>

              <h3 id="cta-heading" className="text-2xl sm:text-3xl lg:text-4xl font-medium tracking-tight text-neutral-100 mb-4 max-w-2xl text-balance">
                Ready to test live x402 capability calls?
              </h3>
              <p className="text-[15px] sm:text-base text-neutral-400 max-w-xl mx-auto mb-8 leading-relaxed">
                Execute live requests against CoinGecko, OpenAlex, Open-Meteo, and Wikidata in the interactive playground testbench.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => onNavigate('playground')}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white text-neutral-950 px-6 text-sm font-medium hover:bg-neutral-200 transition-colors shadow-sm active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <span>Open interactive playground</span>
                  <ArrowRight className="size-3.5" />
                </button>
                <button
                  onClick={() => onNavigate('capabilities')}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/80 text-neutral-200 px-6 text-sm font-medium hover:bg-neutral-800 hover:border-neutral-700 transition-colors shadow-sm active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <span>Browse 12 capabilities</span>
                </button>
              </div>
            </div>
          </section>

        </div>
      </main>

      {/* Footer */}
      <Footer
        onNavigate={onNavigate}
        onOpenMcp={onOpenMcp}
        onOpenDiscovery={onOpenDiscovery}
      />
    </div>
  );
};
