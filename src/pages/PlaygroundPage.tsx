import React, { useEffect, useRef, useState } from 'react';
import { HeaderNav } from '../components/HeaderNav';
import { Footer } from '../components/Footer';
import { RELAY_RESOURCES } from '../shared/resources';
import { MAX_REQUEST_BYTES, validateResourceParams } from '../shared/validation';
import {
  createPaymentAuthorization, createPaymentPayload, decodePaymentHeader, encodePaymentHeader,
  isTransactionHash, validatePaymentChallenge, validateSettlementResponse,
  type PaymentPolicy, type SettlementReceipt,
} from '../shared/paymentClient';
import type { X402Challenge, X402PaymentProof, X402Resource } from '../types/x402';
import { getGatewayUrl, relayChain, relayNetwork, relayNetworkLabel, relayTokenAddress, relayTreasuryAddress } from '../config/wagmi';
import { FaPlay, FaCopy, FaCheck } from 'react-icons/fa6';
import { AlertCircle, Wallet, ExternalLink, Receipt } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract, useSignTypedData, useSwitchChain } from 'wagmi';

export interface DashboardSettlementItem {
  id: string;
  resourceName: string;
  path: string;
  costUsdc: number;
  payer: string;
  payTo: string;
  chainId: number;
  txHash?: string;
  timestamp: string;
  status: 'SETTLED' | 'PENDING';
}

interface PlaygroundPageProps {
  onNavigate: (page: 'home' | 'capabilities' | 'playground' | 'protocol' | 'docs') => void;
  onOpenMcp: () => void;
  onOpenDiscovery: () => void;
  initialResourceId?: string;
  initialQuery?: string;
  settlementLedger: DashboardSettlementItem[];
  onRecordSettlement: (item: DashboardSettlementItem) => void;
}

export class PlaygroundPaymentError extends Error {
  constructor(message: string, public readonly transactionHash?: string) {
    super(message);
    this.name = 'PlaygroundPaymentError';
  }
}

interface GatewayExecution {
  resource: X402Resource;
  params: unknown;
  policy: PaymentPolicy;
  payer: string;
  signal: AbortSignal;
  sign: (typedData: ReturnType<typeof createPaymentAuthorization>['typedData']) => Promise<`0x${string}`>;
  onChallenge: (challenge: X402Challenge) => void;
  onProof: (proof: X402PaymentProof) => void;
  onSubmitted: (nonce: string) => void;
}

