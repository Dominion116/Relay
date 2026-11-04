import React, { useState } from 'react';
import { HeaderNav } from '../components/HeaderNav';
import { Footer } from '../components/Footer';
import { RELAY_RESOURCES, generate402Challenge, verifyPaymentProof, dispatchResourceRequest } from '../server/x402Engine';
import { X402Challenge, X402VerificationResult, X402PaymentProof } from '../types/x402';
import { FaPlay, FaCopy, FaCheck, FaRotateLeft } from 'react-icons/fa6';
import { AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface PlaygroundPageProps {
  onNavigate: (page: 'home' | 'capabilities' | 'playground' | 'protocol' | 'docs') => void;
  network: 'base' | 'base-sepolia';
  setNetwork: (net: 'base' | 'base-sepolia') => void;
  agentBalance: number;
  onDeductBalance: (amountUsdc: number) => void;
  onOpenMcp: () => void;
  onOpenDiscovery: () => void;
  onResetBalance: () => void;
  initialResourceId?: string;
  initialQuery?: string;
}

export const PlaygroundPage: React.FC<PlaygroundPageProps> = ({
  onNavigate,
  network,
  setNetwork,
  agentBalance,
  onDeductBalance,
  onOpenMcp,
  onOpenDiscovery,
  onResetBalance,
  initialResourceId = 'crypto_price',
  initialQuery
}) => {
  const [selectedResourceId, setSelectedResourceId] = useState<string>(initialResourceId);

  const initialResource = RELAY_RESOURCES.find(r => r.id === initialResourceId) || RELAY_RESOURCES[0];
  const initialParams = initialQuery && initialResource.defaultParams.query !== undefined
    ? { ...initialResource.defaultParams, query: initialQuery }
    : initialResource.defaultParams;

  const [requestBodyText, setRequestBodyText] = useState<string>(
    JSON.stringify(initialParams, null, 2)
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
    const res = RELAY_RESOURCES.find(r => r.id === id);
    if (res) {
      setRequestBodyText(JSON.stringify(res.defaultParams, null, 2));
    }
    setStep(1);
    setChallenge402(null);
    setVerificationResult(null);
    setResponseData(null);
    setErrorMsg(null);
  };

  const handleExecute = async () => {
    let parsedParams: any = {};
    try {
      parsedParams = JSON.parse(requestBodyText);
    } catch (e: any) {
      setErrorMsg(`Invalid JSON input: ${e.message}`);
      return;
    }

    const cost = selectedResource.priceUsdc;
    if (agentBalance < cost) {
      setErrorMsg(`Insufficient agent balance ($${agentBalance.toFixed(2)} USDC). Requires $${cost.toFixed(2)} USDC.`);
      return;
    }

    setExecuting(true);
    setErrorMsg(null);
    setStep(1);
    const startTime = performance.now();

    try {
      // Step 1: Initial unauthenticated request -> Step 2: 402 Challenge
      await new Promise(r => setTimeout(r, 400));
      const challenge = generate402Challenge(selectedResource, network);
      setChallenge402(challenge);
      setStep(2);

      // Step 2 -> Step 3: Simulate EIP-712 client signature
      await new Promise(r => setTimeout(r, 550));
      setStep(3);

      const fakeProof = `0x${Array.from({ length: 65 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
      const payerAddress = '0x1234567890abcdef1234567890abcdef12345678';

      const proofObj: X402PaymentProof = {
        scheme: 'transferWithAuthorization',
        payerAddress,
        clientSignature: fakeProof,
        timestamp: Date.now()
      };

      // Step 3 -> Step 4: Verification and Live Data Dispatch
      await new Promise(r => setTimeout(r, 450));
      const verification = verifyPaymentProof(proofObj, selectedResource);
      setVerificationResult(verification);

      if (!verification.valid) {
        throw new Error(verification.error || 'Cryptographic signature verification failed.');
      }

      onDeductBalance(cost);
      const data = await dispatchResourceRequest(selectedResource.id, parsedParams);
      setResponseData(data);
      setStep(4);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error executing request.');
    } finally {
      const endTime = performance.now();
      setExecutionTimeMs(Math.round(endTime - startTime));
      setExecuting(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const getCurlSnippet = () => {
    return `# Step 1: Request (receives 402 Challenge)
curl -X POST https://relay.base.org${selectedResource.path} \\
  -H "Content-Type: application/json" \\
  -d '${requestBodyText.replace(/\n/g, ' ')}'

# Step 2: Sign EIP-712 authorization & re-send with proof header
curl -X POST https://relay.base.org${selectedResource.path} \\
  -H "Content-Type: application/json" \\
  -H "X-Payment-Proof: 0x<EIP712_SIGNATURE>" \\
  -H "X-Payer-Address: 0x<YOUR_BASE_WALLET>" \\
  -d '${requestBodyText.replace(/\n/g, ' ')}'`;
  };

  const getPythonSnippet = () => {
    return `import requests
from eth_account import Account

# 1. Unauthenticated POST
url = "https://relay.base.org${selectedResource.path}"
payload = ${requestBodyText}
res = requests.post(url, json=payload)

if res.status_code == 402:
    challenge = res.json()
    # 2. Sign EIP-712 transfer authorization for Base USDC
    account = Account.from_key("0x<PRIVATE_KEY>")
    # Sign typed data using challenge["paymentRequirements"]
    
    # 3. Deliver proof
    headers = {
        "X-Payment-Proof": "0x...",
        "X-Payer-Address": account.address
    }
    data = requests.post(url, json=payload, headers=headers).json()
    print("Authoritative response:", data)`;
  };

  const getTsSnippet = () => {
    return `import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as \`0x\${string}\`);
const wallet = createWalletClient({ account, chain: base, transport: http() });

// 1. Initial Request
let res = await fetch('https://relay.base.org${selectedResource.path}', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(${requestBodyText})
});

// 2. Handle HTTP 402 Challenge
if (res.status === 402) {
  const challenge = await res.json();
  const signature = await wallet.signTypedData({
    domain: { name: 'USD Coin', version: '2', chainId: 8453, verifyingContract: challenge.paymentRequirements.tokenAddress },
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

  // 3. Fulfill Capability
  res = await fetch('https://relay.base.org${selectedResource.path}', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Payment-Proof': signature,
      'X-Payer-Address': account.address
    },
    body: JSON.stringify(${requestBodyText})
  });
}

const data = await res.json();
console.log(data);`;
  };

  return (
    <div className="w-full bg-[#0a0a0a] text-neutral-400 font-sans antialiased min-h-screen flex flex-col justify-between">
      {/* HeaderNav with unified dark dashed styling */}
      <HeaderNav
        currentPage="playground"
        onNavigate={onNavigate}
        network={network}
        setNetwork={setNetwork}
        agentBalance={agentBalance}
        onOpenMcp={onOpenMcp}
        onOpenDiscovery={onOpenDiscovery}
        onResetBalance={onResetBalance}
      />

      <main className="flex-1 w-full">
        <div className="max-w-[1400px] w-full mx-auto px-6 md:px-12 lg:px-16 py-16 md:py-20">
          
          {/* Page Title */}
          <div className="max-w-3xl mb-10">
            <span className="text-xs font-mono uppercase tracking-wider text-neutral-500 mb-2 block font-medium">
              Simulation & Inspector
            </span>
            <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-neutral-100 mb-4">
              Simulate x402 payments on Base
            </h1>
            <p className="text-[15px] leading-relaxed text-neutral-400 max-w-2xl">
              Send raw requests to any endpoint. Watch the gateway return HTTP 402 Payment Required, sign the EIP-712 transfer authorization, and receive the live verified payload.
            </p>
          </div>

          {/* 2-Column Playground Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-16">
            
            {/* Left Column: Config & Request Form (5 cols) */}
            <div className="lg:col-span-5 rounded-2xl bg-neutral-900/30 border border-neutral-800 p-6 md:p-7 flex flex-col justify-between">
              <div>
                {/* Endpoint Selector */}
                <div className="mb-5">
                  <label className="block text-xs font-mono font-medium text-neutral-400 uppercase tracking-wider mb-2">
                    Select Endpoint
                  </label>
                  <select
                    value={selectedResourceId}
                    onChange={(e) => handleSelectResource(e.target.value)}
                    className="w-full bg-neutral-900 text-neutral-200 border border-neutral-700/80 rounded-xl px-4 py-2.5 text-xs font-mono outline-none focus:border-neutral-500"
                  >
                    {RELAY_RESOURCES.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} : ${r.priceUsdc.toFixed(2)} USDC ({r.category})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Endpoint Telemetry */}
                <div className="rounded-xl bg-neutral-950/60 p-4 border border-neutral-800/80 mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-medium text-neutral-400">Method & Route</span>
                    <span className="text-xs font-mono font-medium text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                      ${selectedResource.priceUsdc.toFixed(2)} USDC
                    </span>
                  </div>
                  <div className="font-mono text-xs text-neutral-200 font-semibold break-all">
                    POST {selectedResource.path}
                  </div>
                  <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
                    {selectedResource.description}
                  </p>
                </div>

                {/* JSON Parameter Editor */}
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-mono font-medium text-neutral-400 uppercase tracking-wider">
                      Request Parameters (JSON)
                    </label>
                    <button
                      onClick={() => setRequestBodyText(JSON.stringify(selectedResource.defaultParams, null, 2))}
                      className="text-[11px] font-mono text-neutral-500 hover:text-neutral-300 flex items-center gap-1 transition-colors"
                    >
                      <FaRotateLeft className="size-2.5" />
                      <span>Reset</span>
                    </button>
                  </div>
                  <textarea
                    value={requestBodyText}
                    onChange={(e) => setRequestBodyText(e.target.value)}
                    rows={8}
                    className="w-full rounded-xl bg-black/60 text-neutral-200 p-4 font-mono text-xs outline-none border border-neutral-800 focus:border-neutral-700 resize-none leading-relaxed"
                  />
                </div>

                {errorMsg && (
                  <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3.5 mb-5 flex items-start gap-2 text-rose-400 text-xs font-mono">
                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}
              </div>

              {/* Execute Button */}
              <motion.button
                onClick={handleExecute}
                disabled={executing}
                whileTap={{ scale: 0.98 }}
                className="w-full min-h-11 rounded-full bg-neutral-100 text-neutral-950 font-medium text-sm flex items-center justify-center gap-2 hover:bg-white disabled:opacity-50 transition-colors shadow-sm"
              >
                <FaPlay className="size-2.5" />
                <span>{executing ? 'Executing Handshake...' : `Execute via x402 ($${selectedResource.priceUsdc.toFixed(2)} USDC)`}</span>
              </motion.button>
            </div>

            {/* Right Column: Handshake State & Console (7 cols) */}
            <div className="lg:col-span-7 rounded-2xl bg-neutral-900/30 border border-neutral-800 p-6 md:p-7 flex flex-col justify-between">
              <div>
                {/* 4-Step Handshake Progress Indicators */}
                <div className="mb-6">
                  <span className="text-xs font-mono text-neutral-400 uppercase tracking-wider block mb-3 font-medium">
                    Protocol Handshake Execution
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    <div className={`p-2.5 rounded-xl border text-center transition-all ${
                      step >= 1 ? 'bg-neutral-800/90 border-blue-500/60 text-blue-400 font-medium' : 'bg-neutral-900/40 border-neutral-800/80 text-neutral-500'
                    }`}>
                      <div className="text-[10px] font-mono">STEP 1</div>
                      <div className="text-xs truncate mt-0.5">1. Request</div>
                    </div>
                    <div className={`p-2.5 rounded-xl border text-center transition-all ${
                      step >= 2 ? 'bg-neutral-800/90 border-blue-500/60 text-blue-400 font-medium' : 'bg-neutral-900/40 border-neutral-800/80 text-neutral-500'
                    }`}>
                      <div className="text-[10px] font-mono">STEP 2</div>
                      <div className="text-xs truncate mt-0.5">2. 402 Challenge</div>
                    </div>
                    <div className={`p-2.5 rounded-xl border text-center transition-all ${
                      step >= 3 ? 'bg-neutral-800/90 border-blue-500/60 text-blue-400 font-medium' : 'bg-neutral-900/40 border-neutral-800/80 text-neutral-500'
                    }`}>
                      <div className="text-[10px] font-mono">STEP 3</div>
                      <div className="text-xs truncate mt-0.5">3. EIP-712 Sign</div>
                    </div>
                    <div className={`p-2.5 rounded-xl border text-center transition-all ${
                      step >= 4 ? 'bg-neutral-800/90 border-blue-500/60 text-blue-400 font-medium' : 'bg-neutral-900/40 border-neutral-800/80 text-neutral-500'
                    }`}>
                      <div className="text-[10px] font-mono">STEP 4</div>
                      <div className="text-xs truncate mt-0.5">4. 200 Payload</div>
                    </div>
                  </div>
                </div>

                {/* Console Tabs */}
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-neutral-800/80">
                  <div className="flex items-center gap-2" role="tablist" aria-label="Playground output format tabs">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeTab === 'console'}
                      onClick={() => setActiveTab('console')}
                      className={`px-3 py-1 rounded-full text-xs font-mono font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        activeTab === 'console' ? 'bg-neutral-100 text-neutral-950 font-semibold' : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      Console Output
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeTab === 'curl'}
                      onClick={() => setActiveTab('curl')}
                      className={`px-3 py-1 rounded-full text-xs font-mono font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        activeTab === 'curl' ? 'bg-neutral-100 text-neutral-950 font-semibold' : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      cURL
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeTab === 'python'}
                      onClick={() => setActiveTab('python')}
                      className={`px-3 py-1 rounded-full text-xs font-mono font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        activeTab === 'python' ? 'bg-neutral-100 text-neutral-950 font-semibold' : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      Python
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeTab === 'ts'}
                      onClick={() => setActiveTab('ts')}
                      className={`px-3 py-1 rounded-full text-xs font-mono font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        activeTab === 'ts' ? 'bg-neutral-100 text-neutral-950 font-semibold' : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      TypeScript
                    </button>
                  </div>

                  {activeTab !== 'console' && (
                    <button
                      type="button"
                      onClick={() => {
                        const code = activeTab === 'curl' ? getCurlSnippet() : activeTab === 'python' ? getPythonSnippet() : getTsSnippet();
                        copyCode(code);
                      }}
                      className="text-xs font-mono text-neutral-300 hover:text-white flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-800"
                    >
                      {copiedCode ? <FaCheck className="size-3 text-emerald-400" /> : <FaCopy className="size-3 text-neutral-400" />}
                      <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                </div>

                {/* Content Panel */}
                {activeTab === 'console' && (
                  <div className="rounded-xl bg-black/80 text-neutral-300 p-4 font-mono text-xs border border-neutral-800/80 overflow-x-auto min-h-[300px] max-h-[460px] overflow-y-auto leading-relaxed">
                    {step === 1 && !executing && !responseData && (
                      <div className="text-neutral-500 py-16 text-center font-sans">
                        Click <strong className="text-neutral-200 font-mono">"Execute via x402"</strong> to launch simulation.
                      </div>
                    )}

                    {challenge402 && (
                      <div className="mb-4 pb-4 border-b border-neutral-800/80">
                        <div className="text-neutral-200 font-semibold mb-1 flex items-center gap-2">
                          <span className="size-1.5 rounded-full bg-blue-500" />
                          <span>HTTP/1.1 402 Payment Required</span>
                        </div>
                        <div className="text-neutral-400 text-[11px] mb-2 font-mono">
                          Receiver: {challenge402.paymentRequirements.payTo} • Token: Base USDC ({challenge402.paymentRequirements.tokenAddress})
                        </div>
                        <pre className="text-neutral-300 text-[11px] bg-black/50 p-3 rounded-lg border border-neutral-800">
                          {JSON.stringify(challenge402, null, 2)}
                        </pre>
                      </div>
                    )}

                    {verificationResult && (
                      <div className="mb-4 pb-4 border-b border-neutral-800/80">
                        <div className="text-neutral-200 font-semibold mb-1 flex items-center gap-2">
                          <span className="size-1.5 rounded-full bg-blue-500" />
                          <span>Cryptographic Proof Verification</span>
                        </div>
                        <div className="text-neutral-300 text-[11px]">
                          Status: <span className="text-emerald-400 font-semibold">VALID_SIGNATURE</span>
                          <br />
                          Payer: {verificationResult.payer}
                        </div>
                      </div>
                    )}

                    {responseData && (
                      <div>
                        <div className="text-emerald-400 font-semibold mb-1">
                          HTTP/1.1 200 OK • Payload Fulfilled ({executionTimeMs}ms)
                        </div>
                        <pre className="text-neutral-300 text-[11px]">
                          {JSON.stringify(responseData, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'curl' && (
                  <pre className="rounded-xl bg-black/80 text-neutral-300 p-4 font-mono text-xs overflow-x-auto min-h-[300px] leading-relaxed border border-neutral-800/80">
                    <code>{getCurlSnippet()}</code>
                  </pre>
                )}

                {activeTab === 'python' && (
                  <pre className="rounded-xl bg-black/80 text-neutral-300 p-4 font-mono text-xs overflow-x-auto min-h-[300px] leading-relaxed border border-neutral-800/80">
                    <code>{getPythonSnippet()}</code>
                  </pre>
                )}

                {activeTab === 'ts' && (
                  <pre className="rounded-xl bg-black/80 text-neutral-300 p-4 font-mono text-xs overflow-x-auto min-h-[300px] leading-relaxed border border-neutral-800/80">
                    <code>{getTsSnippet()}</code>
                  </pre>
                )}
              </div>

              {/* Status bar */}
              <div className="mt-5 pt-3 flex items-center justify-between text-xs font-mono text-neutral-500">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-blue-500" />
                  Network: {network === 'base' ? 'Base Mainnet (8453)' : 'Base Sepolia (84532)'}
                </span>
                <span>Settlement: Gasless ERC-3009</span>
              </div>
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
