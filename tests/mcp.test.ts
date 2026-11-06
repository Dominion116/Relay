import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createMcpToolExecutor, getMcpToolsList } from '../src/mcp/relay-mcp';
import { FileBudgetStore } from '../src/mcp/budgetStore';
import { decodePaymentHeader, encodePaymentHeader, paymentNetwork } from '../src/shared/paymentClient';
import { DEFAULT_TREASURY_ADDRESS, RELAY_RESOURCES } from '../src/shared/resources';
import type { X402PaymentProof, RelayNetwork } from '../src/types/x402';
import type { BudgetRequest } from '../src/sdk/budgetStore';

const ORIGIN = 'https://relay-mcp.test';
const TX = `0x${'cd'.repeat(32)}`;

async function budgetFile(t: TestContext): Promise<string> {
  const root = join(tmpdir(), 'kilo');
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(join(root, 'relay-mcp-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return join(directory, 'budget.json');
}

function mockGateway(network: RelayNetwork = 'base', treasury = DEFAULT_TREASURY_ADDRESS, status = 200) {
  const proofs: X402PaymentProof[] = [];
  const requests: string[] = [];
  const transport: typeof fetch = async (input, init) => {
    const url = String(input);
    assert.equal(new URL(url).origin, ORIGIN);
    assert.equal(init?.method, 'POST');
    assert.equal(init?.redirect, 'error');
    requests.push(url);
    const headers = new Headers(init?.headers);
    const trusted = paymentNetwork(network);
    const resource = RELAY_RESOURCES.find(item => item.path === new URL(url).pathname)!;
    if (!headers.has('PAYMENT-SIGNATURE')) {
      const challenge = { x402Version: 2, resource: { url, description: resource.description, mimeType: 'application/json' },
        accepts: [{ scheme: 'exact', network: trusted.network, asset: trusted.asset, amount: resource.amount,
          payTo: treasury, maxTimeoutSeconds: 300, extra: { name: trusted.name, version: '2' } }] };
      return new Response(JSON.stringify(challenge), { status: 402, headers: { 'PAYMENT-REQUIRED': encodePaymentHeader(challenge) } });
    }
    const proof = decodePaymentHeader(headers.get('PAYMENT-SIGNATURE')) as X402PaymentProof;
    proofs.push(proof);
    const settlement = { success: status === 200, transaction: TX, network: trusted.network,
      payer: proof.payload.authorization.from, amount: proof.accepted.amount };
    const body = status === 200
      ? { _settlement: { protocol: 'x402 v2', network: trusted.network, asset: 'USDC', cost_usdc: '$0.04',
        payer: settlement.payer, tx_hash: TX, settled_at: new Date().toISOString() }, data: JSON.parse(String(init?.body)) }
      : { code: status === 503 ? 'settlement_pending' : 'upstream_failure', transaction: TX, network: trusted.network };
    return new Response(JSON.stringify(body), { status, headers: { 'PAYMENT-RESPONSE': encodePaymentHeader(settlement) } });
  };
  return { transport, proofs, requests };
}

function environment(file: string, overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return { AGENT_PRIVATE_KEY: generatePrivateKey(), BASE_NETWORK: 'base', GATEWAY_ORIGIN: ORIGIN,
    MAX_PAYMENT_USDC: '0.04', MAX_DAILY_BUDGET_USDC: '0.04', RELAY_BUDGET_FILE: file, ...overrides };
}

function request(account = privateKeyToAccount(generatePrivateKey()).address): BudgetRequest {
  return { account, network: 'eip155:8453', amount: '40000', dailyLimit: '40000' };
}

test('MCP lists all tools without keys and publishes bounded JSON Schema array items', () => {
  const tools = getMcpToolsList();
  assert.equal(tools.length, 12);
  for (const tool of tools) {
    assert.equal(tool.inputSchema.type, 'object');
    assert.equal(tool.inputSchema.additionalProperties, false);
    for (const property of Object.values(tool.inputSchema.properties)) {
      if (property.type === 'array') {
        assert.equal(property.items?.type, 'string');
        assert.equal(property.minItems, 1);
        assert.equal(property.maxItems, 10);
      }
    }
  }
  assert.equal(tools.find(tool => tool.name === 'relay_weather')!.inputSchema.properties.latitude.minimum, -90);
  assert.equal(tools.find(tool => tool.name === 'relay_academic_search')!.inputSchema.properties.limit.maximum, 20);
});

test('missing and invalid MCP keys return isError without generating a wallet or accessing the network', async () => {
  let network = 0;
  const transport: typeof fetch = async () => { network++; throw new Error('Network must remain unused'); };
  for (const env of [{}, { BASE_PRIVATE_KEY: generatePrivateKey() }, { AGENT_PRIVATE_KEY: 'invalid' }]) {
    const execute = createMcpToolExecutor({ env, fetch: transport });
    const result = await execute('relay_crypto_price', { assets: ['bitcoin'] });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /PRIVATE_KEY|private.?key/i);
  }
  assert.equal(network, 0);
});

test('MCP honors explicit zero/missing budgets and rejects invalid parameters before HTTP', async t => {
  const file = await budgetFile(t);
  let network = 0;
  const transport: typeof fetch = async () => { network++; throw new Error('Network must remain unused'); };
  for (const override of [
    { MAX_PAYMENT_USDC: '0' }, { MAX_DAILY_BUDGET_USDC: '0' },
    { MAX_PAYMENT_USDC: undefined }, { MAX_DAILY_BUDGET_USDC: undefined },
    { MAX_DAILY_BUDGET_USDC: '-1' }, { MAX_DAILY_BUDGET_USDC: 'Infinity' },
  ]) {
    const execute = createMcpToolExecutor({ env: environment(file, override), fetch: transport });
    assert.equal((await execute('relay_crypto_price', { assets: ['bitcoin'] })).isError, true);
  }
  const execute = createMcpToolExecutor({ env: environment(file), fetch: transport });
  for (const args of [{}, { assets: 'bitcoin' }, { assets: ['bitcoin'], unexpected: true }, { assets: Array(11).fill('bitcoin') }]) {
    assert.equal((await execute('relay_crypto_price', args)).isError, true);
  }
  assert.equal((await execute('crypto_price', { assets: ['bitcoin'] })).isError, true);
  assert.equal(network, 0);
  await assert.rejects(readFile(file), { code: 'ENOENT' });
});

test('MCP reuses one SDK client over canonical HTTP and applies Base Sepolia, gateway, treasury and budgets', async t => {
  const file = await budgetFile(t);
  const treasury = privateKeyToAccount(generatePrivateKey()).address;
  const env = environment(file, { BASE_NETWORK: 'base-sepolia', RELAY_TREASURY_ADDRESS: treasury,
    GATEWAY_ORIGIN: undefined, RELAY_GATEWAY_URL: ORIGIN, MAX_DAILY_BUDGET_USDC: '0.08' });
  const key = env.AGENT_PRIVATE_KEY!;
  env.AGENT_PRIVATE_KEY = key.slice(2);
  const mock = mockGateway('base-sepolia', treasury);
  const execute = createMcpToolExecutor({ env, fetch: mock.transport });
  const first = await execute('relay_crypto_price', { assets: ['solana'], vsCurrency: 'eur' });
  assert.notEqual(first.isError, true);
  const response = JSON.parse(first.content[0].text);
  assert.equal(response._settlement.network, 'eip155:84532');
  assert.deepEqual(response.data, { assets: ['solana'], vsCurrency: 'eur' });
  // Configuration is fixed once the lazy SDK client is initialized, not rebuilt for each tool call.
  env.AGENT_PRIVATE_KEY = generatePrivateKey();
  const second = await execute('relay_fx_rates', { baseCurrency: 'EUR', targets: ['JPY'] });
  assert.notEqual(second.isError, true);
  assert.equal(mock.proofs.length, 2);
  assert.equal(mock.proofs[0].payload.authorization.from, privateKeyToAccount(key as `0x${string}`).address);
  assert.equal(mock.proofs[1].payload.authorization.from, mock.proofs[0].payload.authorization.from);
  assert.equal(mock.proofs[0].accepted.extra.name, 'USDC');
  assert.equal(mock.proofs[0].accepted.payTo, treasury);
  assert.equal(mock.requests.length, 4);
  const persisted = await readFile(file, 'utf8');
  assert.equal(persisted.includes(key), false);
  assert.equal(persisted.includes(key.slice(2)), false);
});

test('MCP spending persists across executor/store restart and ambiguous provider errors', async t => {
  for (const status of [200, 502, 503]) await t.test(`HTTP ${status}`, async subtest => {
    const file = await budgetFile(subtest);
    const env = environment(file);
    const mock = mockGateway('base', DEFAULT_TREASURY_ADDRESS, status);
    const first = await createMcpToolExecutor({ env, fetch: mock.transport })('relay_crypto_price', { assets: ['bitcoin'] });
    assert.equal(first.isError === true, status !== 200);
    if (status === 503) assert.match(first.content[0].text, new RegExp(TX));
    const restarted = createMcpToolExecutor({ env: { ...env }, fetch: mock.transport });
    const second = await restarted('relay_crypto_price', { assets: ['bitcoin'] });
    assert.equal(second.isError, true);
    assert.match(second.content[0].text, /Daily USDC budget exceeded/);
    assert.equal(mock.proofs.length, 1);
    const ledger = JSON.parse(await readFile(file, 'utf8'));
    const day = Object.values(ledger.days)[0] as { spent: string; pending: object };
    assert.equal(day.spent, '40000');
    assert.deepEqual(day.pending, {});
  });
});

test('persistent reservations survive interruption before signing and cannot be released after commit', async t => {
  const file = await budgetFile(t);
  const budget = request();
  const reservation = await new FileBudgetStore(file).reserve(budget);
  const restarted = new FileBudgetStore(file);
  await assert.rejects(restarted.reserve(budget), /Daily USDC budget exceeded/);
  await restarted.release(reservation); // The test has not generated or shared a signature.
  const retry = await restarted.reserve(budget);
  await restarted.commit(retry);
  await assert.rejects(restarted.release(retry), /already finalized/);
  await assert.rejects(new FileBudgetStore(file).reserve(budget), /Daily USDC budget exceeded/);
});

test('independent persistent stores lock atomically and never oversubscribe a budget', async t => {
  const file = await budgetFile(t);
  const budget = request();
  const results = await Promise.allSettled(Array.from({ length: 10 }, () => new FileBudgetStore(file).reserve(budget)));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.ok(results.filter(result => result.status === 'rejected').every(result => /locked|budget exceeded/.test(String(result.reason))));
  await assert.rejects(new FileBudgetStore(file).reserve(budget), /Daily USDC budget exceeded/);
});

test('persistent budgets are scoped by account, network, and UTC authorization day', async t => {
  const file = await budgetFile(t);
  const store = new FileBudgetStore(file);
  const first = request();
  await store.commit(await store.reserve(first));
  await store.commit(await store.reserve({ ...first, network: 'eip155:84532' }));
  await store.commit(await store.reserve(request()));
  const ledger = JSON.parse(await readFile(file, 'utf8'));
  const today = new Date().toISOString().slice(0, 10);
  assert.equal(Object.keys(ledger.days).length, 3);
  assert.ok(Object.keys(ledger.days).every(key => key.endsWith(today)));
  const scope = `${first.account.toLowerCase()}|eip155:8453|${today}`;
  const priorDay = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  ledger.days[scope.replace(today, priorDay)] = ledger.days[scope];
  delete ledger.days[scope];
  await writeFile(file, JSON.stringify(ledger));
  const reservation = await new FileBudgetStore(file).reserve(first);
  assert.ok(reservation.scope.endsWith(today));
});

test('locked, corrupt, and malformed budget files fail closed without being reset or exposing payment', async t => {
  for (const mode of ['lock', 'json', 'negative', 'version']) await t.test(mode, async subtest => {
    const file = await budgetFile(subtest);
    const env = environment(file);
    const account = privateKeyToAccount(env.AGENT_PRIVATE_KEY! as `0x${string}`).address.toLowerCase();
    const scope = `${account}|eip155:8453|${new Date().toISOString().slice(0, 10)}`;
    const content = mode === 'json' ? '{invalid-json'
      : mode === 'negative' ? JSON.stringify({ version: 1, days: { [scope]: { spent: '-1', pending: {} } } })
      : JSON.stringify({ version: mode === 'version' ? 99 : 1, days: {} });
    await writeFile(file, content);
    if (mode === 'lock') await writeFile(`${file}.lock`, 'interrupted process');
    const mock = mockGateway();
    const result = await createMcpToolExecutor({ env, fetch: mock.transport })('relay_crypto_price', { assets: ['bitcoin'] });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /locked|corrupt/);
    assert.equal(mock.proofs.length, 0);
    assert.equal(await readFile(file, 'utf8'), content);
    if (mode === 'lock') assert.equal(await readFile(`${file}.lock`, 'utf8'), 'interrupted process');
  });
});