// One unsigned request and at most one signed submission. An uncertain submission is never repaid here.
export async function executePlaygroundRequest(options: GatewayExecution) {
  const params = validateResourceParams(options.resource, options.params);
  const body = JSON.stringify(params);
  if (new TextEncoder().encode(body).length > MAX_REQUEST_BYTES) throw new Error('Request body is too large.');
  const target = `${options.policy.gatewayUrl}${options.resource.path}`;
  const post = async (payment?: string, onResponse?: (response: Response) => void) => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    options.signal.addEventListener('abort', abort, { once: true });
    if (options.signal.aborted) abort();
    const timeout = setTimeout(abort, 30_000);
    try {
      const response = await fetch(target, {
        method: 'POST', redirect: 'error', credentials: 'omit', cache: 'no-store', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...(payment ? { 'PAYMENT-SIGNATURE': payment } : {}) }, body,
      });
      onResponse?.(response);
      return { response, body: await response.json() as Record<string, unknown> };
    } finally {
      clearTimeout(timeout);
      options.signal.removeEventListener('abort', abort);
    }
  };

  const initial = await post();
  if (initial.response.status !== 402) {
    throw new Error(`Expected an x402 challenge, received HTTP ${initial.response.status}. No payment was signed.`);
  }
  const validated = validatePaymentChallenge(decodePaymentHeader(initial.response.headers.get('PAYMENT-REQUIRED')), options.policy);
  const bodyChallenge = validatePaymentChallenge(initial.body, options.policy);
  if (JSON.stringify(validated.challenge) !== JSON.stringify(bodyChallenge.challenge)) throw new Error('Payment header and body disagree. No payment was signed.');
  options.onChallenge(validated.challenge);
  if (options.signal.aborted) throw new Error('Request cancelled before signing.');
  const { authorization, typedData } = createPaymentAuthorization(validated, options.payer);
  const signature = await options.sign(typedData);
  if (options.signal.aborted) throw new Error('Request cancelled before submission.');
  const proof = createPaymentPayload(validated, authorization, signature);
  options.onProof(proof);
  const payment = encodePaymentHeader(proof);
  options.onSubmitted(authorization.nonce);

  let transactionHash: string | undefined;
  try {
    // Capture a reported hash before reading the body, without inferring confirmation from it.
    const paid = await post(payment, response => {
      try {
        const result = decodePaymentHeader(response.headers.get('PAYMENT-RESPONSE')) as Record<string, unknown>;
        if (result?.network === validated.accepted.network && typeof result.payer === 'string' &&
            result.payer.toLowerCase() === options.payer.toLowerCase() && isTransactionHash(result.transaction) &&
            (result.amount === undefined || result.amount === validated.accepted.amount)) {
          transactionHash = result.transaction;
        }
      } catch {
        // Invalid metadata leaves the submitted authorization unresolved.
      }
    });
    const header = paid.response.headers.get('PAYMENT-RESPONSE');
    if (paid.response.status !== 200) {
      throw new Error(typeof paid.body?.message === 'string' ? paid.body.message : `Gateway returned HTTP ${paid.response.status}.`);
    }
    const receipt = validateSettlementResponse(paid.body, header, {
      network: validated.accepted.network, payer: options.payer, asset: validated.accepted.asset, amount: validated.accepted.amount,
    });
    return { receipt, data: paid.body.data };
  } catch (cause) {
    throw new PlaygroundPaymentError(
      `${cause instanceof Error ? cause.message : 'Gateway request failed.'} Payment was not confirmed. Reconcile the submitted authorization before paying again.`,
      transactionHash,
    );
  }
}

const balanceAbi = [{ name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: 'balance', type: 'uint256' }] }] as const;
const outputTabs = [ ['console', 'Wire Console'], ['ledger', 'Settlement Ledger'], ['curl', 'cURL'], ['ts', 'TypeScript SDK'], ['python', 'Python Discovery'] ] as const;
type OutputTab = typeof outputTabs[number][0];

