import React, { useState } from 'react';
import { HeaderNav } from '../components/HeaderNav';
import { Footer } from '../components/Footer';
import { MCP_LOCAL_CONFIG } from '../components/McpIntegrationModal';
import { FaCopy, FaCheck, FaArrowRight } from 'react-icons/fa6';
import { BookOpen, ChevronDown } from 'lucide-react';

interface DocsPageProps {
  onNavigate: (page: 'home' | 'capabilities' | 'playground' | 'protocol' | 'docs') => void;
  onOpenMcp: () => void;
  onOpenDiscovery: () => void;
}

export const SDK_EXAMPLE = `import { RelayClient } from './src/sdk/index.ts';

const relay = new RelayClient({
  privateKey: process.env.AGENT_PRIVATE_KEY || '',
  gatewayUrl: process.env.GATEWAY_ORIGIN || 'https://relayx402.vercel.app',
  network: (process.env.BASE_NETWORK as 'base' | 'base-sepolia') || 'base',
  treasuryAddress: process.env.RELAY_TREASURY_ADDRESS || '0x420f9F9deA7fA318eA8996C8aA00ad9738D98072',
  maxPaymentUsdc: process.env.MAX_PAYMENT_USDC || '0',
  maxDailyBudgetUsdc: process.env.MAX_DAILY_BUDGET_USDC || '0'
});

// Both limits must explicitly permit this $0.04 call before it will sign.
const { settlement, data } = await relay.crypto.price(['bitcoin', 'ethereum'], 'eur');
console.log('Confirmed receipt:', settlement);
console.log('Requested EUR prices:', data);`;

export const SDK_LAUNCH_COMMAND = `node --env-file-if-exists=.env --import tsx --input-type=module -e "import { RelayClient } from './src/sdk/index.ts'; const relay = new RelayClient({ privateKey: process.env.AGENT_PRIVATE_KEY || '', gatewayUrl: process.env.GATEWAY_ORIGIN || 'https://relayx402.vercel.app', network: (process.env.BASE_NETWORK as any) || 'base', treasuryAddress: process.env.RELAY_TREASURY_ADDRESS || '0x420f9F9deA7fA318eA8996C8aA00ad9738D98072', maxPaymentUsdc: process.env.MAX_PAYMENT_USDC || '0', maxDailyBudgetUsdc: process.env.MAX_DAILY_BUDGET_USDC || '0' }); console.log(await relay.crypto.price(['bitcoin'], 'eur'));"`;

export const VIEM_EXAMPLE = `import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';
import {
  decodePaymentHeader, validatePaymentChallenge, createPaymentAuthorization,
  createPaymentPayload, encodePaymentHeader, validateSettlementResponse
} from './src/shared/paymentClient.ts';

// One manually authorized call, not an autonomous spending loop.
// Use RelayClient for daily budgets and conservative payment reservations.
if (process.env.CONFIRM_SINGLE_PAYMENT_USDC !== '0.04') {
  throw new Error('Set CONFIRM_SINGLE_PAYMENT_USDC=0.04 only when authorized.');
}
const network = (process.env.BASE_NETWORK as 'base' | 'base-sepolia') || 'base';
const chain = network === 'base' ? base : baseSepolia;
const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as \`0x\${string}\`);
const wallet = createWalletClient({ account, chain, transport: http() });
const gatewayUrl = process.env.GATEWAY_ORIGIN || 'https://relayx402.vercel.app';
const endpoint = '/v1/crypto/price';
const body = JSON.stringify({ assets: ['bitcoin'], vsCurrency: 'eur' });
const policy = {
  gatewayUrl, endpoint, network,
  treasuryAddress: process.env.RELAY_TREASURY_ADDRESS || '0x420f9F9deA7fA318eA8996C8aA00ad9738D98072',
  expectedAmount: '40000'
};

export async function callRelay() {
  const response = await fetch(gatewayUrl + endpoint, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
    headers: { 'Content-Type': 'application/json' }, body
  });
  if (response.status !== 402) throw new Error('Expected HTTP 402; nothing signed.');
  const offer = validatePaymentChallenge(
    decodePaymentHeader(response.headers.get('PAYMENT-REQUIRED')), policy
  );
  const bodyOffer = validatePaymentChallenge(await response.json(), policy);
  if (JSON.stringify(offer.challenge) !== JSON.stringify(bodyOffer.challenge)) {
    throw new Error('Challenge header and body disagree.');
  }
  const { authorization, typedData } = createPaymentAuthorization(offer, account.address);
  const signature = await wallet.signTypedData(typedData);
  const proof = createPaymentPayload(offer, authorization, signature);
  // Send once. Any failure from this point requires reconciliation, not repayment.
  const paid = await fetch(gatewayUrl + endpoint, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
    headers: { 'Content-Type': 'application/json', 'PAYMENT-SIGNATURE': encodePaymentHeader(proof) },
    body
  });
  if (paid.status !== 200) throw new Error('Payment unconfirmed; reconcile before retrying.');
  const result = await paid.json();
  const settlement = validateSettlementResponse(result, paid.headers.get('PAYMENT-RESPONSE'), {
    network: offer.accepted.network, payer: account.address,
    asset: offer.accepted.asset, amount: offer.accepted.amount
  });
  return { settlement, data: result.data };
}

console.log(await callRelay());`;

