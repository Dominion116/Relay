import React, { useState } from 'react';
import { HeaderNav } from '../components/HeaderNav';
import { Footer } from '../components/Footer';
import { FaCopy, FaCheck, FaArrowRight, FaMagnifyingGlass } from 'react-icons/fa6';
import { BookOpen, ShieldCheck, Terminal, Cpu, Database, Network, ArrowUpRight, CheckCircle2, Layers, ChevronDown } from 'lucide-react';

interface DocsPageProps {
  onNavigate: (page: 'home' | 'capabilities' | 'playground' | 'protocol' | 'docs') => void;
  onOpenMcp: () => void;
  onOpenDiscovery: () => void;
}

export const DocsPage: React.FC<DocsPageProps> = ({
  onNavigate,
  onOpenMcp,
  onOpenDiscovery
}) => {
  const [activeSection, setActiveSection] = useState<string>('quickstart');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');

  const copyToClipboard = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const navSections = [
    {
      title: 'Getting Started',
      items: [
        { id: 'quickstart', label: 'Quickstart' },
        { id: 'concepts', label: 'Core concepts' },
        { id: 'why-base', label: 'Base L2 advantages' },
      ]
    },
    {
      title: 'Protocol Handshake',
      items: [
        { id: 'handshake', label: 'The x402 handshake' },
        { id: 'eip712', label: 'EIP-712 gasless signing' },
        { id: 'manifest', label: 'Machine manifest' },
      ]
    },
    {
      title: 'Agent Integration',
      items: [
        { id: 'ts-sdk', label: 'TypeScript and Viem' },
        { id: 'python-sdk', label: 'Python requests' },
        { id: 'mcp-server', label: 'Cursor and Claude MCP' },
      ]
    },
    {
      title: 'Reference',
      items: [
        { id: 'endpoints', label: 'Endpoints catalog' },
        { id: 'errors', label: 'Errors and recovery' },
      ]
    }
  ];

  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const currentSectionLabel = navSections
    .flatMap(g => g.items)
    .find(item => item.id === activeSection)?.label || 'Quickstart';

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    setMobileNavOpen(false);
    const element = document.getElementById(id);
    if (element) {
      const headerOffset = 110;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="w-full bg-[#0a0a0a] text-neutral-400 font-sans antialiased min-h-screen flex flex-col justify-between">
      {/* HeaderNav */}
      <HeaderNav
        currentPage="docs"
        onNavigate={onNavigate}
        onOpenMcp={onOpenMcp}
        onOpenDiscovery={onOpenDiscovery}
      />

      {/* Main 3-Column Docs Layout */}
      <main className="flex-1 w-full">
        <div className="max-w-[1400px] w-full mx-auto px-6 md:px-12 lg:px-16 py-12 md:py-16">
          
          {/* Mobile Navigation Dropdown (Visible on mobile < lg, hidden on lg+) */}
          <div className="lg:hidden w-full mb-6 sticky top-16 z-30 bg-[#0a0a0a]/95 backdrop-blur-md pt-2 pb-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-neutral-900/90 border border-neutral-800 text-left hover:border-neutral-700 transition-colors shadow-lg active:scale-[0.99]"
              aria-expanded={mobileNavOpen}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <BookOpen className="size-4 text-blue-400 shrink-0" />
                <span className="text-xs text-neutral-400 font-mono">Docs Section:</span>
                <span className="text-xs font-medium text-neutral-100 truncate">
                  {currentSectionLabel}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] font-mono text-neutral-500">
                  {mobileNavOpen ? 'Close' : 'Browse'}
                </span>
                <ChevronDown
                  className={`size-4 text-neutral-400 transition-transform duration-200 ${
                    mobileNavOpen ? 'rotate-180 text-white' : ''
                  }`}
                />
              </div>
            </button>

            {/* Collapsible Dropdown Content */}
            {mobileNavOpen && (
              <div className="mt-2.5 p-4 rounded-2xl bg-neutral-900/95 border border-neutral-800 shadow-2xl space-y-5 max-h-[70vh] overflow-y-auto">
                {/* Search input */}
                <div className="relative w-full">
                  <FaMagnifyingGlass className="size-3 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input
                    type="text"
                    placeholder="Search docs..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="w-full bg-neutral-950 text-neutral-200 placeholder:text-neutral-500 text-xs rounded-xl pl-9 pr-3.5 py-2.5 outline-none border border-neutral-800 focus:border-neutral-700 transition-colors font-mono"
                  />
                </div>

                {/* Navigation groups */}
                <nav className="space-y-4 text-xs">
                  {navSections.map((group) => {
                    const filteredItems = group.items.filter(item =>
                      item.label.toLowerCase().includes(searchFilter.toLowerCase())
                    );
                    if (filteredItems.length === 0) return null;

                    return (
                      <div key={group.title} className="space-y-1.5">
                        <h4 className="font-mono text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">
                          {group.title}
                        </h4>
                        <ul className="space-y-1">
                          {filteredItems.map((item) => (
                            <li key={item.id}>
                              <button
                                type="button"
                                onClick={() => scrollToSection(item.id)}
                                className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between text-xs ${
                                  activeSection === item.id
                                    ? 'bg-neutral-800 text-neutral-100 font-medium'
                                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
                                }`}
                              >
                                <span>{item.label}</span>
                                {activeSection === item.id && (
                                  <span className="size-1.5 rounded-full bg-blue-400" />
                                )}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </nav>

                {/* Quick actions */}
                <div className="pt-2 border-t border-neutral-800/80 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileNavOpen(false);
                      onNavigate('playground');
                    }}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-neutral-100 text-neutral-950 px-3 py-2 text-xs font-medium hover:bg-white transition-colors"
                  >
                    <span>Playground</span>
                    <FaArrowRight className="size-2.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileNavOpen(false);
                      onOpenMcp();
                    }}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-950 text-neutral-300 px-3 py-2 text-xs font-medium hover:border-neutral-700 transition-colors"
                  >
                    <span>Setup MCP</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            
            {/* Column 1: Left Navigation Sidebar (desktop only, 3 cols on lg) */}
            <aside className="hidden lg:block lg:col-span-3 sticky top-24 space-y-6">
              {/* Search input */}
              <div className="relative w-full">
                <FaMagnifyingGlass className="size-3 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Search docs..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full bg-neutral-900/80 focus:bg-neutral-900 text-neutral-200 placeholder:text-neutral-500 text-xs rounded-full pl-9 pr-3.5 py-2 outline-none border border-neutral-800 focus:border-neutral-700 transition-colors font-mono"
                />
              </div>

              {/* Navigation groups */}
              <nav className="space-y-6 text-xs">
                {navSections.map((group) => {
                  const filteredItems = group.items.filter(item =>
                    item.label.toLowerCase().includes(searchFilter.toLowerCase())
                  );
                  if (filteredItems.length === 0) return null;

                  return (
                    <div key={group.title} className="space-y-2">
                      <h4 className="font-mono text-[11px] uppercase tracking-wider text-neutral-500 font-medium">
                        {group.title}
                      </h4>
                      <ul className="space-y-1">
                        {filteredItems.map((item) => (
                          <li key={item.id}>
                            <button
                              type="button"
                              onClick={() => scrollToSection(item.id)}
                              className={`w-full text-left py-1.5 px-3 rounded-lg text-[13px] transition-colors ${
                                activeSection === item.id
                                  ? 'bg-neutral-900 text-neutral-100 font-medium'
                                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50'
                              }`}
                            >
                              {item.label}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </nav>

              {/* Action buttons */}
              <div className="pt-4 space-y-2">
                <button
                  type="button"
                  onClick={() => onNavigate('playground')}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-neutral-100 text-neutral-950 px-4 py-2 text-xs font-medium hover:bg-white transition-colors"
                >
                  <span>Open Playground</span>
                  <FaArrowRight className="size-2.5" />
                </button>
                <button
                  type="button"
                  onClick={onOpenMcp}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/60 text-neutral-300 px-4 py-2 text-xs font-medium hover:border-neutral-700 transition-colors"
                >
                  <span>Setup MCP Server</span>
                </button>
              </div>
            </aside>

            {/* Column 2: Center Documentation Content (6 cols on lg) */}
            <article className="lg:col-span-6 space-y-16 text-neutral-300 leading-relaxed">
              
              {/* Header */}
              <header className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-neutral-900/80 px-3 py-1 text-xs font-mono text-neutral-400 border border-neutral-800">
                  <span>Relay Documentation</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-neutral-100">
                  Building with Relay on Base
                </h1>
                <p className="text-[15px] leading-relaxed text-neutral-400">
                  Relay provides autonomous AI agents with pay per use data endpoints on Base. Requests are settled in native USDC using off-chain EIP-712 signatures, reviving the HTTP status 402 Payment Required standard.
                </p>
              </header>

              {/* Section: Quickstart */}
              <section id="quickstart" className="space-y-4">
                <h2 className="text-2xl font-medium text-neutral-100 tracking-tight">
                  Quickstart
                </h2>
                <p className="text-[14px] text-neutral-400">
                  You can call any Relay endpoint in seconds. When you send an initial POST request without authentication headers, Relay returns status code 402 alongside the payment challenge.
                </p>

                <div className="rounded-xl bg-neutral-950/90 border border-neutral-800/80 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 bg-neutral-900/60 text-xs font-mono text-neutral-400">
                    <span>1. Send unauthenticated request</span>
                    <button
                      onClick={() => copyToClipboard(`curl -X POST https://relay.base.org/api/v1/crypto/price \\\n  -H "Content-Type: application/json" \\\n  -d '{"coins":"bitcoin,ethereum","currencies":"usd"}'`, 'quickstart-curl')}
                      className="hover:text-white transition-colors flex items-center gap-1"
                    >
                      {copiedCode === 'quickstart-curl' ? <FaCheck className="size-2.5 text-emerald-400" /> : <FaCopy className="size-2.5" />}
                      <span>{copiedCode === 'quickstart-curl' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="p-4 text-xs font-mono text-neutral-300 overflow-x-auto">
                    <code>{`curl -X POST https://relay.base.org/api/v1/crypto/price \\
  -H "Content-Type: application/json" \\
  -d '{"coins":"bitcoin,ethereum","currencies":"usd"}'`}</code>
                  </pre>
                </div>

                <p className="text-[14px] text-neutral-400">
                  The gateway responds with HTTP 402 and the JSON payment challenge parameters. Next, your agent signs the payload off-chain and resends the request with the proof header.
                </p>
              </section>

              {/* Section: Core Concepts */}
              <section id="concepts" className="space-y-4">
                <h2 className="text-2xl font-medium text-neutral-100 tracking-tight">
                  Core concepts
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="rounded-xl bg-neutral-900/30 border border-neutral-800/80 p-5 space-y-2">
                    <h3 className="font-medium text-neutral-100 text-sm">RFC x402 Specification</h3>
                    <p className="text-neutral-400 leading-relaxed">
                      Reclaiming HTTP 402 for machine micro-commerce. Eliminates credit card signups, monthly subscriptions, and pre-funded balances.
                    </p>
                  </div>
                  <div className="rounded-xl bg-neutral-900/30 border border-neutral-800/80 p-5 space-y-2">
                    <h3 className="font-medium text-neutral-100 text-sm">ERC-3009 Gasless Transfer</h3>
                    <p className="text-neutral-400 leading-relaxed">
                      Base USDC includes transferWithAuthorization. Sign off-chain without spending ETH on transaction fees.
                    </p>
                  </div>
                </div>
              </section>

              {/* Section: Why Base */}
              <section id="why-base" className="space-y-4">
                <h2 className="text-2xl font-medium text-neutral-100 tracking-tight">
                  Base L2 advantages
                </h2>
                <p className="text-[14px] text-neutral-400">
                  Building Relay directly on Base L2 unlocks critical structural advantages for autonomous agents:
                </p>
                <ul className="space-y-2 text-[14px] text-neutral-300">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="size-4 text-blue-400 shrink-0 mt-1" />
                    <span>Native USDC settlement with dollar parity and zero slippage.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="size-4 text-blue-400 shrink-0 mt-1" />
                    <span>Zero gas overhead: off-chain EIP-712 authorizations eliminate the need for ETH in the consumer wallet.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="size-4 text-blue-400 shrink-0 mt-1" />
                    <span>Native compatibility with Coinbase AgentKit, Cursor, Claude MCP, and standard viem tooling.</span>
                  </li>
                </ul>
              </section>

              {/* Section: The x402 Handshake */}
              <section id="handshake" className="space-y-4">
                <h2 className="text-2xl font-medium text-neutral-100 tracking-tight">
                  The x402 handshake
                </h2>
                <p className="text-[14px] text-neutral-400">
                  The client and gateway interact through a standard four step flow:
                </p>
                <div className="space-y-3 text-xs">
                  <div className="p-4 rounded-xl bg-neutral-900/30 border border-neutral-800/80">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono text-[11px] font-semibold">Step 1</span>
                      <span className="text-neutral-200 font-medium font-sans">Initial request</span>
                    </div>
                    <div className="text-neutral-400 font-mono text-[11px] mt-1.5">POST /api/v1/academic/works with parameters</div>
                  </div>
                  <div className="p-4 rounded-xl bg-neutral-900/30 border border-neutral-800/80">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono text-[11px] font-semibold">Step 2</span>
                      <span className="text-neutral-200 font-medium font-sans">HTTP 402 payment challenge</span>
                    </div>
                    <div className="text-neutral-400 font-mono text-[11px] mt-1.5">Status 402 Payment Required with price, token address, and nonce</div>
                  </div>
                  <div className="p-4 rounded-xl bg-neutral-900/30 border border-neutral-800/80">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono text-[11px] font-semibold">Step 3</span>
                      <span className="text-neutral-200 font-medium font-sans">EIP-712 off-chain signature</span>
                    </div>
                    <div className="text-neutral-400 font-mono text-[11px] mt-1.5">Client signs gasless transfer authorization using local private key</div>
                  </div>
                  <div className="p-4 rounded-xl bg-neutral-900/30 border border-neutral-800/80">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono text-[11px] font-semibold">Step 4</span>
                      <span className="text-neutral-200 font-medium font-sans">HTTP 200 payload delivery</span>
                    </div>
                    <div className="text-neutral-400 font-mono text-[11px] mt-1.5">Gateway validates signature and returns authoritative payload in real time</div>
                  </div>
                </div>
              </section>

              {/* Section: EIP-712 Gasless Signing */}
              <section id="eip712" className="space-y-4">
                <h2 className="text-2xl font-medium text-neutral-100 tracking-tight">
                  EIP-712 gasless signing
                </h2>
                <p className="text-[14px] text-neutral-400">
                  The FiatTokenV2 contract deployed on Base supports TransferWithAuthorization. This allows third parties to submit transfers on your behalf using your signature.
                </p>
                <div className="rounded-xl bg-neutral-950/90 border border-neutral-800/80 p-4 font-mono text-xs">
                  <div className="text-neutral-500 mb-2">Base USDC Address: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913</div>
                  <div className="text-neutral-500">Chain ID: 8453 (Base Mainnet) | 84532 (Base Sepolia)</div>
                </div>
              </section>

              {/* Section: Machine Manifest */}
              <section id="manifest" className="space-y-4">
                <h2 className="text-2xl font-medium text-neutral-100 tracking-tight">
                  Machine manifest
                </h2>
                <p className="text-[14px] text-neutral-400">
                  Autonomous agents can query the root manifest at <code className="text-neutral-200 bg-neutral-900 px-1 py-0.5 rounded">/.well-known/x402</code> to discover all available endpoints, prices, and schema definitions programmatically.
                </p>
                <button
                  onClick={onOpenDiscovery}
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-neutral-300 hover:text-white underline underline-offset-4"
                >
                  <span>Open live discovery manifest viewer</span>
                  <ArrowUpRight className="size-3" />
                </button>
              </section>

              {/* Section: TypeScript and Viem */}
              <section id="ts-sdk" className="space-y-4">
                <h2 className="text-2xl font-medium text-neutral-100 tracking-tight">
                  TypeScript and Viem integration
                </h2>
                <p className="text-[14px] text-neutral-400">
                  Using viem and node-fetch, you can handle the 402 challenge in less than thirty lines of code:
                </p>
                <div className="rounded-xl bg-neutral-950/90 border border-neutral-800/80 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 bg-neutral-900/60 text-xs font-mono text-neutral-400">
                    <span>relay-client.ts</span>
                    <button
                      onClick={() => copyToClipboard(`import { createWalletClient, http } from 'viem';\nimport { privateKeyToAccount } from 'viem/accounts';\nimport { base } from 'viem/chains';\n\nconst account = privateKeyToAccount(process.env.AGENT_KEY as \`0x\${string}\`);\nconst client = createWalletClient({ account, chain: base, transport: http() });`, 'ts-code')}
                      className="hover:text-white transition-colors flex items-center gap-1"
                    >
                      {copiedCode === 'ts-code' ? <FaCheck className="size-2.5 text-emerald-400" /> : <FaCopy className="size-2.5" />}
                      <span>{copiedCode === 'ts-code' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="p-4 text-xs font-mono text-neutral-300 overflow-x-auto">
                    <code>{`import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const account = privateKeyToAccount(process.env.AGENT_KEY as \`0x\${string}\`);
const client = createWalletClient({ account, chain: base, transport: http() });

export async function callRelay(path: string, body: object) {
  let res = await fetch(\`https://relay.base.org\${path}\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (res.status === 402) {
    const challenge = await res.json();
    const signature = await client.signTypedData({
      domain: {
        name: 'USD Coin',
        version: '2',
        chainId: 8453,
        verifyingContract: challenge.paymentRequirements.tokenAddress
      },
      types: {
        TransferWithAuthorization: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'validAfter', type: 'uint256' },
          { name: 'validBefore', type: 'uint256' },
          { name: 'nonce', type: 'bytes32' }
        ]
      },
      primaryType: 'TransferWithAuthorization',
      message: {
        from: account.address,
        to: challenge.paymentRequirements.payTo,
        value: BigInt(challenge.paymentRequirements.amount),
        validAfter: 0n,
        validBefore: BigInt(challenge.paymentRequirements.validBefore),
        nonce: challenge.paymentRequirements.nonce
      }
    });

    res = await fetch(\`https://relay.base.org\${path}\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Payment-Proof': signature,
        'X-Payer-Address': account.address
      },
      body: JSON.stringify(body)
    });
  }

  return await res.json();
}`}</code>
                  </pre>
                </div>
              </section>

              {/* Section: Python Requests */}
              <section id="python-sdk" className="space-y-4">
                <h2 className="text-2xl font-medium text-neutral-100 tracking-tight">
                  Python integration
                </h2>
                <p className="text-[14px] text-neutral-400">
                  In Python, you can use eth-account to sign the typed data and requests to complete the payment:
                </p>
                <div className="rounded-xl bg-neutral-950/90 border border-neutral-800/80 overflow-hidden">
                  <pre className="p-4 text-xs font-mono text-neutral-300 overflow-x-auto">
                    <code>{`import requests
from eth_account import Account

account = Account.from_key("0x...")

res = requests.post("https://relay.base.org/api/v1/weather", json={"query": "Berlin"})
if res.status_code == 402:
    challenge = res.json()
    # Sign EIP-712 payload using account.sign_typed_data
    # Re-send with X-Payment-Proof header`}</code>
                  </pre>
                </div>
              </section>

              {/* Section: MCP Server */}
              <section id="mcp-server" className="space-y-4">
                <h2 className="text-2xl font-medium text-neutral-100 tracking-tight">
                  Model Context Protocol for Cursor and Claude
                </h2>
                <p className="text-[14px] text-neutral-400">
                  Relay includes a native Model Context Protocol server. This allows AI assistants in Claude Desktop and Cursor to execute capabilities autonomously during your prompts.
                </p>
                <button
                  onClick={onOpenMcp}
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-neutral-300 hover:text-white underline underline-offset-4"
                >
                  <span>View Claude Desktop configuration</span>
                  <ArrowUpRight className="size-3" />
                </button>
              </section>

              {/* Section: Endpoints Reference */}
              <section id="endpoints" className="space-y-4">
                <h2 className="text-2xl font-medium text-neutral-100 tracking-tight">
                  Endpoints catalog
                </h2>
                <p className="text-[14px] text-neutral-400">
                  Relay provides twelve live endpoints spanning academic literature, cryptocurrency spot prices, exchange rates, geocoding, weather forecasts, and Wikidata knowledge graphs.
                </p>
                <button
                  onClick={() => onNavigate('capabilities')}
                  className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/60 text-neutral-300 px-4 py-2 text-xs font-medium hover:border-neutral-700 transition-colors"
                >
                  <span>Browse full capabilities directory</span>
                  <FaArrowRight className="size-2.5" />
                </button>
              </section>

            </article>

            {/* Column 3: Right "On this page" TOC & Telemetry (3 cols on lg) */}
            <aside className="lg:col-span-3 sticky top-24 space-y-6 hidden lg:block">
              <div className="space-y-3">
                <h4 className="font-mono text-[11px] uppercase tracking-wider text-neutral-500 font-medium">
                  On this page
                </h4>
                <ul className="space-y-2 text-xs">
                  <li>
                    <a href="#quickstart" className="text-neutral-400 hover:text-neutral-200 transition-colors">
                      Quickstart
                    </a>
                  </li>
                  <li>
                    <a href="#concepts" className="text-neutral-400 hover:text-neutral-200 transition-colors">
                      Core concepts
                    </a>
                  </li>
                  <li>
                    <a href="#why-base" className="text-neutral-400 hover:text-neutral-200 transition-colors">
                      Base L2 advantages
                    </a>
                  </li>
                  <li>
                    <a href="#handshake" className="text-neutral-400 hover:text-neutral-200 transition-colors">
                      The x402 handshake
                    </a>
                  </li>
                  <li>
                    <a href="#eip712" className="text-neutral-400 hover:text-neutral-200 transition-colors">
                      EIP-712 gasless signing
                    </a>
                  </li>
                  <li>
                    <a href="#manifest" className="text-neutral-400 hover:text-neutral-200 transition-colors">
                      Machine manifest
                    </a>
                  </li>
                  <li>
                    <a href="#ts-sdk" className="text-neutral-400 hover:text-neutral-200 transition-colors">
                      TypeScript and Viem
                    </a>
                  </li>
                  <li>
                    <a href="#mcp-server" className="text-neutral-400 hover:text-neutral-200 transition-colors">
                      MCP for Claude and Cursor
                    </a>
                  </li>
                </ul>
              </div>

              {/* Network specs card */}
              <div className="rounded-xl bg-neutral-900/40 border border-neutral-800/80 p-4 space-y-2 text-xs font-mono">
                <div className="text-[11px] text-neutral-500 uppercase tracking-wider font-semibold">Network telemetry</div>
                <div className="flex justify-between text-neutral-400">
                  <span>Network:</span>
                  <span className="text-neutral-200">Base Mainnet (8453)</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>Token:</span>
                  <span className="text-neutral-200">Native USDC</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>Settlement:</span>
                  <span className="text-neutral-200">Gasless ERC-3009</span>
                </div>
                <div className="flex justify-between text-neutral-400 pt-1 border-t border-neutral-800/60">
                  <span>Token Address:</span>
                  <span className="text-neutral-100">0x8335...2913</span>
                </div>
              </div>

              {/* Quick links */}
              <div className="p-4 rounded-xl bg-neutral-900/20 border border-neutral-800/60 text-xs space-y-2">
                <div className="text-neutral-300 font-medium">Need live testing?</div>
                <p className="text-neutral-500 leading-relaxed text-[11px]">
                  Use our interactive testbench to execute live 402 challenges without writing code.
                </p>
                <button
                  onClick={() => onNavigate('playground')}
                  className="text-xs text-neutral-200 hover:text-white font-medium inline-flex items-center gap-1 transition-colors"
                >
                  <span>Go to Playground</span>
                  <FaArrowRight className="size-2.5" />
                </button>
              </div>
            </aside>

          </div>

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

export default DocsPage;
