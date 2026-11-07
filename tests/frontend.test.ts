import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
import * as payments from '../src/shared/paymentClient';
import * as resources from '../src/shared/resources';
import * as validation from '../src/shared/validation';
import { base, baseSepolia } from 'viem/chains';
import { getAddress } from 'viem';

const root = new URL('../src/', import.meta.url);
const payer = `0x${'11'.repeat(20)}`;
const transaction = `0x${'ab'.repeat(32)}`;
const signature = `0x${'12'.repeat(65)}`;
const gateway = 'https://gateway.test';
const resource = resources.RELAY_RESOURCES.find(item => item.id === 'crypto_price')!;
const compiled = new Map<string, string>();

// Browser modules run against explicit mocks. Unlisted imports and network calls fail closed.
function load(file: string, modules: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  if (!compiled.has(file)) compiled.set(file, ts.transpileModule(readFileSync(new URL(file, root), 'utf8'), {
    fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText.replace(/\bimport\.meta\b/g, '__meta'));
  const module = { exports: {} };
  vm.runInNewContext(compiled.get(file)!, {
    module, exports: module.exports,
    require(id: string) { assert(Object.hasOwn(modules, id), `Unmocked browser import: ${file}: ${id}`); return modules[id]; },
    Error, URL, Date, TextEncoder, TextDecoder, AbortController, performance,
    setTimeout, clearTimeout, console, crypto: webcrypto, __meta: { env: {} },
    fetch: () => { throw new Error('Unexpected network request in frontend test'); },
    ...globals,
  }, { filename: file });
  return module.exports as any;
}

class Hooks {
  values: any[] = [];
  cursor = 0;
  effects: Array<() => void | (() => void)> = [];
  react: any;
  constructor() {
    const useState = (initial: any) => {
      const index = this.cursor++;
      if (!(index in this.values)) this.values[index] = typeof initial === 'function' ? initial() : initial;
      return [this.values[index], (value: any) => { this.values[index] = typeof value === 'function' ? value(this.values[index]) : value; }];
    };
    const useRef = (value: any) => {
      const index = this.cursor++;
      return this.values[index] ||= { current: value };
    };
    this.react = { __esModule: true, useState, useRef, useEffect: (effect: any) => this.effects.push(effect),
      default: { createElement: (type: any, props: any, ...children: any[]) => ({ type, props: { ...props, children } }) } };
  }
  render(component: any, props: any) { this.cursor = 0; this.effects = []; return component(props); }
}
function nodes(node: any): any[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  return node && typeof node === 'object' && node.props ? [node, ...nodes(node.props.children)] : [];
}
function text(node: any): string {
  if (Array.isArray(node)) return node.map(text).join(' ');
  if (node && typeof node === 'object') return text(node.props?.children);
  return node === null || node === undefined || typeof node === 'boolean' ? '' : String(node);
}
const icons = new Proxy({}, { get: (_target, key) => key === '__esModule' ? true : String(key) });
const publicConfig = {
  getGatewayUrl: () => gateway, relayChain: base, relayNetwork: 'base', relayNetworkLabel: 'Base Mainnet',
  relayTokenAddress: resources.BASE_USDC_MAINNET, relayTreasuryAddress: resources.DEFAULT_TREASURY_ADDRESS,
};
const common = {
  'react-icons/fa6': icons, 'lucide-react': icons,
  '../components/HeaderNav': { HeaderNav: 'HeaderNav' }, '../components/Footer': { Footer: 'Footer' },
  '../config/wagmi': publicConfig, '../shared/resources': resources,
  '../shared/paymentClient': payments, '../shared/validation': validation,
};

function challenge() {
  return { x402Version: 2, resource: { url: gateway + resource.path, description: resource.description, mimeType: 'application/json' },
    accepts: [{ scheme: 'exact', network: 'eip155:8453', asset: resources.BASE_USDC_MAINNET, amount: resource.amount,
      payTo: resources.DEFAULT_TREASURY_ADDRESS, maxTimeoutSeconds: 300, extra: { name: 'USD Coin', version: '2' } }] };
}
function unpaid(offer = challenge(), body = offer) {
  return new Response(JSON.stringify(body), { status: 402, headers: { 'PAYMENT-REQUIRED': payments.encodePaymentHeader(offer) } });
}
function settled() {
  const header = { success: true, transaction, network: 'eip155:8453', payer, amount: resource.amount };
  const body = { _settlement: { protocol: 'x402 v2', network: header.network, asset: 'USDC', cost_usdc: '$0.04', payer, tx_hash: transaction, settled_at: new Date().toISOString() }, data: { marker: 'CONFIRMED_DATA' } };
  return new Response(JSON.stringify(body), { headers: { 'PAYMENT-RESPONSE': payments.encodePaymentHeader(header) } });
}
function playground(fetchMock: typeof fetch, wallet = { chainId: 8453, reject: false, balance: 1_000_000n }) {
  const hooks = new Hooks();
  const operations: string[] = [];
  const balanceQueries: any[] = [];
  const page = load('pages/PlaygroundPage.tsx', {
    ...common, react: hooks.react, '@rainbow-me/rainbowkit': { ConnectButton: 'ConnectButton' },
    wagmi: {
      useAccount: () => ({ address: payer, isConnected: true, chain: { id: wallet.chainId }, connector: { getChainId: async () => wallet.chainId } }),
      useSwitchChain: () => ({ switchChainAsync: async ({ chainId }: any) => { operations.push('switch'); wallet.chainId = chainId; return { id: chainId }; } }),
      useSignTypedData: () => ({ signTypedDataAsync: async (input: any) => { operations.push('sign'); assert.equal(input.domain.chainId, 8453); if (wallet.reject) throw new Error('Wallet rejected'); return signature; } }),
      useReadContract: (query: any) => { balanceQueries.push(query); return { data: wallet.balance, isLoading: false, refetch: async () => { operations.push('balance'); return { data: wallet.balance }; } }; },
    },
  }, { fetch: fetchMock });
  const props: any = { onNavigate() {}, onOpenMcp() {}, onOpenDiscovery() {}, settlementLedger: [],
    onRecordSettlement(item: any) { props.settlementLedger = [item, ...props.settlementLedger.filter((old: any) => old.id !== item.id)]; } };
  const render = () => hooks.render(page.PlaygroundPage, props);
  const execute = (tree: any) => nodes(tree).find(node => node.type === 'button' && text(node).includes('USDC & Execute')).props.onClick();
  return { executePlaygroundRequest: page.executePlaygroundRequest, hooks, render, execute, props, operations, balanceQueries };
}
function executionOptions(overrides: any = {}) {
  return { resource, params: resource.defaultParams, payer, signal: new AbortController().signal,
    policy: { gatewayUrl: gateway, endpoint: resource.path, network: 'base', treasuryAddress: resources.DEFAULT_TREASURY_ADDRESS, expectedAmount: resource.amount },
    sign: async () => signature, onChallenge() {}, onProof() {}, onSubmitted() {}, ...overrides };
}

test('browser components do not import server modules or obsolete payment implementations', () => {
  const files = ['App.tsx', 'main.tsx', 'config/wagmi.ts', ...['pages', 'components'].flatMap(dir => readdirSync(new URL(`${dir}/`, root)).filter(file => /\.tsx?$/.test(file)).map(file => `${dir}/${file}`))];
  for (const file of files) {
    const source = readFileSync(new URL(file, root), 'utf8');
    const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    for (const statement of parsed.statements) if (ts.isImportDeclaration(statement)) assert.doesNotMatch(statement.moduleSpecifier.getText(), /server\//, file);
    assert.doesNotMatch(source, /Math\.random|generate402Challenge|verifyPaymentProof|dispatchResourceRequest|academic_works|academic\/works|@relay\/(?:sdk|mcp-server)/, file);
  }
});

test('Playground performs exactly one unsigned POST and one canonical paid POST', async () => {
  const requests: any[] = [];
  const page = playground((async (url, init) => { requests.push({ url, ...init }); return requests.length === 1 ? unpaid() : settled(); }) as typeof fetch);
  const result = await page.executePlaygroundRequest(executionOptions());
  assert.equal(requests.length, 2);
  assert.equal(requests[0].url, gateway + resource.path);
  assert.equal(requests[0].method, 'POST');
  assert.equal(requests[0].headers['PAYMENT-SIGNATURE'], undefined);
  assert.equal(requests[1].headers.Authorization, undefined);
  assert.equal(requests[1].redirect, 'error');
  const proof = payments.decodePaymentHeader(requests[1].headers['PAYMENT-SIGNATURE']) as any;
  assert.equal(proof.x402Version, 2);
  assert.equal(proof.payload.signature, signature);
  assert.equal(proof.accepted.amount, resource.amount);
  assert.equal(result.receipt.tx_hash, transaction);
  assert.equal(result.data.marker, 'CONFIRMED_DATA');
});

test('a missing header, wrong price, or disagreeing challenge cannot invoke the wallet', async () => {
  let signatures = 0;
  const wrong = challenge(); wrong.accepts[0].amount = '999999999999';
  const changed = challenge(); changed.resource.description = 'A different offer';
  for (const response of [new Response(JSON.stringify(challenge()), { status: 402 }), unpaid(wrong), unpaid(challenge(), changed)]) {
    const page = playground((async () => response) as typeof fetch);
    await assert.rejects(page.executePlaygroundRequest(executionOptions({ sign: async () => { signatures++; return signature; } })));
  }
  assert.equal(signatures, 0);
});

test('pending settlement preserves the reported real hash and never repays', async () => {
  let calls = 0;
  const header = { success: false, errorReason: 'settlement_pending', transaction, network: 'eip155:8453', payer, amount: resource.amount };
  const page = playground((async () => ++calls === 1 ? unpaid() : new Response(JSON.stringify({ code: 'settlement_pending', message: 'Confirmation pending', transaction }), {
    status: 503, headers: { 'PAYMENT-RESPONSE': payments.encodePaymentHeader(header) },
  })) as typeof fetch);
  await assert.rejects(page.executePlaygroundRequest(executionOptions()), (error: any) => {
    assert.equal(error.name, 'PlaygroundPaymentError'); assert.equal(error.transactionHash, transaction); return true;
  });
  assert.equal(calls, 2);
});

test('HTTP 200 without a valid canonical receipt cannot release paid data', async () => {
  let calls = 0;
  const page = playground((async () => ++calls === 1 ? unpaid() : new Response(JSON.stringify({ data: 'UNCONFIRMED', _settlement: { tx_hash: transaction } }))) as typeof fetch);
  await assert.rejects(page.executePlaygroundRequest(executionOptions()), /Payment was not confirmed/);
  assert.equal(calls, 2);
});

test('a malformed response body does not discard a reported pending transaction hash', async () => {
  let calls = 0;
  const page = playground((async () => ++calls === 1 ? unpaid() : new Response('not json', {
    status: 503, headers: { 'PAYMENT-RESPONSE': payments.encodePaymentHeader({ success: false, transaction, network: 'eip155:8453', payer, amount: resource.amount }) },
  })) as typeof fetch);
  await assert.rejects(page.executePlaygroundRequest(executionOptions()), (error: any) => error.transactionHash === transaction);
  assert.equal(calls, 2);
});

test('reentrant execute events cannot open a second payment flow', async () => {
  let calls = 0;
  const page = playground((async (_url, init: any) => { calls++; return init.headers['PAYMENT-SIGNATURE'] ? settled() : unpaid(); }) as typeof fetch);
  const tree = page.render();
  await Promise.all([page.execute(tree), page.execute(tree)]);
  assert.equal(calls, 2);
  assert.equal(page.operations.filter(operation => operation === 'sign').length, 1);
});

test('a false verification flag cannot render confirmation or paid data', async () => {
  const page = playground((async (_url, init: any) => init.headers['PAYMENT-SIGNATURE'] ? settled() : unpaid()) as typeof fetch);
  await page.execute(page.render());
  const index = page.hooks.values.findIndex(value => value?.valid === true && value.receipt);
  assert(index >= 0);
  page.hooks.values[index] = { ...page.hooks.values[index], valid: false };
  assert.doesNotMatch(text(page.render()), /GATEWAY-CONFIRMED SETTLEMENT|CONFIRMED_DATA/);
});

test('wallet rejection clears a previous successful response before the retry fails', async () => {
  const wallet = { chainId: 8453, reject: false, balance: 1_000_000n };
  let paidRequests = 0;
  const page = playground((async (_url, init: any) => { if (init.headers['PAYMENT-SIGNATURE']) { paidRequests++; return settled(); } return unpaid(); }) as typeof fetch, wallet);
  await page.execute(page.render());
  assert.match(text(page.render()), /GATEWAY-CONFIRMED SETTLEMENT/);
  wallet.reject = true;
  await page.execute(page.render());
  const output = text(page.render());
  assert.match(output, /Wallet rejected/);
  assert.doesNotMatch(output, /GATEWAY-CONFIRMED SETTLEMENT|CONFIRMED_DATA|HTTP 200 OK/);
  assert.equal(paidRequests, 1);
});

test('invalid JSON also clears stale output before wallet or gateway work', async () => {
  let requests = 0;
  const page = playground((async (_url, init: any) => { requests++; return init.headers['PAYMENT-SIGNATURE'] ? settled() : unpaid(); }) as typeof fetch);
  await page.execute(page.render());
  nodes(page.render()).find(node => node.type === 'textarea').props.onChange({ target: { value: '{' } });
  await page.execute(page.render());
  assert.doesNotMatch(text(page.render()), /CONFIRMED_DATA|GATEWAY-CONFIRMED SETTLEMENT/);
  assert.equal(requests, 2);
});

test('chain switch and correct-chain balance checks finish before signing', async () => {
  const page = playground((async (_url, init: any) => init.headers['PAYMENT-SIGNATURE'] ? settled() : unpaid()) as typeof fetch, { chainId: 1, reject: false, balance: 1_000_000n });
  await page.execute(page.render());
  assert.deepEqual(page.operations.slice(0, 3), ['switch', 'balance', 'sign']);
  assert(page.balanceQueries.every(query => query.chainId === 8453 && query.address === resources.BASE_USDC_MAINNET));
});

test('pending UI does not count unconfirmed funds or enable another payment', async () => {
  const page = playground((async (_url, init: any) => init.headers['PAYMENT-SIGNATURE'] ? new Response('{}', { status: 503 }) : unpaid()) as typeof fetch);
  await page.execute(page.render());
  const tree = page.render();
  assert.match(text(tree), /No transaction hash was returned/);
  assert.equal(nodes(tree).find(node => node.type === 'button' && text(node).includes('USDC & Execute')).props.disabled, true);
  assert.equal(page.props.settlementLedger[0].status, 'PENDING');
  assert.equal(page.props.settlementLedger[0].txHash, undefined);
  nodes(tree).find(node => node.props.role === 'tab' && text(node).startsWith('Settlement Ledger')).props.onClick();
  assert.match(text(page.render()), /\$\s*0\.0000\s+USDC/);
});

test('payment controls are labeled, output tabs are linked, and footer actions are wired', () => {
  const page = playground((async () => { throw new Error('No request expected'); }) as typeof fetch);
  const tree = page.render();
  const all = nodes(tree);
  for (const input of all.filter(node => node.type === 'select' || node.type === 'textarea')) assert(all.some(label => label.type === 'label' && label.props.htmlFor === input.props.id));
  for (const tab of all.filter(node => node.props.role === 'tab')) assert.equal(tab.props['aria-controls'], 'playground-output');
  const footer = all.find(node => node.type === 'Footer');
  for (const name of ['onNavigate', 'onOpenMcp', 'onOpenDiscovery']) assert.equal(typeof footer.props[name], 'function');
});

test('homepage queries use a real academic search catalog entry', () => {
  const hooks = new Hooks();
  const routes = Object.fromEntries(['HomePage', 'CapabilitiesPage', 'PlaygroundPage', 'ProtocolPage', 'DocsPage', 'TermsPage', 'PrivacyPage', 'NotFoundPage'].map(name => [`./pages/${name}`, { [name]: name }]));
  const app = load('App.tsx', { react: hooks.react, ...routes, './components/McpIntegrationModal': { McpIntegrationModal: 'Mcp' }, './components/DiscoveryModal': { DiscoveryModal: 'Discovery' } });
  const initial = hooks.render(app.App, {});
  nodes(initial).find(node => node.type === 'HomePage').props.onSelectQueryForPlayground('quantum computing');
  const target = nodes(hooks.render(app.App, {})).find(node => node.type === 'PlaygroundPage');
  assert.equal(target.props.initialResourceId, 'academic_search');
  assert(resources.RELAY_RESOURCES.some(item => item.id === target.props.initialResourceId));
});

test('discovery fetches the gateway and exposes loading and error states', async () => {
  const hooks = new Hooks();
  const requested: string[] = [];
  let reject = false;
  const modal = load('components/DiscoveryModal.tsx', { ...common, react: hooks.react, './Dialog': { Dialog: 'Dialog' } }, {
    fetch: async (url: string) => { requested.push(url); return reject ? new Response('{}', { status: 503 }) : new Response(JSON.stringify({ x402Version: 2, resources: [] })); },
  });
  const props = { isOpen: true, onClose() {} };
  hooks.render(modal.DiscoveryModal, props);
  let cleanup = hooks.effects[0]();
  assert.match(text(hooks.render(modal.DiscoveryModal, props)), /Fetching the gateway manifest/);
  await new Promise(resolve => setImmediate(resolve));
  assert.match(text(hooks.render(modal.DiscoveryModal, props)), /Gateway response \(x402 v2\)/);
  assert.deepEqual(requested, [`${gateway}/.well-known/x402`]);
  if (typeof cleanup === 'function') cleanup();
  reject = true;
  cleanup = hooks.effects[0]();
  await new Promise(resolve => setImmediate(resolve));
  const failed = text(hooks.render(modal.DiscoveryModal, props));
  assert.match(failed, /HTTP 503/);
  assert.doesNotMatch(failed, /Gateway response \(x402 v2\)/);
  if (typeof cleanup === 'function') cleanup();
});

test('dialog traps focus, handles Escape, and restores background/focus on close', () => {
  let document: any;
  class Element {
    inert = false;
    isConnected = true;
    attributes = new Map<string, string>();
    controls: Element[] = [];
    getAttribute(name: string) { return this.attributes.get(name) ?? null; }
    setAttribute(name: string, value: string) { this.attributes.set(name, value); }
    removeAttribute(name: string) { this.attributes.delete(name); }
    focus() { document.activeElement = this; }
    querySelectorAll() { return this.controls; }
    getClientRects() { return [1]; }
    contains(element: Element) { return element === this || this.controls.includes(element); }
  }
  const opener = new Element(), background = new Element(), overlay = new Element(), dialog = new Element();
  const first = new Element(), last = new Element(); dialog.controls = [first, last];
  const handlers = new Map<string, any>();
  document = { activeElement: opener, body: { children: [background, overlay], style: { overflow: 'auto' } },
    addEventListener: (name: string, handler: any) => handlers.set(name, handler), removeEventListener: (name: string) => handlers.delete(name) };
  const hooks = new Hooks();
  let closed = 0;
  const module = load('components/Dialog.tsx', { react: hooks.react, 'react-dom': { createPortal: (tree: any) => tree } }, { document, HTMLElement: Element });
  const tree = hooks.render(module.Dialog, { titleId: 'test-title', onClose: () => closed++, children: 'Content' });
  tree.props.ref.current = overlay;
  const panel = nodes(tree).find(node => node.props.role === 'dialog'); panel.props.ref.current = dialog;
  assert.equal(panel.props['aria-modal'], 'true');
  assert.match(panel.props.className, /100dvh.*overflow-y-auto/);
  const cleanup = hooks.effects[0]();
  assert.equal(document.activeElement, dialog);
  assert.equal(background.inert, true);
  const key = (value: string, shiftKey = false) => handlers.get('keydown')({ key: value, shiftKey, preventDefault() {} });
  key('Tab', true); assert.equal(document.activeElement, last);
  key('Tab'); assert.equal(document.activeElement, first);
  key('Escape'); assert.equal(closed, 1);
  if (typeof cleanup === 'function') cleanup();
  assert.equal(background.inert, false);
  assert.equal(document.activeElement, opener);
  assert.equal(document.body.style.overflow, 'auto');
  assert.equal(handlers.size, 0);
});

test('docs copy the entire Viem function and expose the errors section', async () => {
  const hooks = new Hooks();
  const clipboard: string[] = [];
  const docs = load('pages/DocsPage.tsx', { ...common, react: hooks.react, '../components/McpIntegrationModal': { MCP_LOCAL_CONFIG: '{}' } }, {
    navigator: { clipboard: { writeText: async (value: string) => clipboard.push(value) } },
  });
  const tree = hooks.render(docs.DocsPage, { onNavigate() {}, onOpenMcp() {}, onOpenDiscovery() {} });
  const block = nodes(tree).find(node => node.props.label === 'Complete Viem payment example');
  const rendered = block.type(block.props);
  await nodes(rendered).find(node => node.type === 'button').props.onClick();
  assert.equal(clipboard[0], docs.VIEM_EXAMPLE);
  assert.match(clipboard[0], /export async function callRelay/);
  assert.match(clipboard[0], /PAYMENT-SIGNATURE/);
  assert.match(clipboard[0], /validateSettlementResponse/);
  assert(nodes(tree).some(node => node.props.id === 'errors'));
  for (const code of [docs.SDK_EXAMPLE, docs.VIEM_EXAMPLE]) {
    const source = ts.createSourceFile('example.ts', code, ts.ScriptTarget.Latest, true);
    assert.equal((source as any).parseDiagnostics.length, 0);
  }
});

test('browser configuration pins Sepolia and does not reuse a public WalletConnect demo project', () => {
  let options: any;
  const hooks = { getDefaultConfig: (value: any) => { options = value; return value; } };
  const config = load('config/wagmi.ts', { '@rainbow-me/rainbowkit': hooks, '@rainbow-me/rainbowkit/wallets': { injectedWallet() {} },
    'wagmi/chains': { base, baseSepolia }, wagmi: { http: () => 'mock-rpc' }, viem: { getAddress },
    '../shared/resources': resources, '../shared/paymentClient': payments }, { __meta: { env: { VITE_BASE_NETWORK: 'base-sepolia' } }, window: { location: { origin: 'http://localhost:5173' } } });
  assert.equal(config.relayChain.id, 84532);
  assert.equal(config.relayTokenAddress, resources.BASE_USDC_SEPOLIA);
  assert.equal(config.getGatewayUrl(), 'http://localhost:5173');
  assert.equal(options.projectId, '');
  assert.equal(options.wallets[0].wallets.length, 1);
});
