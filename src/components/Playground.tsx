import React, { useState } from 'react';
import {
  Play,
  Copy,
  Check,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Terminal
} from 'lucide-react';
import { RELAY_RESOURCES, generate402Challenge, verifyPaymentProof, dispatchResourceRequest } from '../server/x402Engine';
import { getOrCreateAgentWallet, signChallengeWithAgentKey } from '../server/agentWallet';
import { X402Challenge, X402VerificationResult } from '../types/x402';

interface PlaygroundProps {
  network: 'base' | 'base-sepolia';
  agentBalance: number;
  onDeductBalance: (amountUsdc: number) => void;
}

export const Playground: React.FC<PlaygroundProps> = ({ network, agentBalance, onDeductBalance }) => {
  const [selectedResourceId, setSelectedResourceId] = useState<string>('crypto_price');
  const [requestBodyText, setRequestBodyText] = useState<string>(
    JSON.stringify(RELAY_RESOURCES.find(r => r.id === 'crypto_price')?.defaultParams || {}, null, 2)
  );
  const [activeTab, setActiveTab] = useState<'console' | 'curl' | 'python' | 'ts'>('console');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Execution state
  const [executing, setExecuting] = useState<boolean>(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [challenge402, setChallenge402] = useState<X402Challenge | null>(null);
  const [verificationResult, setVerificationResult] = useState<X402VerificationResult | null>(null);
  const [responseData, setResponseData] = useState<any>(null);
  const [executionTimeMs, setExecutionTimeMs] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedResource = RELAY_RESOURCES.find(r => r.id === selectedResourceId) || RELAY_RESOURCES[0];

  const handleSelectResource = (id: string) => {
    setSelectedResourceId(id);
    const r = RELAY_RESOURCES.find(res => res.id === id);
    if (r) {
      setRequestBodyText(JSON.stringify(r.defaultParams, null, 2));
    }
    setChallenge402(null);
    setVerificationResult(null);
    setResponseData(null);
    setStep(1);
    setErrorMsg(null);
  };

  const handleRunRequest = async () => {
    setExecuting(true);
    setErrorMsg(null);
    const startTime = performance.now();

    try {
      setStep(1);
      await new Promise(r => setTimeout(r, 150));

      setStep(2);
      const challenge = generate402Challenge(selectedResource, network);
      setChallenge402(challenge);
      await new Promise(r => setTimeout(r, 350));

      if (agentBalance < selectedResource.priceUsdc) {
        throw new Error(`Insufficient agent balance ($${agentBalance.toFixed(2)} USDC). Required: $${selectedResource.priceUsdc.toFixed(2)} USDC.`);
      }

      setStep(3);
      await new Promise(r => setTimeout(r, 300));

      let parsedParams = {};
      try {
        parsedParams = JSON.parse(requestBodyText);
      } catch {
        throw new Error("Invalid JSON in request body");
      }

      const wallet = getOrCreateAgentWallet();
      const proof = await signChallengeWithAgentKey(wallet.privateKey, challenge);

      const verification = await verifyPaymentProof(proof, selectedResource, challenge);
      setVerificationResult(verification);
      onDeductBalance(selectedResource.priceUsdc);

      const data = await dispatchResourceRequest(selectedResource.id, parsedParams);
      setResponseData(data);
      setStep(4);
      setExecutionTimeMs(Math.round(performance.now() - startTime));
    } catch (err: any) {
      setErrorMsg(err.message || 'Execution error');
    } finally {
      setExecuting(false);
    }
  };

  const getCurlSnippet = () => {
    return `# 1. Request endpoint (returns HTTP 402 with Base payment parameters)
curl -X POST https://relayx402.vercel.app${selectedResource.path} \\
  -H "Content-Type: application/json" \\
  -d '${requestBodyText.replace(/\n/g, '').replace(/\s+/g, ' ')}'

# 2. Retry with Base EIP-712 USDC transfer authorization
curl -X POST https://relayx402.vercel.app${selectedResource.path} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: x402 <base_eip712_signature>" \\
  -d '${requestBodyText.replace(/\n/g, '').replace(/\s+/g, ' ')}'`;
  };

  const getPythonSnippet = () => {
    return `import requests

url = "https://relayx402.vercel.app${selectedResource.path}"
payload = ${requestBodyText}

# Request endpoint
res = requests.post(url, json=payload)

if res.status_code == 402:
    challenge = res.json()["paymentRequirements"]
    print(f"Payment required: {challenge['amountFormatted']} on Base")
    # Attach signed authorization header and retry`;
  };

  const getTsSnippet = () => {
    return `import { RelayClient } from '@relay/sdk';

const client = new RelayClient({
  network: '${network}',
  privateKey: process.env.BASE_PRIVATE_KEY
});

// Automatically negotiates 402 and signs USDC authorization inline
const result = await client.post('${selectedResource.path}', ${requestBodyText.replace(/\n/g, '').replace(/\s+/g, ' ')});
console.log(result);`;
  };

  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  return (
    <section id="playground" className="py-16 border-b border-surface-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-baseline justify-between mb-8 gap-3">
          <div>
            <h2 className="text-2xl font-medium text-ink-primary tracking-tight">Interactive playground</h2>
            <p className="text-xs text-ink-muted font-mono mt-1">
              Select an endpoint, inspect the 402 challenge, and test live settlement on Base.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-ink-muted">Price:</span>
            <span className="px-2 py-0.5 rounded bg-surface border border-surface-border text-ink-primary tabular-nums font-medium">
              ${selectedResource.priceUsdc.toFixed(2)} USDC
            </span>
            <span className="text-ink-muted">({selectedResource.amount} units)</span>
          </div>
        </div>

        {/* Playground Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* Left Column: Form & Stepper (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            
            {/* Endpoint Selector Card */}
            <div className="bg-surface border border-surface-border rounded-lg p-4">
              <label className="block text-xs font-mono text-ink-muted mb-2">
                Endpoint
              </label>
              <select
                value={selectedResourceId}
                onChange={e => handleSelectResource(e.target.value)}
                className="w-full bg-background border border-surface-border rounded-md px-3 py-2 text-xs text-ink-primary font-mono focus:outline-none focus:border-ink-muted"
              >
                <optgroup label="Academic & Research">
                  <option value="academic_search">Academic Search (OpenAlex) : $0.08 USDC</option>
                  <option value="academic_work">Academic Work DOI : $0.06 USDC</option>
                  <option value="research">Deterministic Research Pack : $0.10 USDC</option>
                  <option value="verify">Claim Verification : $0.12 USDC</option>
                </optgroup>
                <optgroup label="Crypto & Financial Markets">
                  <option value="crypto_price">Crypto Spot Prices (CoinGecko) : $0.04 USDC</option>
                  <option value="crypto_market">Crypto Market Metrics : $0.06 USDC</option>
                  <option value="fx_rates">Forex Reference Rates (ECB) : $0.04 USDC</option>
                </optgroup>
                <optgroup label="Geographic & Weather">
                  <option value="weather">Weather Forecast (Open-Meteo) : $0.05 USDC</option>
                  <option value="geocode">Geocoding (Photon) : $0.04 USDC</option>
                </optgroup>
                <optgroup label="News & Knowledge">
                  <option value="news_search">News Search : $0.08 USDC</option>
                  <option value="knowledge_search">Wikidata Entity Search : $0.06 USDC</option>
                  <option value="holidays">Public Holidays (Nager.Date) : $0.04 USDC</option>
                </optgroup>
              </select>

              <div className="mt-2.5 text-xs text-ink-secondary">
                <p className="line-clamp-2">{selectedResource.description}</p>
              </div>
            </div>

            {/* Request Body JSON Editor */}
            <div className="bg-surface border border-surface-border rounded-lg p-4 flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-mono text-ink-muted">
                  Parameters
                </label>
                <button
                  onClick={() => setRequestBodyText(JSON.stringify(selectedResource.defaultParams, null, 2))}
                  className="text-[11px] font-mono text-ink-muted hover:text-ink-primary transition-colors flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
              </div>

              <textarea
                value={requestBodyText}
                onChange={e => setRequestBodyText(e.target.value)}
                rows={6}
                className="w-full bg-background border border-surface-border rounded-md p-3 text-xs font-mono text-ink-primary focus:outline-none focus:border-ink-muted resize-none leading-relaxed"
                spellCheck={false}
              />

              {/* Action Button */}
              <div className="mt-4 pt-3 border-t border-surface-border flex items-center justify-between">
                <div className="text-[11px] font-mono text-ink-muted">
                  Chain: <span className="text-ink-secondary font-medium">{network}</span>
                </div>

                <button
                  onClick={handleRunRequest}
                  disabled={executing}
                  className={`px-4 py-2 rounded-md font-mono text-xs font-medium flex items-center gap-2 transition-colors ${
                    executing
                      ? 'bg-surface-raised text-ink-muted cursor-not-allowed'
                      : 'bg-ink-primary hover:bg-white text-background'
                  }`}
                >
                  {executing ? (
                    <>
                      <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                      <span>Negotiating x402...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Execute request</span>
                    </>
                  )}
                </button>
              </div>

              {errorMsg && (
                <div className="mt-3 p-2.5 rounded bg-surface-raised border border-surface-border text-red-400 text-xs font-mono flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>

            {/* Stepper Status */}
            <div className="bg-surface border border-surface-border rounded-lg p-3 font-mono text-xs">
              <span className="text-[10px] text-ink-muted font-medium block mb-2">Protocol state</span>
              <div className="grid grid-cols-4 gap-1.5 text-center text-[11px]">
                <div className={`py-1 rounded border ${step >= 1 ? 'border-surface-highlight text-ink-primary bg-surface-raised' : 'border-transparent text-ink-muted'}`}>
                  1. Request
                </div>
                <div className={`py-1 rounded border ${step >= 2 ? 'border-surface-highlight text-ink-primary bg-surface-raised' : 'border-transparent text-ink-muted'}`}>
                  2. 402 challenge
                </div>
                <div className={`py-1 rounded border ${step >= 3 ? 'border-surface-highlight text-ink-primary bg-surface-raised' : 'border-transparent text-ink-muted'}`}>
                  3. Sign authorization
                </div>
                <div className={`py-1 rounded border ${step >= 4 ? 'border-settled/30 text-settled bg-settled-subtle font-medium' : 'border-transparent text-ink-muted'}`}>
                  4. 200 OK
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Console & Code Snippets (7 cols) */}
          <div className="lg:col-span-7 flex flex-col">
            <div className="bg-surface border border-surface-border rounded-lg flex-1 flex flex-col overflow-hidden">
              
              {/* Output Tabs Header */}
              <div className="flex items-center justify-between border-b border-surface-border px-3 py-2 bg-surface-raised/40">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveTab('console')}
                    className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                      activeTab === 'console'
                        ? 'bg-surface text-ink-primary font-medium border border-surface-border'
                        : 'text-ink-muted hover:text-ink-secondary'
                    }`}
                  >
                    Console
                  </button>
                  <button
                    onClick={() => setActiveTab('curl')}
                    className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                      activeTab === 'curl'
                        ? 'bg-surface text-ink-primary font-medium border border-surface-border'
                        : 'text-ink-muted hover:text-ink-secondary'
                    }`}
                  >
                    cURL
                  </button>
                  <button
                    onClick={() => setActiveTab('python')}
                    className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                      activeTab === 'python'
                        ? 'bg-surface text-ink-primary font-medium border border-surface-border'
                        : 'text-ink-muted hover:text-ink-secondary'
                    }`}
                  >
                    Python
                  </button>
                  <button
                    onClick={() => setActiveTab('ts')}
                    className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                      activeTab === 'ts'
                        ? 'bg-surface text-ink-primary font-medium border border-surface-border'
                        : 'text-ink-muted hover:text-ink-secondary'
                    }`}
                  >
                    TypeScript
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono">
                  {executionTimeMs > 0 && activeTab === 'console' && (
                    <span className="text-ink-muted flex items-center gap-1 tabular-nums">
                      <Clock className="w-3.5 h-3.5" /> {executionTimeMs}ms
                    </span>
                  )}
                  {activeTab !== 'console' && (
                    <button
                      onClick={() => handleCopyCode(
                        activeTab === 'curl' ? getCurlSnippet() : activeTab === 'python' ? getPythonSnippet() : getTsSnippet()
                      )}
                      className="text-ink-muted hover:text-ink-primary flex items-center gap-1 transition-colors"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-settled" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Console Body */}
              <div className="p-4 flex-1 bg-background overflow-auto font-mono text-xs">
                {activeTab === 'console' && (
                  <div className="space-y-4">
                    {/* Verification receipt */}
                    {verificationResult && (
                      <div className="bg-surface border border-surface-border rounded p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-settled font-medium">
                          <ShieldCheck className="w-4 h-4 text-settled" />
                          <span>Base settlement verified</span>
                        </div>
                        <div className="text-[11px] text-ink-secondary truncate max-w-[240px]">
                          TxHash: <span className="text-ink-primary">{verificationResult.txHash}</span>
                        </div>
                        <div className="text-[11px] text-ink-muted tabular-nums">
                          {verificationResult.settledAt?.split('T')[1].replace('Z', '')} UTC
                        </div>
                      </div>
                    )}

                    {/* 402 challenge output */}
                    {challenge402 && (
                      <div className="bg-surface/60 border border-surface-border rounded p-3">
                        <div className="flex items-center justify-between mb-2 text-xs text-ink-secondary font-medium">
                          <span>HTTP 402 Payment Required</span>
                          <span className="text-ink-muted">Chain ID: {challenge402.paymentRequirements.chainId}</span>
                        </div>
                        <pre className="text-[11px] text-ink-secondary overflow-x-auto p-2 bg-background rounded border border-surface-border leading-relaxed">
                          {JSON.stringify(challenge402, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* 200 response data */}
                    {responseData ? (
                      <div>
                        <div className="flex items-center justify-between mb-2 text-xs">
                          <span className="text-settled font-medium flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            HTTP 200 OK
                          </span>
                          <span className="text-ink-muted">{selectedResource.path}</span>
                        </div>
                        <pre className="text-[11px] text-ink-primary overflow-x-auto p-3 bg-surface rounded border border-surface-border leading-relaxed">
                          {JSON.stringify(responseData, null, 2)}
                        </pre>
                      </div>
                    ) : (
                      !challenge402 && (
                        <div className="h-56 flex flex-col items-center justify-center text-ink-muted font-mono text-center">
                          <Terminal className="w-8 h-8 mb-2 text-ink-muted/50" />
                          <p className="text-xs text-ink-secondary">Ready to execute</p>
                          <p className="text-[11px] text-ink-muted mt-1 max-w-xs">
                            Select an endpoint and run to observe the HTTP 402 challenge, Base authorization, and response.
                          </p>
                        </div>
                      )
                    )}
                  </div>
                )}

                {activeTab === 'curl' && (
                  <pre className="text-ink-secondary text-xs leading-relaxed overflow-x-auto">
                    {getCurlSnippet()}
                  </pre>
                )}

                {activeTab === 'python' && (
                  <pre className="text-ink-secondary text-xs leading-relaxed overflow-x-auto">
                    {getPythonSnippet()}
                  </pre>
                )}

                {activeTab === 'ts' && (
                  <pre className="text-ink-secondary text-xs leading-relaxed overflow-x-auto">
                    {getTsSnippet()}
                  </pre>
                )}
              </div>

              {/* Console Footer */}
              <div className="px-4 py-2 border-t border-surface-border bg-surface-raised/20 flex items-center justify-between text-[11px] font-mono text-ink-muted">
                <span>Contract: <code className="text-ink-secondary">{selectedResource.asset.slice(0, 8)}...{selectedResource.asset.slice(-6)}</code></span>
                <span>Receiver: <code className="text-ink-secondary">{selectedResource.payTo.slice(0, 8)}...{selectedResource.payTo.slice(-6)}</code></span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