export const PlaygroundPage: React.FC<PlaygroundPageProps> = ({
  onNavigate, onOpenMcp, onOpenDiscovery, initialResourceId = 'crypto_price', initialQuery,
  settlementLedger, onRecordSettlement,
}) => {
  const initialResource = RELAY_RESOURCES.find(resource => resource.id === initialResourceId) || RELAY_RESOURCES[0];
  const [selectedResourceId, setSelectedResourceId] = useState(initialResource.id);
  const [requestBodyText, setRequestBodyText] = useState(JSON.stringify(
    initialQuery && 'query' in initialResource.defaultParams ? { ...initialResource.defaultParams, query: initialQuery } : initialResource.defaultParams, null, 2,
  ));
  const [activeTab, setActiveTab] = useState<OutputTab>('console');
  const [copiedCode, setCopiedCode] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [challenge402, setChallenge402] = useState<X402Challenge | null>(null);
  const [activeProof, setActiveProof] = useState<X402PaymentProof | null>(null);
  const [verificationResult, setVerificationResult] = useState<{ valid: true; receipt: SettlementReceipt } | null>(null);
  const [responseData, setResponseData] = useState<unknown>(null);
  const [executionTimeMs, setExecutionTimeMs] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const executionRef = useRef<AbortController | null>(null);
  const { address, isConnected, chain, connector } = useAccount();
  const currentWallet = useRef({ address, isConnected });
  currentWallet.current = { address, isConnected };
  const { switchChainAsync } = useSwitchChain();
  const { signTypedDataAsync } = useSignTypedData();
  const { data: rawUsdcBalance, isLoading: isBalanceLoading, refetch: refetchUsdc } = useReadContract({
    address: relayTokenAddress, chainId: relayChain.id, abi: balanceAbi, functionName: 'balanceOf',
    args: address ? [address] : undefined, query: { enabled: Boolean(address && isConnected) },
  });
  const selectedResource = RELAY_RESOURCES.find(resource => resource.id === selectedResourceId)!;
  const gatewayUrl = getGatewayUrl();
  const pendingPayment = settlementLedger.find(item => item.status === 'PENDING' && item.payer.toLowerCase() === address?.toLowerCase() && item.chainId === relayChain.id);

  useEffect(() => () => executionRef.current?.abort(), []);

  const clearExecution = () => {
    setChallenge402(null);
    setActiveProof(null);
    setVerificationResult(null);
    setResponseData(null);
    setErrorMsg(null);
    setExecutionTimeMs(0);
    setCopiedCode(false);
    setStep(1);
  };

  const handleExecute = async () => {
    if (executionRef.current) return;
    clearExecution();
    const start = performance.now();
    const controller = new AbortController();
    executionRef.current = controller;
    setExecuting(true);
    let pendingRecord: DashboardSettlementItem | undefined;
    try {
      if (!isConnected || !address) throw new Error('Connect a wallet before executing a paid request.');
      if (pendingPayment) throw new Error('A previous payment is still unresolved. Reconcile it before signing another payment.');
      const params = validateResourceParams(selectedResource, JSON.parse(requestBodyText));
      const { receipt, data } = await executePlaygroundRequest({
        resource: selectedResource, params, payer: address, signal: controller.signal,
        policy: { gatewayUrl, endpoint: selectedResource.path, network: relayNetwork, treasuryAddress: relayTreasuryAddress, expectedAmount: selectedResource.amount },
        onChallenge: challenge => { setChallenge402(challenge); setStep(2); },
        sign: async typedData => {
          if (chain?.id !== relayChain.id) {
            const switched = await switchChainAsync({ chainId: relayChain.id });
            if (switched.id !== relayChain.id) throw new Error(`Switch to ${relayNetworkLabel} before signing.`);
          }
          if (!currentWallet.current.isConnected || currentWallet.current.address !== address || controller.signal.aborted) throw new Error('Wallet changed or request cancelled before signing.');
          const balance = await refetchUsdc();
          if (balance.error || typeof balance.data !== 'bigint') throw new Error(`Unable to verify the ${relayNetworkLabel} USDC balance. No payment was signed.`);
          if (balance.data < BigInt(selectedResource.amount)) throw new Error('Insufficient USDC for the selected endpoint.');
          if (controller.signal.aborted) throw new Error('Request cancelled before signing.');
          if (await connector?.getChainId() !== relayChain.id) throw new Error(`Wallet is not on ${relayNetworkLabel}. No payment was signed.`);
          setStep(3);
          const signature = await signTypedDataAsync({ ...typedData, account: address });
          if (!currentWallet.current.isConnected || currentWallet.current.address !== address) throw new Error('Wallet changed before submission.');
          return signature;
        },
        onProof: setActiveProof,
        onSubmitted: nonce => {
          pendingRecord = { id: nonce, resourceName: selectedResource.name, path: selectedResource.path, costUsdc: selectedResource.priceUsdc,
            payer: address, payTo: relayTreasuryAddress, chainId: relayChain.id, timestamp: new Date().toISOString(), status: 'PENDING' };
          onRecordSettlement(pendingRecord);
        },
      });
      onRecordSettlement({ ...pendingRecord!, status: 'SETTLED', txHash: receipt.tx_hash, timestamp: receipt.settled_at });
      setVerificationResult({ valid: true, receipt });
      setResponseData(data);
      setStep(4);
      void refetchUsdc();
    } catch (cause) {
      if (cause instanceof PlaygroundPaymentError && pendingRecord) onRecordSettlement({ ...pendingRecord, txHash: cause.transactionHash });
      setErrorMsg(cause instanceof Error ? cause.message : 'Request failed.');
    } finally {
      executionRef.current = null;
      setExecuting(false);
      setExecutionTimeMs(Math.round(performance.now() - start));
    }
  };

  const snippets = {
    curl: `# POSIX shell: inspect the canonical challenge without signing\ncurl -i -X POST '${gatewayUrl}${selectedResource.path}' \\\n  -H 'Content-Type: application/json' \\\n  -d '${requestBodyText.replace(/'/g, "'\\''")}'\n\n# A paid retry requires PAYMENT-SIGNATURE: <base64 canonical proof>.\n# Use the bounded local SDK; never retry an uncertain payment automatically.`,
    python: `import base64, json, requests\n\npayload = json.loads(${JSON.stringify(requestBodyText)})\nres = requests.post(${JSON.stringify(`${gatewayUrl}${selectedResource.path}`)}, json=payload, timeout=30, allow_redirects=False)\nif res.status_code == 402:\n    challenge = json.loads(base64.b64decode(res.headers["PAYMENT-REQUIRED"]))\n    print(json.dumps(challenge, indent=2))\n# Discovery only: this example does not sign or submit a payment.`,
    ts: `// Run from this checkout with Node --import tsx. See Docs for the launcher.\nimport { RelayClient } from './src/sdk/index.ts';\n\nconst relay = new RelayClient({\n  privateKey: process.env.AGENT_PRIVATE_KEY || '',\n  gatewayUrl: ${JSON.stringify(gatewayUrl)},\n  network: '${relayNetwork}',\n  treasuryAddress: '${relayTreasuryAddress}',\n  maxPaymentUsdc: '${selectedResource.priceUsdc.toFixed(2)}',\n  maxDailyBudgetUsdc: process.env.MAX_DAILY_BUDGET_USDC || '0'\n});\n\n// Zero or omitted daily budget disables payments.\nconst result = await relay.call('${selectedResource.path}', JSON.parse(${JSON.stringify(requestBodyText)}));\nconsole.log(result);`,
  };
  const copyCode = async (value: string) => {
    try { await navigator.clipboard.writeText(value); setCopiedCode(true); }
    catch { setErrorMsg('Clipboard access was denied.'); }
  };

  return (
    <div className="w-full bg-[#0a0a0a] text-neutral-400 font-sans antialiased min-h-screen flex flex-col justify-between">
      <HeaderNav currentPage="playground" onNavigate={onNavigate} onOpenMcp={onOpenMcp} onOpenDiscovery={onOpenDiscovery} />
      <main className="flex-1 w-full">
        <div className="max-w-[1400px] w-full mx-auto px-6 md:px-12 lg:px-16 py-16 md:py-20">
          <div className="max-w-3xl mb-10">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-xs font-mono mb-4"><span className="size-1.5 rounded-full bg-blue-500" /><span>{relayNetworkLabel} x402 Dashboard</span></div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-neutral-100 mb-4">Execute x402 payments on Base</h1>
            <p className="text-[15px] leading-relaxed max-w-2xl">The gateway validates your request, returns a payment offer, and confirms settlement before releasing data. Review the exact USDC amount in your wallet. {relayNetwork === 'base-sepolia' ? 'This configuration uses Sepolia test tokens.' : 'This configuration authorizes real mainnet USDC.'}</p>
            <p className="mt-3 text-xs font-mono text-neutral-500 break-all">Gateway: {gatewayUrl}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-16">
            <div className="lg:col-span-5 min-w-0 rounded-2xl bg-neutral-900/30 border border-neutral-800/80 p-6 sm:p-7 flex flex-col justify-between">
              <div>
                <div className="rounded-xl bg-neutral-950/90 p-4 border border-neutral-800/90 mb-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3"><div className="flex items-center gap-2 text-xs font-mono text-neutral-300"><Wallet className="size-3.5 text-blue-400" /><span>Wallet & Settlement</span></div><span className="text-[10px] font-mono text-blue-400">{relayNetworkLabel}</span></div>
                  <ConnectButton showBalance={false} chainStatus="icon" accountStatus="avatar" />
                  <div className="mt-3 pt-2.5 border-t border-neutral-800/70 text-xs font-mono space-y-2">
                    <div className="flex flex-wrap justify-between gap-2"><span>{relayNetworkLabel} USDC:</span><span className="text-neutral-200">{!isConnected ? 'Wallet not connected' : isBalanceLoading ? 'Fetching balance...' : rawUsdcBalance !== undefined ? `${(Number(rawUsdcBalance) / 1_000_000).toFixed(4)} USDC` : 'Balance unavailable'}</span></div>
                    {isConnected && chain?.id !== relayChain.id && <p className="text-amber-300">Execution will request a switch to {relayNetworkLabel} before signing.</p>}
                    <p className="text-[11px] text-neutral-500 font-sans">Gasless authorization does not itself prove settlement. Only a confirmed gateway receipt is marked settled.</p>
                  </div>
                </div>
                <div className="mb-5">
                  <label htmlFor="playground-endpoint" className="block text-xs font-mono uppercase tracking-wider mb-2">Select Endpoint</label>
                  <select id="playground-endpoint" disabled={executing} value={selectedResourceId} onChange={event => {
                    const resource = RELAY_RESOURCES.find(item => item.id === event.target.value);
                    if (!resource) return;
                    clearExecution(); setSelectedResourceId(resource.id); setRequestBodyText(JSON.stringify(resource.defaultParams, null, 2));
                  }} className="w-full bg-neutral-900 text-neutral-200 border border-neutral-700/80 rounded-xl px-4 py-2.5 text-xs font-mono focus-visible:ring-2 focus-visible:ring-blue-500">
                    {RELAY_RESOURCES.map(resource => <option key={resource.id} value={resource.id}>{resource.name} : ${resource.priceUsdc.toFixed(2)} USDC</option>)}
                  </select>
                </div>
                <div className="rounded-xl bg-neutral-950/60 p-4 border border-neutral-800/80 mb-5">
                  <div className="flex flex-wrap justify-between gap-2 mb-2 text-xs font-mono"><span>Method & Route</span><span className="text-blue-400">${selectedResource.priceUsdc.toFixed(2)} USDC</span></div>
                  <div className="font-mono text-xs text-neutral-200 break-all">POST {selectedResource.path}</div>
                  <p className="text-xs mt-2 leading-relaxed">{selectedResource.description}</p>
                </div>
                <div className="mb-6">
                  <div className="flex flex-wrap justify-between gap-2 mb-2"><label htmlFor="playground-request-body" className="text-xs font-mono uppercase tracking-wider">Request Body (JSON)</label><button type="button" disabled={executing} onClick={() => { clearExecution(); setRequestBodyText(JSON.stringify(selectedResource.defaultParams, null, 2)); }} className="text-[11px] font-mono hover:text-neutral-200">Reset Payload</button></div>
                  <textarea id="playground-request-body" rows={6} disabled={executing} value={requestBodyText} onChange={event => { clearExecution(); setRequestBodyText(event.target.value); }} spellCheck={false}
                    className="w-full bg-neutral-950 font-mono text-xs text-neutral-200 border border-neutral-800 rounded-xl p-3.5 focus-visible:ring-2 focus-visible:ring-blue-500 resize-y" />
                </div>
              </div>
              <div>
                {errorMsg && <div role="alert" className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2.5 text-xs text-red-400"><AlertCircle className="size-4 shrink-0" /><span>{errorMsg}</span></div>}
                {pendingPayment && <div role="status" className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-2"><p>Pending payment: no confirmed settlement receipt. Further payments from this wallet are paused for this session; reconcile the authorization before retrying.</p>{pendingPayment.txHash ? <a className="underline break-all" href={`${relayChain.blockExplorers.default.url}/tx/${pendingPayment.txHash}`} target="_blank" rel="noreferrer">Check transaction {pendingPayment.txHash}</a> : <p>No transaction hash was returned. Do not assume that no payment occurred.</p>}</div>}
                {!isConnected ? <div className="w-full p-4 rounded-xl bg-neutral-950 border border-neutral-800 text-center space-y-3"><p className="text-xs">Connect a wallet to authorize execution</p><ConnectButton /></div> :
                  <button type="button" disabled={executing || Boolean(pendingPayment)} onClick={handleExecute} className="w-full py-3 rounded-xl bg-white hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-500 text-neutral-950 font-medium text-xs font-mono flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-blue-500">
                    <FaPlay className="size-3" /><span>{executing ? 'Waiting for wallet / gateway confirmation...' : `Pay $${selectedResource.priceUsdc.toFixed(2)} USDC & Execute`}</span>
                  </button>}
              </div>
            </div>

            <div className="lg:col-span-7 min-w-0 flex flex-col gap-6">
              <div className="rounded-2xl bg-neutral-900/30 border border-neutral-800/80 p-6">
                <div className="flex flex-wrap justify-between gap-2 mb-5 text-xs font-mono"><span>x402 Protocol Settlement Flow</span><span role="status" aria-live="polite">{step === 4 ? `Confirmed (${executionTimeMs}ms)` : executing ? ['Requesting challenge', 'Validating offer / wallet', 'Awaiting settlement'][step - 1] : 'Ready'}</span></div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {['POST /v1', 'HTTP 402', 'EIP-712 Sign', 'Confirmed'].map((label, index) => <div key={label} className={`p-2.5 rounded-lg border text-center text-xs font-mono ${step > index ? index === 3 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-neutral-900 border-neutral-700 text-neutral-200' : 'border-neutral-800 text-neutral-500'}`}><span className="block text-[10px] text-neutral-500 mb-0.5">Step {index + 1}</span>{label}</div>)}
                </div>
              </div>
              <div className="rounded-2xl bg-neutral-950 border border-neutral-800/80 overflow-hidden flex flex-col flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 border-b border-neutral-800/80 px-4 py-2.5 bg-neutral-900/40">
                  <div className="flex flex-wrap gap-2 min-w-0" role="tablist" aria-label="Playground output" onKeyDown={event => {
                    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
                    if (!delta && event.key !== 'Home' && event.key !== 'End') return;
                    event.preventDefault();
                    const index = event.key === 'Home' ? 0 : event.key === 'End' ? outputTabs.length - 1 : (outputTabs.findIndex(([id]) => id === activeTab) + delta + outputTabs.length) % outputTabs.length;
                    setActiveTab(outputTabs[index][0]);
                    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[index]?.focus();
                  }}>
                    {outputTabs.map(([id, label]) => <button type="button" key={id} id={`output-tab-${id}`} role="tab" tabIndex={activeTab === id ? 0 : -1} aria-selected={activeTab === id} aria-controls="playground-output" onClick={() => { setActiveTab(id); setCopiedCode(false); }} className={`px-3 py-1 rounded-lg text-xs font-mono focus-visible:ring-1 focus-visible:ring-blue-500 ${activeTab === id ? 'bg-neutral-800 text-white font-medium' : 'text-neutral-400 hover:text-neutral-200'}`}>{label}{id === 'ledger' && settlementLedger.length > 0 ? ` (${settlementLedger.length})` : ''}</button>)}
                  </div>
                  <button type="button" aria-label="Copy current output" onClick={() => void copyCode(activeTab === 'console' ? JSON.stringify(responseData ?? challenge402 ?? {}, null, 2) : activeTab === 'ledger' ? JSON.stringify(settlementLedger, null, 2) : snippets[activeTab])} className="p-1.5 shrink-0 rounded-md hover:bg-neutral-800 text-neutral-400 hover:text-white">{copiedCode ? <FaCheck className="size-3 text-emerald-400" /> : <FaCopy className="size-3" />}</button>
                </div>
                <div id="playground-output" role="tabpanel" aria-labelledby={`output-tab-${activeTab}`} tabIndex={0} className="p-4 sm:p-5 flex-1 font-mono text-xs overflow-auto max-h-[580px] min-w-0">
                  {activeTab === 'console' && <div className="space-y-4">
                    {challenge402 && <div><div className="text-amber-300 mb-2">HTTP 402 / PAYMENT-REQUIRED</div><pre className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800 text-neutral-300 overflow-x-auto text-[11px] leading-relaxed">{JSON.stringify(challenge402, null, 2)}</pre></div>}
                    {activeProof && <div><div className="text-blue-300 mb-2">PAYMENT-SIGNATURE authorization (signature redacted)</div><pre className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800 text-neutral-300 overflow-x-auto text-[11px] leading-relaxed">{JSON.stringify({ ...activeProof, payload: { ...activeProof.payload, signature: '[redacted]' } }, null, 2)}</pre></div>}
                    {verificationResult?.valid && <div><div className="text-emerald-300 mb-2">GATEWAY-CONFIRMED SETTLEMENT</div><pre className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 overflow-x-auto text-[11px]">{JSON.stringify(verificationResult.receipt, null, 2)}</pre></div>}
                    {verificationResult?.valid && responseData !== null && <div><div className="text-emerald-300 mb-2">GATEWAY RESPONSE (HTTP 200 OK)</div><pre className="p-3.5 rounded-xl bg-neutral-900/80 border border-neutral-800 text-neutral-200 overflow-x-auto text-[11px] leading-relaxed">{JSON.stringify(responseData, null, 2)}</pre></div>}
                    {!challenge402 && !executing && <p className="py-16 text-center text-neutral-500">Choose an endpoint and connect a wallet to inspect the gateway's x402 exchange.</p>}
                  </div>}
                  {activeTab === 'ledger' && <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800/80"><div><div className="text-neutral-500 text-[10px]">TOTAL CONFIRMED</div><div className="text-emerald-400 font-semibold">${settlementLedger.filter(item => item.status === 'SETTLED').reduce((sum, item) => sum + item.costUsdc, 0).toFixed(4)} USDC</div></div><div><div className="text-neutral-500 text-[10px]">PENDING AUTHORIZATIONS</div><div>{settlementLedger.filter(item => item.status === 'PENDING').length}</div></div></div>
                    <p className="text-[11px] text-neutral-500">History stays in this browser tab while navigating. Export receipts before closing or reloading; pending entries are not proof of settlement.</p>
                    {settlementLedger.length === 0 ? <div className="py-12 text-center text-neutral-500"><Receipt className="size-6 mx-auto mb-3" />No payments recorded in this session.</div> : settlementLedger.map(item => <div key={item.id} className="p-3.5 rounded-xl bg-neutral-900/40 border border-neutral-800/80 space-y-2">
                      <div className="flex flex-wrap justify-between gap-2"><span className="text-neutral-200 break-all">POST {item.path}</span><span className={item.status === 'SETTLED' ? 'text-emerald-400' : 'text-amber-300'}>{item.status} / ${item.costUsdc.toFixed(2)} USDC</span></div>
                      <div className="text-[11px] text-neutral-500">{new Date(item.timestamp).toLocaleString()} / Chain {item.chainId}</div>
                      <div className="break-all text-[11px]">Payer: {item.payer}</div>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">{item.txHash ? <a href={`${item.chainId === 84532 ? 'https://sepolia.basescan.org' : 'https://basescan.org'}/tx/${item.txHash}`} target="_blank" rel="noreferrer" className="text-blue-400 break-all inline-flex items-center gap-1">{item.txHash.slice(0, 12)}...{item.txHash.slice(-6)}<ExternalLink className="size-3" /></a> : <span className="text-amber-300">Transaction not confirmed; hash unavailable</span>}<button type="button" onClick={() => void copyCode(JSON.stringify(item, null, 2))} className="text-neutral-300 hover:text-white">Copy record</button></div>
                    </div>)}
                  </div>}
                  {activeTab !== 'console' && activeTab !== 'ledger' && <pre className="text-neutral-300 leading-relaxed overflow-x-auto">{snippets[activeTab]}</pre>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer onNavigate={onNavigate} onOpenMcp={onOpenMcp} onOpenDiscovery={onOpenDiscovery} />
    </div>
  );
};
