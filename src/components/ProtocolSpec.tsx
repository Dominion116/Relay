import React from 'react';
import { Check } from 'lucide-react';

export const ProtocolSpec: React.FC = () => {
  return (
    <section id="protocol" className="py-16 border-b border-surface-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mb-10">
          <h2 className="text-2xl font-medium text-ink-primary tracking-tight">The x402 standard on Base</h2>
          <p className="text-sm text-ink-secondary mt-1 font-normal leading-relaxed">
            Reviving the HTTP 402 status code for programmatic micropayments. Autonomous agents purchase context and compute per call without credit card checkout flows.
          </p>
        </div>

        {/* 4-Step Architecture Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5 mb-12">
          <div className="bg-surface border border-surface-border p-4 rounded-lg">
            <div className="text-xs font-mono text-ink-muted mb-2">01</div>
            <h3 className="font-sans font-medium text-ink-primary text-sm mb-1.5">Request capability</h3>
            <p className="text-xs text-ink-secondary leading-relaxed font-sans">
              Agent sends standard HTTP POST to any Relay endpoint without credentials or keys.
            </p>
          </div>

          <div className="bg-surface border border-surface-border p-4 rounded-lg">
            <div className="text-xs font-mono text-ink-muted mb-2">02</div>
            <h3 className="font-sans font-medium text-ink-primary text-sm mb-1.5">402 challenge</h3>
            <p className="text-xs text-ink-secondary leading-relaxed font-sans">
              Gateway responds with HTTP 402 + payment metadata: USDC price, receiver address, Base chain ID, and nonce.
            </p>
          </div>

          <div className="bg-surface border border-surface-border p-4 rounded-lg">
            <div className="text-xs font-mono text-ink-muted mb-2">03</div>
            <h3 className="font-sans font-medium text-ink-primary text-sm mb-1.5">Sign authorization</h3>
            <p className="text-xs text-ink-secondary leading-relaxed font-sans">
              Agent signs off-chain EIP-712 transferWithAuthorization on Base USDC with zero ETH gas required.
            </p>
          </div>

          <div className="bg-surface border border-surface-border p-4 rounded-lg">
            <div className="text-xs font-mono text-ink-muted mb-2">04</div>
            <h3 className="font-sans font-medium text-ink-primary text-sm mb-1.5">Deliver payload</h3>
            <p className="text-xs text-ink-secondary leading-relaxed font-sans">
              Gateway verifies cryptographic signature and immediately returns the verified capability payload.
            </p>
          </div>
        </div>

        {/* Deep Dive Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          <div className="bg-surface border border-surface-border rounded-lg p-5">
            <h3 className="text-sm font-medium text-ink-primary font-mono mb-3">
              Why Base is suited for x402
            </h3>
            <ul className="space-y-3 text-xs font-mono text-ink-secondary">
              <li className="flex items-start gap-2.5">
                <Check className="w-3.5 h-3.5 text-settled shrink-0 mt-0.5" />
                <span>
                  <strong className="text-ink-primary font-medium">Protocol origin:</strong> The x402 specification was incubated at Coinbase specifically for EVM micropayments on Base.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="w-3.5 h-3.5 text-settled shrink-0 mt-0.5" />
                <span>
                  <strong className="text-ink-primary font-medium">ERC-3009 gasless authorization:</strong> Official Base USDC natively supports <code className="text-ink-primary bg-background px-1 py-0.5 rounded">transferWithAuthorization</code>, allowing clients to sign payments off-chain without spending ETH for gas.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="w-3.5 h-3.5 text-settled shrink-0 mt-0.5" />
                <span>
                  <strong className="text-ink-primary font-medium">Agent ecosystem:</strong> Coinbase AgentKit, CDP Wallets, and standard web3 libraries operate natively on Base.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="w-3.5 h-3.5 text-settled shrink-0 mt-0.5" />
                <span>
                  <strong className="text-ink-primary font-medium">Sub-cent settlement:</strong> Base L2 block times and transaction fees make sub-dollar transactions practical.
                </span>
              </li>
            </ul>
          </div>

          <div className="bg-surface border border-surface-border rounded-lg p-5">
            <h3 className="text-sm font-medium text-ink-primary font-mono mb-3">
              Machine discovery (/.well-known/x402)
            </h3>
            <p className="text-xs text-ink-muted font-mono mb-3">
              Automated agents discover capabilities, prices, and schemas via standard JSON manifest:
            </p>

            <div className="bg-background rounded-md p-3 border border-surface-border font-mono text-[11px] text-ink-secondary overflow-x-auto">
              <pre>{`GET /.well-known/x402 HTTP/1.1
Host: relay.xyz

{
  "x402Version": 2,
  "name": "Relay",
  "network": "base",
  "chainId": 8453,
  "resources": [
    {
      "url": "https://relay.xyz/v1/crypto/price",
      "method": "POST",
      "amount": "40000",
      "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "payTo": "0x892a0e28f3D343054eA8C0a3eA625dC0bA0241A5"
    }
  ]
}`}</pre>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
