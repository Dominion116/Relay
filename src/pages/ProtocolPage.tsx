import React, { useState } from 'react';
import { HeaderNav } from '../components/HeaderNav';
import { Footer } from '../components/Footer';
import { FaCheck, FaCopy, FaArrowRight } from 'react-icons/fa6';
import { ArrowUpRight } from 'lucide-react';

interface ProtocolPageProps {
  onNavigate: (page: 'home' | 'capabilities' | 'playground' | 'protocol' | 'docs') => void;
  onOpenMcp: () => void;
  onOpenDiscovery: () => void;
}

export const ProtocolPage: React.FC<ProtocolPageProps> = ({
  onNavigate,
  onOpenMcp,
  onOpenDiscovery
}) => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const eip712Schema = `{
  "types": {
    "EIP712Domain": [
      { "name": "name", "type": "string" },
      { "name": "version", "type": "string" },
      { "name": "chainId", "type": "uint256" },
      { "name": "verifyingContract", "type": "address" }
    ],
    "TransferWithAuthorization": [
      { "name": "from", "type": "address" },
      { "name": "to", "type": "address" },
      { "name": "value", "type": "uint256" },
      { "name": "validAfter", "type": "uint256" },
      { "name": "validBefore", "type": "uint256" },
      { "name": "nonce", "type": "bytes32" }
    ]
  },
  "domain": {
    "name": "USD Coin",
    "version": "2",
    "chainId": 8453,
    "verifyingContract": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
  }
}`;

  const manifestSchema = `{
  "x402Version": 2,
  "name": "Relay Base Gateway",
  "network": "base",
  "chainId": 8453,
  "currency": "USDC",
  "tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "facilitator": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  "endpoints": [
    {
      "id": "crypto_price",
      "path": "/api/v1/crypto/price",
      "costUsdc": "0.01",
      "settlement": "EIP-712 ERC-3009"
    },
    {
      "id": "academic_works",
      "path": "/api/v1/academic/works",
      "costUsdc": "0.03",
      "settlement": "EIP-712 ERC-3009"
    }
  ]
}`;

  return (
    <div className="w-full bg-[#0a0a0a] text-neutral-400 font-sans antialiased min-h-screen flex flex-col justify-between">
      {/* HeaderNav */}
      <HeaderNav
        currentPage="protocol"
        onNavigate={onNavigate}
        onOpenMcp={onOpenMcp}
        onOpenDiscovery={onOpenDiscovery}
      />

      <main className="flex-1 w-full">
        <div className="max-w-[1400px] w-full mx-auto px-6 md:px-12 lg:px-16 py-16 md:py-20">
          
          {/* Page Hero */}
          <div className="max-w-4xl mb-14">
            <span className="text-xs font-mono uppercase tracking-wider text-neutral-500 mb-2 block font-medium">
              Protocol Specification v2.1 • RFC x402 Base EVM
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-neutral-100 mb-4 text-balance">
              The x402 Wire Protocol on Base
            </h1>
            <p className="text-[15px] leading-relaxed text-neutral-400 max-w-2xl">
              A standardized micropayment handshake reviving HTTP status 402 for autonomous AI agents. Built on Base EVM and ERC-3009 gasless authorization primitives.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={() => onNavigate('playground')}
                className="inline-flex items-center gap-2 rounded-full bg-neutral-100 text-neutral-950 px-5 py-2 text-xs font-medium hover:bg-white transition-colors shadow-xs"
              >
                <span>Test in interactive playground</span>
                <FaArrowRight className="size-2.5" />
              </button>
              <button
                onClick={onOpenDiscovery}
                className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/80 text-neutral-300 px-4 py-2 text-xs font-mono hover:border-neutral-700 transition-colors"
              >
                <span>Fetch manifest (/.well-known/x402)</span>
                <ArrowUpRight className="size-3 text-neutral-400" />
              </button>
            </div>
          </div>

          {/* 4-Step Execution Cycle */}
          <section className="mb-16 pt-8" aria-labelledby="protocol-cycle-heading">
            <div className="max-w-2xl mb-8">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-xs font-mono text-neutral-400 mb-4">
                <span className="size-1.5 rounded-full bg-neutral-500" />
                <span>Core handshake</span>
              </div>
              <h2 id="protocol-cycle-heading" className="text-2xl sm:text-3xl font-medium tracking-tight text-neutral-100 mb-3">
                4-step gasless execution cycle
              </h2>
              <p className="text-[15px] leading-relaxed text-neutral-400">
                A standardized HTTP 402 handshake enabling autonomous agent micro-commerce on Base with zero human credentials.
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
                  <h3 className="text-base font-medium text-neutral-100 mb-2">Unauthenticated request</h3>
                  <p className="text-sm text-neutral-400 leading-relaxed font-sans">
                    Client sends a regular HTTP POST. No API key, session, or pre-funding is required.
                  </p>
                </div>
                <div className="mt-5 pt-3 border-t border-neutral-800/80 text-[11px] font-mono text-neutral-400 bg-black/40 rounded-lg p-2.5 border border-neutral-800">
                  <span className="text-neutral-500 block mb-0.5">Wire invocation:</span>
                  <code className="text-neutral-200">POST /api/v1/academic/works</code>
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
                    Gateway yields 402 + payment metadata: USDC price, receiver address, Base chain ID, and nonce.
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
                  <h3 className="text-base font-medium text-neutral-100 mb-2">Off-chain EIP-712 sign</h3>
                  <p className="text-sm text-neutral-400 leading-relaxed font-sans">
                    Agent signs off-chain transfer authorization. Zero ETH gas spent by the requesting agent.
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
                  <h3 className="text-base font-medium text-neutral-100 mb-2">HTTP 200 payload</h3>
                  <p className="text-sm text-neutral-400 leading-relaxed font-sans">
                    Gateway verifies cryptographic proof and returns authoritative live data in real-time.
                  </p>
                </div>
                <div className="mt-5 pt-3 border-t border-neutral-800/80 text-[11px] font-mono text-neutral-400 bg-black/40 rounded-lg p-2.5 border border-neutral-800">
                  <span className="text-neutral-500 block mb-0.5">Fulfilled response:</span>
                  <code className="text-neutral-200">200 OK • Fulfilled</code>
                </div>
              </div>
            </div>
          </section>

          {/* Schemas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16 pt-8">
            <div className="rounded-2xl bg-neutral-900/30 border border-neutral-800/80 p-6 sm:p-8 hover:border-neutral-700/80 transition-colors">
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-neutral-800/80">
                <div>
                  <span className="text-xs font-mono text-blue-400 block mb-0.5">Authorization schema</span>
                  <h3 className="text-lg font-medium text-neutral-100">EIP-712 Typed Data (ERC-3009)</h3>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(eip712Schema, 'eip712')}
                  className="text-xs font-mono text-neutral-300 hover:text-white px-3 py-1.5 rounded-full border border-neutral-800 bg-neutral-900/80 hover:bg-neutral-800 flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {copiedSection === 'eip712' ? <FaCheck className="size-3 text-emerald-400" /> : <FaCopy className="size-3 text-neutral-400" />}
                  <span>{copiedSection === 'eip712' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-sm text-neutral-400 mb-4 leading-relaxed font-sans">
                Official Base USDC (<code className="text-neutral-200 bg-neutral-800 px-1 py-0.5 rounded text-xs font-mono">0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913</code>) supports off-chain gasless transfer authorization:
              </p>
              <pre className="p-4 rounded-xl bg-black/70 text-neutral-300 font-mono text-xs overflow-x-auto leading-relaxed border border-neutral-800/80">
                <code>{eip712Schema}</code>
              </pre>
            </div>

            <div className="rounded-2xl bg-neutral-900/30 border border-neutral-800/80 p-6 sm:p-8 hover:border-neutral-700/80 transition-colors">
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-neutral-800/80">
                <div>
                  <span className="text-xs font-mono text-neutral-400 block mb-0.5">Automated discovery</span>
                  <h3 className="text-lg font-medium text-neutral-100">Machine Manifest (/.well-known/x402)</h3>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(manifestSchema, 'manifest')}
                  className="text-xs font-mono text-neutral-300 hover:text-white px-3 py-1.5 rounded-full border border-neutral-800 bg-neutral-900/80 hover:bg-neutral-800 flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {copiedSection === 'manifest' ? <FaCheck className="size-3 text-emerald-400" /> : <FaCopy className="size-3 text-neutral-400" />}
                  <span>{copiedSection === 'manifest' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-sm text-neutral-400 mb-4 leading-relaxed font-sans">
                Autonomous crawlers query the well-known discovery URI to index pricing, capabilities, and parameters:
              </p>
              <pre className="p-4 rounded-xl bg-black/70 text-neutral-300 font-mono text-xs overflow-x-auto leading-relaxed border border-neutral-800/80">
                <code>{manifestSchema}</code>
              </pre>
            </div>
          </div>

          {/* Comparison Matrix */}
          <div className="rounded-2xl bg-neutral-900/30 border border-neutral-800/80 p-6 sm:p-8 mb-16">
            <div className="max-w-2xl mb-6">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-xs font-mono text-neutral-400 mb-3">
                <span className="size-1.5 rounded-full bg-neutral-500" />
                <span>Architecture comparison</span>
              </div>
              <h2 className="text-2xl font-medium tracking-tight text-neutral-100 mb-2">Traditional Web2 APIs vs Relay (Base L2)</h2>
              <p className="text-sm text-neutral-400 leading-relaxed font-sans">
                Why legacy API billing structures fail modern autonomous AI agents.
              </p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-neutral-800/80">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-900/60 border-b border-neutral-800 text-neutral-400 font-mono">
                    <th scope="col" className="py-3 px-4 font-semibold">Dimension</th>
                    <th scope="col" className="py-3 px-4 font-semibold text-neutral-400">Traditional Web2 APIs</th>
                    <th scope="col" className="py-3 px-4 font-semibold text-blue-400">Relay on Base L2</th>
                    <th scope="col" className="py-3 px-4 font-semibold text-neutral-300">Advantage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 font-sans">
                  <tr className="hover:bg-neutral-900/20 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-neutral-200 font-mono">Settlement asset</td>
                    <td className="py-3.5 px-4 text-neutral-400">Credit cards / monthly fiat invoicing</td>
                    <td className="py-3.5 px-4 text-blue-400 font-medium">Official Native USDC on Base</td>
                    <td className="py-3.5 px-4 text-neutral-300">Zero slippage, native USD backing</td>
                  </tr>
                  <tr className="hover:bg-neutral-900/20 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-neutral-200 font-mono">Gas & setup</td>
                    <td className="py-3.5 px-4 text-neutral-400">Manual dashboard KYC & billing accounts</td>
                    <td className="py-3.5 px-4 text-blue-400 font-medium">Zero ETH (ERC-3009 off-chain sign)</td>
                    <td className="py-3.5 px-4 text-neutral-300">Agent holds only USDC; zero gas bootstrapping</td>
                  </tr>
                  <tr className="hover:bg-neutral-900/20 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-neutral-200 font-mono">Tooling ecosystem</td>
                    <td className="py-3.5 px-4 text-neutral-400">Proprietary vendor SDKs & static tokens</td>
                    <td className="py-3.5 px-4 text-blue-400 font-medium">Coinbase AgentKit, viem, ethers, CDP</td>
                    <td className="py-3.5 px-4 text-neutral-300">Standard web3 and agent framework stack</td>
                  </tr>
                  <tr className="hover:bg-neutral-900/20 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-neutral-200 font-mono">Machine interface</td>
                    <td className="py-3.5 px-4 text-neutral-400">Web dashboard only</td>
                    <td className="py-3.5 px-4 text-blue-400 font-medium">JSON Manifest + Model Context Protocol</td>
                    <td className="py-3.5 px-4 text-neutral-300">Immediate plug-and-play in Cursor & Claude</td>
                  </tr>
                </tbody>
              </table>
            </div>
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