test('MCP rejects conflicting gateway/network configuration instead of silently changing trust', async t => {
  const file = await budgetFile(t);
  const mock = mockGateway();
  for (const override of [
    { BASE_NETWORK: 'ethereum' }, { RELAY_GATEWAY_URL: 'https://other.test' },
    { RELAY_TREASURY_ADDRESS: 'not-an-address' }, { RELAY_BUDGET_FILE: 'relative-budget.json' },
  ]) {
    const result = await createMcpToolExecutor({ env: environment(file, override), fetch: mock.transport })('relay_crypto_price', { assets: ['bitcoin'] });
    assert.equal(result.isError, true);
  }
  assert.equal(mock.requests.length, 0);
  assert.throws(() => new FileBudgetStore(fileURLToPath(new URL('../src/budget.json', import.meta.url))), /outside/);
});

test('real MCP stdio initialize/tools/list remains usable with no key; execution is a clear tool error', { timeout: 90_000 }, async t => {
  const source = new URL('../src/mcp/server.ts', import.meta.url).href;
  const bootstrap = `globalThis.fetch = async () => { throw new Error('NETWORK_DISABLED'); }; await import(${JSON.stringify(source)});`;
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--import', 'tsx', '--input-type=module', '--eval', bootstrap],
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    env: { PATH: process.env.PATH ?? '', SystemRoot: process.env.SystemRoot ?? '',
      TEMP: process.env.TEMP ?? tmpdir(), TMP: process.env.TMP ?? tmpdir(), AGENT_PRIVATE_KEY: '', BASE_PRIVATE_KEY: '' },
    stderr: 'pipe',
  });
  const client = new Client({ name: 'relay-offline-test', version: '1.0.0' }, { capabilities: {} });
  t.after(() => client.close());
  await client.connect(transport);
  const tools = await client.listTools();
  assert.equal(tools.tools.length, 12);
  const result = await client.callTool({ name: 'relay_crypto_price', arguments: { assets: ['bitcoin'] } });
  assert.equal(result.isError, true);
  assert.match(JSON.stringify(result.content), /AGENT_PRIVATE_KEY/);
});