function CodeBlock({ label, code }: { label: string; code: string }) {
  const [status, setStatus] = useState('');
  return <div className="rounded-xl bg-neutral-950/90 border border-neutral-800/80 overflow-hidden min-w-0">
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-neutral-900/60 text-xs font-mono text-neutral-400">
      <span>{label}</span>
      <button type="button" aria-label={`Copy ${label}`} onClick={async () => {
        try { await navigator.clipboard.writeText(code); setStatus('Copied'); }
        catch { setStatus('Clipboard unavailable'); }
      }} className="hover:text-white flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-blue-500 rounded">
        {status === 'Copied' ? <FaCheck className="size-2.5" /> : <FaCopy className="size-2.5" />}<span>{status || 'Copy'}</span>
      </button>
    </div>
    <pre tabIndex={0} aria-label={label} className="p-4 text-xs font-mono text-neutral-300 overflow-x-auto leading-relaxed"><code>{code}</code></pre>
  </div>;
}

export const DocsPage: React.FC<DocsPageProps> = ({ onNavigate, onOpenMcp, onOpenDiscovery }) => {
  const [activeSection, setActiveSection] = useState('quickstart');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const groups = [
    { title: 'Getting Started', items: [['quickstart', 'Quickstart'], ['concepts', 'Core concepts'], ['why-base', 'Base networks']] },
    { title: 'Protocol Handshake', items: [['handshake', 'The x402 handshake'], ['eip712', 'EIP-712 signing'], ['manifest', 'Machine manifest']] },
    { title: 'Agent Integration', items: [['ts-sdk', 'TypeScript and Viem'], ['python-sdk', 'Python discovery'], ['mcp-server', 'Cursor and Claude MCP']] },
    { title: 'Network Economics', items: [['token-utility', '$RELAY Token Utility & Vibestarter']] },
    { title: 'Reference', items: [['endpoints', 'Endpoints and limits'], ['errors', 'Errors and recovery']] },
  ];
  const navigateSection = (id: string) => {
    setActiveSection(id); setMobileNavOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'auto', block: 'start' });
  };
  const navigation = (suffix: string) => <>
    <label htmlFor={`docs-search-${suffix}`} className="sr-only">Filter documentation sections</label>
    <input id={`docs-search-${suffix}`} value={searchFilter} onChange={event => setSearchFilter(event.target.value)} placeholder="Search docs..." className="w-full bg-neutral-900/80 text-neutral-200 text-xs rounded-xl px-4 py-2.5 border border-neutral-800 focus-visible:ring-2 focus-visible:ring-blue-500" />
    <nav aria-label="Documentation sections" className="space-y-5 mt-5">
      {groups.map(group => <div key={group.title}><h3 className="font-mono text-[11px] uppercase tracking-wider text-neutral-500 mb-2">{group.title}</h3><ul className="space-y-1">{group.items.filter(([, label]) => label.toLowerCase().includes(searchFilter.toLowerCase())).map(([id, label]) => <li key={id}><button type="button" onClick={() => navigateSection(id)} aria-current={activeSection === id ? 'location' : undefined} className={`w-full text-left py-1.5 px-3 rounded-lg text-[13px] ${activeSection === id ? 'bg-neutral-900 text-neutral-100' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50'}`}>{label}</button></li>)}</ul></div>)}
    </nav>
  </>;
  const sectionClass = 'space-y-4 scroll-mt-28';
  const headingClass = 'text-2xl font-medium text-neutral-100 tracking-tight';

  return <div className="w-full bg-[#0a0a0a] text-neutral-400 font-sans antialiased min-h-screen flex flex-col justify-between">
    <HeaderNav currentPage="docs" onNavigate={onNavigate} onOpenMcp={onOpenMcp} onOpenDiscovery={onOpenDiscovery} />
    <main className="flex-1 w-full"><div className="max-w-[1400px] w-full mx-auto px-6 md:px-12 lg:px-16 py-12 md:py-16">
      <div className="lg:hidden w-full mb-6 sticky top-16 z-30 bg-[#0a0a0a]/95 backdrop-blur-md pt-2 pb-3">
        <button type="button" onClick={() => setMobileNavOpen(!mobileNavOpen)} aria-expanded={mobileNavOpen} aria-controls="mobile-docs-navigation" className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-neutral-900/90 border border-neutral-800 text-left"><span className="flex items-center gap-2 text-xs"><BookOpen className="size-4 text-blue-400" />Documentation sections</span><ChevronDown className="size-4" /></button>
        {mobileNavOpen && <div id="mobile-docs-navigation" className="mt-2 p-4 rounded-2xl bg-neutral-900 border border-neutral-800 max-h-[65dvh] overflow-y-auto">{navigation('mobile')}</div>}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        <aside className="hidden lg:block lg:col-span-3 sticky top-24 min-w-0">{navigation('desktop')}<button type="button" onClick={() => onNavigate('playground')} className="mt-6 w-full rounded-full bg-neutral-100 text-neutral-950 px-4 py-2 text-xs font-medium">Open Playground</button></aside>
        <article className="lg:col-span-6 min-w-0 space-y-16 text-neutral-400 leading-relaxed text-[14px]">
          <header className="space-y-4"><span className="inline-flex rounded-full bg-neutral-900/80 px-3 py-1 text-xs font-mono border border-neutral-800">Relay Documentation</span><h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-neutral-100">Building with Relay on Base</h1><p>Pay-per-request data over canonical x402 v2. The browser, local SDK, and MCP server call the same HTTP gateway.</p><p role="note" className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-200 text-xs">Relay implements canonical x402 v2 exact payment settlement with native USDC on Base. Powered by Primer Systems public facilitator with zero gas bootstrapping required.</p></header>

          <section id="quickstart" className={sectionClass}>
            <h2 className={headingClass}>Quickstart</h2>
            <p>From this checkout, install dependencies and start the local gateway with Node 24.x. Development and terminal MCP commands load local environment configuration before starting.</p>
            <CodeBlock label="Local setup" code={'npm install\nnpm run dev'} />
            <p>This request only inspects an offer. It does not sign or spend USDC.</p>
            <CodeBlock label="Unauthenticated request (POSIX shell)" code={`curl -i -X POST http://localhost:5173/v1/crypto/price \\\n  -H 'Content-Type: application/json' \\\n  -d '{"assets":["bitcoin","ethereum"],"vsCurrency":"eur"}'`} />
          </section>

          <section id="concepts" className={sectionClass}><h2 className={headingClass}>Core concepts</h2><div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs"><div className="rounded-xl bg-neutral-900/30 border border-neutral-800/80 p-5"><h3 className="text-sm text-neutral-100 mb-2">Exact payment policy</h3><p>Clients pin the network, official USDC token, merchant, resource URL, exact catalog amount, and bounded authorization lifetime before signing.</p></div><div className="rounded-xl bg-neutral-900/30 border border-neutral-800/80 p-5"><h3 className="text-sm text-neutral-100 mb-2">Confirmed settlement</h3><p>An off-chain signature is not a receipt. Successful data delivery requires a matching PAYMENT-RESPONSE header and confirmed settlement metadata.</p></div></div></section>

          <section id="why-base" className={sectionClass}><h2 className={headingClass}>Base networks</h2><p>Use Base Mainnet (8453) for real USDC or Base Sepolia (84532) for test tokens. The gateway, SDK/MCP, and browser must agree. A mismatch fails before signing.</p><CodeBlock label="Public network configuration (example)" code={'# Server process\nRELAY_NETWORK=base\nGATEWAY_ORIGIN=https://relayx402.vercel.app\nFACILITATOR_URL=https://x402.primer.systems\n\n# Browser build; every VITE_ value is public\nVITE_BASE_NETWORK=base\nVITE_GATEWAY_URL=https://relayx402.vercel.app\nVITE_RELAY_TREASURY_ADDRESS=YOUR_CONFIGURED_TREASURY_ADDRESS\n\n# SDK/MCP process\nBASE_NETWORK=base\nRELAY_TREASURY_ADDRESS=YOUR_CONFIGURED_TREASURY_ADDRESS'} /><p>Relay uses Primer Systems public x402 facilitator by default for gasless USDC on-chain settlement on Base Mainnet and Base Sepolia, requiring no server-side gas wallet. Self-hosted settlement is also supported via RELAY_FACILITATOR_KEY. Keep all private keys server-side or in the local signing process, never in a VITE_ variable. Injected browser wallets work without WalletConnect configuration; set VITE_WALLETCONNECT_PROJECT_ID to enable WalletConnect wallets.</p></section>

          <section id="handshake" className={sectionClass}><h2 className={headingClass}>The x402 handshake</h2><ol className="list-decimal pl-5 space-y-3"><li>POST validated endpoint parameters without payment. The gateway returns HTTP 402 with a base64 JSON PAYMENT-REQUIRED header and the matching challenge body.</li><li>Validate x402Version: 2, resource, and accepts. The selected offer uses scheme: exact and network: eip155:8453 or eip155:84532.</li><li>Sign the EIP-712 authorization and submit the complete canonical proof once in PAYMENT-SIGNATURE. It includes accepted and payload.signature plus payload.authorization.</li><li>The gateway verifies authorization, retrieves the provider result, and confirms settlement. HTTP 200 returns PAYMENT-RESPONSE and a matching _settlement/data body.</li></ol><p className="text-xs text-amber-300">Legacy Authorization, signature-only, and transaction-hash-only proofs are not supported. A pending payment is not a successful response.</p></section>

          <section id="eip712" className={sectionClass}><h2 className={headingClass}>EIP-712 signing</h2><p>USDC uses TransferWithAuthorization with from, to, value, validAfter, validBefore, and a cryptographically random bytes32 nonce. Canonical proof timestamps are decimal strings. The maximum authorization lifetime is 300 seconds.</p><p>Base Mainnet's domain name is USD Coin; Base Sepolia's is USDC. Both use version 2. Use the shared client helper rather than constructing an unvalidated signing domain from a remote response.</p></section>

          <section id="manifest" className={sectionClass}><h2 className={headingClass}>Machine manifest</h2><p>GET /.well-known/x402 is free and lists gateway resources and prices. The viewer fetches the configured gateway, not a local substitute.</p><button type="button" onClick={onOpenDiscovery} className="text-xs font-mono text-neutral-200 underline underline-offset-4">Fetch gateway discovery manifest</button></section>

          <section id="ts-sdk" className={sectionClass}><h2 className={headingClass}>TypeScript and Viem</h2><p>The SDK is part of this checkout, not a published Relay package. Set the local key, matching treasury/network, and both explicit spending limits. Missing or zero limits disable signing. For example, a per-call limit of 0.12 and a daily limit of 5 permit catalog calls within those budgets.</p><CodeBlock label="Repository-local SDK" code={SDK_EXAMPLE} /><p>The following complete launcher runs from the repository root using the installed tsx loader and the same environment variables.</p><CodeBlock label="SDK command" code={SDK_LAUNCH_COMMAND} /><p>SDK reservations include concurrent calls. Once a signature may have reached the gateway, a failure does not release its reservation or trigger an automatic payment retry. The SDK's default ledger is process-local; MCP uses a persistent ledger.</p><p>For a single manually authorized low-level call, the complete example below uses the browser-safe canonical helpers. Automated applications should use the SDK budget policy instead.</p><CodeBlock label="Complete Viem payment example" code={VIEM_EXAMPLE} /></section>

          <section id="python-sdk" className={sectionClass}><h2 className={headingClass}>Python discovery</h2><p>This example inspects the challenge only. Weather takes coordinates, not a place-name query; forward geocoding is a separate endpoint.</p><CodeBlock label="Python challenge inspection" code={`import base64, json, requests\n\nres = requests.post(\n    "http://localhost:5173/v1/weather",\n    json={"latitude": 52.52, "longitude": 13.405},\n    timeout=30, allow_redirects=False\n)\nif res.status_code == 402:\n    offer = json.loads(base64.b64decode(res.headers["PAYMENT-REQUIRED"]))\n    print(json.dumps(offer, indent=2))\nelse:\n    res.raise_for_status()\n# No wallet key or payment is used by this example.`} /></section>

          <section id="mcp-server" className={sectionClass}><h2 className={headingClass}>Cursor and Claude MCP</h2><p>Use npm run mcp in a terminal. Desktop configuration should launch Node directly with absolute checkout paths, as shown below, to keep the stdio channel free of npm startup banners. Replace the path, local key, and treasury placeholders.</p><CodeBlock label="Local desktop MCP configuration" code={MCP_LOCAL_CONFIG} /><p>BASE_NETWORK, GATEWAY_ORIGIN, RELAY_TREASURY_ADDRESS, MAX_PAYMENT_USDC, and MAX_DAILY_BUDGET_USDC are enforced. The default budget ledger is ~/.relay/mcp-budget.json, keyed by account, network, and UTC day. RELAY_BUDGET_FILE can choose an absolute location outside the repository. Do not delete the ledger or its lock to bypass an uncertain payment; reconcile first.</p><button type="button" onClick={onOpenMcp} className="text-xs font-mono text-neutral-200 underline underline-offset-4">Open MCP setup dialog</button></section>

          <section id="token-utility" className={sectionClass}>
            <h2 className={headingClass}>$RELAY Token Utility & Vibestarter Architecture</h2>
            <p>
              Relay is engineered for autonomous AI agents on Base. For the upcoming Vibestarter raise following Vibeathon 02, the $RELAY token has four distinct, high-demand utilities designed into the core protocol from Day 1:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs mt-4">
              <div className="rounded-xl bg-neutral-900/40 border border-neutral-800 p-5 space-y-2">
                <span className="text-blue-400 font-mono text-[11px] font-semibold uppercase tracking-wider block">1. In-Protocol Fuel & 50% Discount</span>
                <h3 className="text-sm font-medium text-neutral-100">Direct x402 Payment Option</h3>
                <p className="text-neutral-400 leading-relaxed">
                  In canonical x402 v2, gateways accept multiple settlement assets. Agents paying with $RELAY receive an automatic 50% discount compared to native USDC, driving direct buy pressure from high-volume agent operators.
                </p>
              </div>
              <div className="rounded-xl bg-neutral-900/40 border border-neutral-800 p-5 space-y-2">
                <span className="text-emerald-400 font-mono text-[11px] font-semibold uppercase tracking-wider block">2. Agent Quota Staking</span>
                <h3 className="text-sm font-medium text-neutral-100">Perpetual Daily Free Credits</h3>
                <p className="text-neutral-400 leading-relaxed">
                  Agent frameworks and developers can stake $RELAY once to unlock daily gasless query credits (Tier 1: 50 calls/day, Tier 2: 500 calls/day + rate limit priority), eliminating micro-transaction friction.
                </p>
              </div>
              <div className="rounded-xl bg-neutral-900/40 border border-neutral-800 p-5 space-y-2">
                <span className="text-purple-400 font-mono text-[11px] font-semibold uppercase tracking-wider block">3. Provider Marketplace Bonding</span>
                <h3 className="text-sm font-medium text-neutral-100">Slashing & Quality Collateral</h3>
                <p className="text-neutral-400 leading-relaxed">
                  Third-party developers who want to list custom APIs on Relay and earn USDC from AI agents must stake $RELAY as a quality guarantee bond, creating protocol-level lockups.
                </p>
              </div>
              <div className="rounded-xl bg-neutral-900/40 border border-neutral-800 p-5 space-y-2">
                <span className="text-amber-400 font-mono text-[11px] font-semibold uppercase tracking-wider block">4. Programmatic Buyback & Burn</span>
                <h3 className="text-sm font-medium text-neutral-100">Direct Protocol Revenue Accrual</h3>
                <p className="text-neutral-400 leading-relaxed">
                  A 20% protocol share of all USDC collected across gateway endpoints is programmatically routed to buy back and burn $RELAY on Base decentralized exchanges, directly linking API usage to token scarcity.
                </p>
              </div>
            </div>
            <p className="text-xs text-neutral-500 font-mono mt-2">
              Note: Token launch and liquidity bootstrapping will occur exclusively via the Vibestarter platform post-hackathon.
            </p>
          </section>

          <section id="endpoints" className={sectionClass}><h2 className={headingClass}>Endpoints and limits</h2><p>Academic routes are /v1/academic/search and /v1/academic/work. FX uses baseCurrency and targets; crypto uses assets and vsCurrency. Use CoinGecko asset IDs, not exchange ticker symbols. Request JSON must be an object with only schema fields; request bodies are limited to 16 KiB and arrays to ten values.</p><p>News covers recent Hacker News submissions, not global reporting; submitted_at is not an article publication date. Geocoding is forward-only. Claim lookup returns INSUFFICIENT with retrieved evidence and null confidence, not an automated factual verdict. Research aggregates source material without certifying its truth.</p><button type="button" onClick={() => onNavigate('capabilities')} className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/60 text-neutral-300 px-4 py-2 text-xs font-medium">Browse schemas and exact prices <FaArrowRight className="size-2.5" /></button></section>

          <section id="errors" className={sectionClass}><h2 className={headingClass}>Errors and recovery</h2><ul className="list-disc pl-5 space-y-3"><li>400/413/415: correct the request shape, size, or content type before signing.</li><li>405: use the endpoint's POST method. A GET is not a paid execution.</li><li>402: missing payment gives a challenge; rejected, expired, or replayed authorizations are not settled again.</li><li>502: provider retrieval failed before the gateway submitted payment. A client still conservatively retains a reservation if its signature was exposed.</li><li>503: gateway configuration, verification, or settlement may be unavailable. settlement_pending and settlement_in_progress are explicitly unconfirmed. Preserve any returned transaction hash and do not pay again automatically.</li></ul><p>A timeout or malformed response after signature submission is an uncertain outcome, not evidence of zero spend. Reconcile on the configured chain with the gateway operator. The UI never fabricates a hash, marks a pending entry settled, or displays paid data without a matching receipt.</p></section>
        </article>
        <aside className="lg:col-span-3 sticky top-24 space-y-6 hidden lg:block min-w-0"><div className="rounded-xl bg-neutral-900/40 border border-neutral-800/80 p-4 space-y-3 text-xs"><h2 className="text-neutral-200 font-mono">Integration checklist</h2><p>Matching Base network and treasury</p><p>Official USDC signing domain</p><p>Exact price and bounded validity</p><p>Explicit SDK/MCP budgets</p><p>Confirmed receipt, never a fabricated hash</p></div><button type="button" onClick={() => onNavigate('playground')} className="text-xs text-neutral-200 underline underline-offset-4">Open HTTP Playground</button></aside>
      </div>
    </div></main>
    <Footer onNavigate={onNavigate} onOpenMcp={onOpenMcp} onOpenDiscovery={onOpenDiscovery} />
  </div>;
};

export default DocsPage;
