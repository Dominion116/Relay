import React, { useState } from 'react';
import { HeaderNav } from '../components/HeaderNav';
import { Footer } from '../components/Footer';
import { RELAY_RESOURCES, BASE_USDC_MAINNET, generate402Challenge, verifyPaymentProof, dispatchResourceRequest } from '../server/x402Engine';
import { X402Challenge, X402VerificationResult, X402PaymentProof } from '../types/x402';
import { EIP712_TRANSFER_TYPES } from '../server/agentWallet';
import { FaPlay, FaCopy, FaCheck } from 'react-icons/fa6';
import { AlertCircle, ShieldCheck, Wallet, ArrowRight, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract, useSignTypedData, useSwitchChain } from 'wagmi';
import { base } from 'wagmi/chains';
import { parseSignature, getAddress } from 'viem';

interface PlaygroundPageProps {
  onNavigate: (page: 'home' | 'capabilities' | 'playground' | 'protocol' | 'docs') => void;
  onOpenMcp: () => void;
  onOpenDiscovery: () => void;
  initialResourceId?: string;
  initialQuery?: string;
}

const ERC20_BALANCE_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }]
  }
] as const;

export const PlaygroundPage: React.FC<PlaygroundPageProps> = ({
  onNavigate,
  onOpenMcp,
  onOpenDiscovery,
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

  // Wagmi & RainbowKit Web3 State
  const { address, isConnected, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const { signTypedDataAsync } = useSignTypedData();

  // Real on-chain Base USDC balance
  const { data: rawUsdcBalance, isLoading: isBalanceLoading, refetch: refetchUsdc } = useReadContract({
    address: BASE_USDC_MAINNET,
    abi: ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address && isConnected)
    }
  });

  const realUsdcBalance = rawUsdcBalance !== undefined
    ? Number(rawUsdcBalance) / 1_000_000
    : null;

  const isBaseMainnet = chain?.id === base.id;

  // Execution state
  const [executing, setExecuting] = useState<boolean>(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [challenge402, setChallenge402] = useState<X402Challenge | null>(null);
  const [activeProof, setActiveProof] = useState<X402PaymentProof | null>(null);
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
    setActiveProof(null);
    setVerificationResult(null);
    setResponseData(null);
    setErrorMsg(null);
  };

  const handleExecute = async () => {
    if (!isConnected || !address) {
      setErrorMsg('Wallet connection required. Please connect your Base wallet to execute this request.');
      return;
    }

    if (!isBaseMainnet) {
      setErrorMsg('Wrong network. Please switch to Base Mainnet (Chain ID 8453).');
      return;
    }

    let parsedParams: any = {};
    try {
      parsedParams = JSON.parse(requestBodyText);
    } catch (e: any) {
      setErrorMsg(`Invalid JSON input: ${e.message}`);
      return;
    }

    const cost = selectedResource.priceUsdc;
    if (realUsdcBalance !== null && realUsdcBalance < cost) {
      setErrorMsg(`Insufficient Base USDC balance ($${realUsdcBalance.toFixed(2)} USDC). Requires $${cost.toFixed(2)} USDC.`);
      return;
    }

    setExecuting(true);
    setErrorMsg(null);
    setStep(1);
    const startTime = performance.now();

    try {
      // Step 1: Gateway request -> Step 2: HTTP 402 Challenge on Base Mainnet
      await new Promise(r => setTimeout(r, 300));
      const challenge = generate402Challenge(selectedResource, 'base');
      setChallenge402(challenge);
      setStep(2);

      // Step 2 -> Step 3: Real EIP-712 ERC-3009 TransferWithAuthorization Signature
      await new Promise(r => setTimeout(r, 350));
      setStep(3);

      const domain = {
        name: 'USD Coin',
        version: '2',
        chainId: 8453,
        verifyingContract: getAddress(challenge.paymentRequirements.tokenAddress)
      } as const;

      const rawNonce = challenge.paymentRequirements.nonce;
      const formattedNonce = rawNonce.startsWith('0x') && rawNonce.length === 66
        ? (rawNonce as `0x${string}`)
        : (`0x${rawNonce.replace(/^0x/, '').padStart(64, '0')}` as `0x${string}`);

      const signature = await signTypedDataAsync({
        domain,
        types: EIP712_TRANSFER_TYPES,
        primaryType: 'TransferWithAuthorization',
        message: {
          from: getAddress(address),
          to: getAddress(challenge.paymentRequirements.payTo),
          value: BigInt(challenge.paymentRequirements.amount),
          validAfter: 0n,
          validBefore: BigInt(challenge.paymentRequirements.validBefore),
          nonce: formattedNonce
        }
      });

      const parsedSig = parseSignature(signature);

      const proofObj: X402PaymentProof = {
        scheme: 'transferWithAuthorization',
        clientSignature: signature,
        payerAddress: address,
        timestamp: Date.now(),
        authorization: {
          from: address,
          to: challenge.paymentRequirements.payTo,
          value: challenge.paymentRequirements.amount,
          validAfter: 0,
          validBefore: challenge.paymentRequirements.validBefore,
          nonce: challenge.paymentRequirements.nonce,
          v: parsedSig.v ? Number(parsedSig.v) : undefined,
          r: parsedSig.r,
          s: parsedSig.s
        }
      };

      setActiveProof(proofObj);

      // Step 3 -> Step 4: Cryptographic Verification and Live Data Dispatch
      await new Promise(r => setTimeout(r, 300));
      const verification = await verifyPaymentProof(proofObj, selectedResource, challenge);
      setVerificationResult(verification);

      if (!verification.valid) {
        throw new Error(verification.error || 'Cryptographic EIP-712 signature verification failed.');
      }

      // Fetch live data directly from provider
      const data = await dispatchResourceRequest(selectedResource.id, parsedParams);
      setResponseData(data);
      setStep(4);

      // Refetch onchain balance
      refetchUsdc?.();
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
    return `# Step 1: Request endpoint (receives HTTP 402 Challenge on Base)
curl -X POST https://relayx402.vercel.app${selectedResource.path} \\
  -H "Content-Type: application/json" \\
  -d '${requestBodyText.replace(/\n/g, ' ')}'

# Step 2: Sign Base EIP-712 transfer authorization & resubmit
curl -X POST https://relayx402.vercel.app${selectedResource.path} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <signed_eip712_json_or_b64>" \\
  -d '${requestBodyText.replace(/\n/g, ' ')}'`;
  };

  const getPythonSnippet = () => {
    return `import requests, json

url = "https://relayx402.vercel.app${selectedResource.path}"
payload = ${requestBodyText}

# Request endpoint without payment
res = requests.post(url, json=payload)

if res.status_code == 402:
    challenge = res.json()["paymentRequirements"]
    print(f"Payment Required: {challenge['amountFormatted']} on Base (Chain {challenge['chainId']})")
    print(f"Payee Address: {challenge['payTo']}")
    print(f"USDC Contract: {challenge['tokenAddress']}")
    # Sign EIP-712 TransferWithAuthorization using local agent key and attach in Authorization header`;
  };

  const getTsSnippet = () => {
    return `import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as \`0x\${string}\`);
const client = createWalletClient({ account, chain: base, transport: http() });

// Step 1: Initial call receives 402
const res = await fetch('https://relayx402.vercel.app${selectedResource.path}', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(${requestBodyText.replace(/\n/g, ' ')})
});

if (res.status === 402) {
  const challenge = await res.json();
  // Sign EIP-712 TransferWithAuthorization on Base and re-send
}`;
  };

  return (
    <div className="w-full bg-[#0a0a0a] text-neutral-400 font-sans antialiased min-h-screen flex flex-col justify-between">
      {/* HeaderNav */}
      <HeaderNav
        currentPage="playground"
        onNavigate={onNavigate}
        onOpenMcp={onOpenMcp}
        onOpenDiscovery={onOpenDiscovery}
      />

      <main className="flex-1 w-full">
        <div className="max-w-[1400px] w-full mx-auto px-6 md:px-12 lg:px-16 py-16 md:py-20">
          
          {/* Page Title & Dashboard Intro */}
          <div className="max-w-3xl mb-10">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-xs font-mono text-neutral-400 mb-4">
              <span className="size-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span>Base Mainnet x402 Dashboard</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-neutral-100 mb-4 text-balance">
              Execute x402 payments on Base
            </h1>
            <p className="text-[15px] leading-relaxed text-neutral-400 max-w-2xl">
              Connect your Base wallet via RainbowKit to test real pay-per-request capabilities. Every call is paid in real Base USDC over the open x402 standard with cryptographic EIP-712 settlement.
            </p>
          </div>

          {/* 2-Column Playground Dashboard Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-16">
            
            {/* Left Column: Wallet Connection & Request Form (5 cols) */}
            <div className="lg:col-span-5 rounded-2xl bg-neutral-900/30 border border-neutral-800/80 p-6 sm:p-7 flex flex-col justify-between">
              <div>
                
                {/* RainbowKit Wallet Card (Exclusive to Dashboard) */}
                <div className="rounded-xl bg-neutral-950/90 p-4 border border-neutral-800/90 mb-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-xs font-mono text-neutral-300 font-medium">
                      <Wallet className="size-3.5 text-blue-400" />
                      <span>Wallet & Settlement</span>
                    </div>
                    {isConnected && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                        Base Mainnet
                      </span>
                    )}
                  </div>

                  {/* RainbowKit ConnectButton Component */}
                  <div className="mb-3">
                    <ConnectButton
                      showBalance={false}
                      chainStatus="icon"
                      accountStatus="avatar"
                    />
                  </div>

                  {/* Connected Wallet Onchain Stats */}
                  {isConnected ? (
                    <div className="pt-2.5 border-t border-neutral-800/70 space-y-2 text-xs font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-500">Base USDC Balance:</span>
                        <span className="text-neutral-200 font-semibold">
                          {isBalanceLoading ? (
                            'Fetching balance...'
                          ) : realUsdcBalance !== null ? (
                            `${realUsdcBalance.toFixed(4)} USDC`
                          ) : (
                            '0.0000 USDC'
                          )}
                        </span>
                      </div>
                      
                      {!isBaseMainnet && (
                        <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] flex items-center justify-between">
                          <span>Please switch to Base Mainnet</span>
                          <button
                            type="button"
                            onClick={() => switchChain({ chainId: base.id })}
                            className="px-2 py-1 rounded bg-amber-500 text-neutral-950 font-semibold hover:bg-amber-400 transition-colors"
                          >
                            Switch Chain
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-neutral-800/70">
                      <p className="text-[11px] text-neutral-500 leading-relaxed font-sans">
                        A connected Base wallet with USDC is required to test. Gasless EIP-712 authorizations sign directly in your wallet without native ETH gas.
                      </p>
                    </div>
                  )}
                </div>

                {/* Endpoint Selector */}
                <div className="mb-5">
                  <label className="block text-xs font-mono font-medium text-neutral-400 uppercase tracking-wider mb-2">
                    Select Endpoint
                  </label>
                  <select
                    value={selectedResourceId}
                    onChange={(e) => handleSelectResource(e.target.value)}
                    className="w-full bg-neutral-900 text-neutral-200 border border-neutral-700/80 rounded-xl px-4 py-2.5 text-xs font-mono outline-none focus:border-neutral-500 focus-visible:ring-2 focus-visible:ring-blue-500"
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
                  <p className="text-xs text-neutral-400 mt-2 leading-relaxed font-sans">
                    {selectedResource.description}
                  </p>
                </div>

                {/* JSON Request Body Editor */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-mono font-medium text-neutral-400 uppercase tracking-wider">
                      Request Body (JSON)
                    </label>
                    <button
                      type="button"
                      onClick={() => setRequestBodyText(JSON.stringify(selectedResource.defaultParams, null, 2))}
                      className="text-[11px] font-mono text-neutral-500 hover:text-neutral-300 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded"
                    >
                      Reset Payload
                    </button>
                  </div>
                  <textarea
                    rows={6}
                    value={requestBodyText}
                    onChange={(e) => setRequestBodyText(e.target.value)}
                    className="w-full bg-neutral-950 font-mono text-xs text-neutral-200 border border-neutral-800 rounded-xl p-3.5 outline-none focus:border-neutral-600 focus-visible:ring-2 focus-visible:ring-blue-500 resize-y"
                    spellCheck={false}
                  />
                </div>
              </div>

              {/* Action Button & Validation Alert */}
              <div>
                {errorMsg && (
                  <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2.5 text-xs text-red-400 font-mono">
                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {!isConnected ? (
                  <div className="w-full p-4 rounded-xl bg-neutral-950 border border-neutral-800 flex flex-col items-center justify-center gap-2.5 text-center">
                    <span className="text-xs text-neutral-300 font-medium">Connect wallet to unlock execution</span>
                    <ConnectButton />
                  </div>
                ) : !isBaseMainnet ? (
                  <button
                    type="button"
                    onClick={() => switchChain({ chainId: base.id })}
                    className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-medium text-xs font-mono transition-colors flex items-center justify-center gap-2"
                  >
                    <span>Switch to Base Mainnet</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={executing}
                    onClick={handleExecute}
                    className="w-full py-3 rounded-xl bg-white hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-600 text-neutral-950 font-medium text-xs font-mono transition-colors flex items-center justify-center gap-2 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    {executing ? (
                      <>
                        <span className="size-3.5 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
                        <span>Signing & Settling on Base...</span>
                      </>
                    ) : (
                      <>
                        <FaPlay className="size-3" />
                        <span>Pay ${selectedResource.priceUsdc.toFixed(2)} USDC & Execute</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Right Column: Execution Inspector & Wire Console (7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              
              {/* Stepper Handshake Card */}
              <div className="rounded-2xl bg-neutral-900/30 border border-neutral-800/80 p-6">
                <div className="flex items-center justify-between mb-5">
                  <span className="text-xs font-mono text-neutral-400 font-medium">x402 Protocol Settlement Flow</span>
                  <span className="text-xs font-mono text-neutral-500">
                    {step === 1 && '1. Unauthenticated Request'}
                    {step === 2 && '2. HTTP 402 Challenge'}
                    {step === 3 && '3. EIP-712 Wallet Signature'}
                    {step === 4 && `4. Verified & Settled (${executionTimeMs}ms)`}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <div className={`p-2.5 rounded-lg border text-center text-xs font-mono transition-all ${
                    step >= 1 ? 'bg-neutral-900 border-neutral-700 text-neutral-200' : 'bg-neutral-950/40 border-neutral-900 text-neutral-600'
                  }`}>
                    <span className="block text-[10px] text-neutral-500 mb-0.5">Step 1</span>
                    <span className="font-semibold">POST /v1</span>
                  </div>

                  <div className={`p-2.5 rounded-lg border text-center text-xs font-mono transition-all ${
                    step >= 2 ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-neutral-950/40 border-neutral-900 text-neutral-600'
                  }`}>
                    <span className="block text-[10px] text-neutral-500 mb-0.5">Step 2</span>
                    <span className="font-semibold">HTTP 402</span>
                  </div>

                  <div className={`p-2.5 rounded-lg border text-center text-xs font-mono transition-all ${
                    step >= 3 ? 'bg-blue-500/10 border-blue-500/30 text-blue-300' : 'bg-neutral-950/40 border-neutral-900 text-neutral-600'
                  }`}>
                    <span className="block text-[10px] text-neutral-500 mb-0.5">Step 3</span>
                    <span className="font-semibold">EIP-712 Sign</span>
                  </div>

                  <div className={`p-2.5 rounded-lg border text-center text-xs font-mono transition-all ${
                    step === 4 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-neutral-950/40 border-neutral-900 text-neutral-600'
                  }`}>
                    <span className="block text-[10px] text-neutral-500 mb-0.5">Step 4</span>
                    <span className="font-semibold">HTTP 200 OK</span>
                  </div>
                </div>
              </div>

              {/* Wire Inspector Console */}
              <div className="rounded-2xl bg-neutral-950 border border-neutral-800/80 overflow-hidden flex flex-col flex-1">
                {/* Tabs Header */}
                <div className="flex items-center justify-between border-b border-neutral-800/80 px-4 py-2.5 bg-neutral-900/40">
                  <div className="flex items-center gap-2" role="tablist" aria-label="Playground output format tabs">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeTab === 'console'}
                      onClick={() => setActiveTab('console')}
                      className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 ${
                        activeTab === 'console'
                          ? 'bg-neutral-800 text-white font-medium'
                          : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      Wire Console
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeTab === 'curl'}
                      onClick={() => setActiveTab('curl')}
                      className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 ${
                        activeTab === 'curl'
                          ? 'bg-neutral-800 text-white font-medium'
                          : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      cURL
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeTab === 'ts'}
                      onClick={() => setActiveTab('ts')}
                      className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 ${
                        activeTab === 'ts'
                          ? 'bg-neutral-800 text-white font-medium'
                          : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      TypeScript (Viem)
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeTab === 'python'}
                      onClick={() => setActiveTab('python')}
                      className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 ${
                        activeTab === 'python'
                          ? 'bg-neutral-800 text-white font-medium'
                          : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      Python
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (activeTab === 'console') {
                        copyCode(JSON.stringify(responseData || challenge402 || {}, null, 2));
                      } else if (activeTab === 'curl') {
                        copyCode(getCurlSnippet());
                      } else if (activeTab === 'ts') {
                        copyCode(getTsSnippet());
                      } else {
                        copyCode(getPythonSnippet());
                      }
                    }}
                    className="p-1.5 rounded-md hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                    title="Copy to clipboard"
                  >
                    {copiedCode ? <FaCheck className="size-3 text-emerald-400" /> : <FaCopy className="size-3" />}
                  </button>
                </div>

                {/* Tab Content Display */}
                <div className="p-4 sm:p-5 flex-1 font-mono text-xs overflow-auto max-h-[520px]">
                  {activeTab === 'console' && (
                    <div className="space-y-4">
                      {/* Step 2 Challenge Output */}
                      {challenge402 && (
                        <div>
                          <div className="flex items-center justify-between text-neutral-500 mb-1.5 text-[11px]">
                            <span>HTTP 402 PAYMENT REQUIRED (BASE MAINNET)</span>
                            <span className="text-amber-400 font-semibold">Status 402</span>
                          </div>
                          <pre className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800 text-neutral-300 overflow-x-auto text-[11px] leading-relaxed">
                            {JSON.stringify(challenge402, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Step 3 Active Proof Output */}
                      {activeProof && (
                        <div>
                          <div className="flex items-center justify-between text-neutral-500 mb-1.5 text-[11px]">
                            <span>EIP-712 AUTHORIZATION PROOF (SIGNED BY CONNECTED WALLET)</span>
                            <span className="text-blue-400 font-semibold">65-byte Secp256k1</span>
                          </div>
                          <pre className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800 text-neutral-300 overflow-x-auto text-[11px] leading-relaxed">
                            {JSON.stringify(activeProof, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Step 4 Verification & Live Data */}
                      {verificationResult && (
                        <div>
                          <div className="flex items-center justify-between text-neutral-500 mb-1.5 text-[11px]">
                            <span>CRYPTOGRAPHIC VERIFICATION</span>
                            <span className="text-emerald-400 font-semibold">Signature Recovered</span>
                          </div>
                          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] space-y-1">
                            <div>Payer Address: <code>{verificationResult.payer}</code></div>
                            <div>Authorized Cost: <code>{verificationResult.amount} micro-USDC (${selectedResource.priceUsdc.toFixed(2)})</code></div>
                            <div>Base Chain: <code>8453 (Base Mainnet)</code></div>
                            <div>Settled Tx: <code>{verificationResult.txHash}</code></div>
                          </div>
                        </div>
                      )}

                      {responseData && (
                        <div>
                          <div className="flex items-center justify-between text-neutral-500 mb-1.5 text-[11px]">
                            <span>LIVE ENDPOINT RESPONSE (HTTP 200 OK)</span>
                            <span className="text-emerald-400 font-semibold">{executionTimeMs}ms</span>
                          </div>
                          <pre className="p-3.5 rounded-xl bg-neutral-900/80 border border-neutral-800 text-neutral-200 overflow-x-auto text-[11px] leading-relaxed">
                            {JSON.stringify(responseData, null, 2)}
                          </pre>
                        </div>
                      )}

                      {!challenge402 && !executing && (
                        <div className="py-16 text-center text-neutral-500 text-xs">
                          {isConnected ? (
                            <span>Connected: <code className="text-neutral-300">{address?.slice(0, 8)}...{address?.slice(-6)}</code>. Click "Pay & Execute" to sign and retrieve live data.</span>
                          ) : (
                            <span>Connect your Base wallet on the left to initiate the x402 payment cycle.</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'curl' && (
                    <pre className="text-neutral-300 leading-relaxed overflow-x-auto">
                      {getCurlSnippet()}
                    </pre>
                  )}

                  {activeTab === 'ts' && (
                    <pre className="text-neutral-300 leading-relaxed overflow-x-auto">
                      {getTsSnippet()}
                    </pre>
                  )}

                  {activeTab === 'python' && (
                    <pre className="text-neutral-300 leading-relaxed overflow-x-auto">
                      {getPythonSnippet()}
                    </pre>
                  )}
                </div>
              </div>

            </div>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
};
