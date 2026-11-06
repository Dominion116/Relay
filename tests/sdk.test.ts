import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { recoverTypedDataAddress, type Hex } from 'viem';
import { PaymentPayloadV2Schema, PaymentRequiredV2Schema } from '@x402/core/schemas';
import { RelayClient, RelayPaymentError, type RelayClientConfig } from '../src/sdk/relayClient';
import { MemoryBudgetStore, type PaymentBudgetStore } from '../src/sdk/budgetStore';
import {
  createPaymentAuthorization, createPaymentPayload, decodePaymentHeader, encodePaymentHeader,
  EIP712_TRANSFER_TYPES, normalizeGatewayUrl, parseUsdcAmount, paymentNetwork,
  validatePaymentChallenge, validateSettlementResponse,
} from '../src/shared/paymentClient';
import { DEFAULT_TREASURY_ADDRESS, RELAY_RESOURCES } from '../src/shared/resources';
import type { RelayNetwork, X402Challenge, X402PaymentProof } from '../src/types/x402';

const ORIGIN = 'https://relay.test';
const PATH = '/v1/crypto/price';
const TX = `0x${'ab'.repeat(32)}`;

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

function offer(path = PATH, network: RelayNetwork = 'base', treasury = DEFAULT_TREASURY_ADDRESS): X402Challenge {
  const trusted = paymentNetwork(network);
  const resource = RELAY_RESOURCES.find(item => item.path === path.replace(/^\/api/, ''))!;
  return {
    x402Version: 2,
    resource: { url: `${ORIGIN}${path}`, description: resource.description, mimeType: 'application/json' },
    accepts: [{ scheme: 'exact', network: trusted.network, asset: trusted.asset, amount: resource.amount,
      payTo: treasury, maxTimeoutSeconds: 300, extra: { name: trusted.name, version: '2' } }],
  };
}

function settled(proof: X402PaymentProof, data: unknown = { ok: true }) {
  const header = { success: true, transaction: TX, network: proof.accepted.network,
    payer: proof.payload.authorization.from, amount: proof.accepted.amount };
  const body = { _settlement: { protocol: 'x402 v2', network: header.network, asset: 'USDC',
    cost_usdc: `$${(Number(proof.accepted.amount) / 1_000_000).toFixed(6)}`, payer: header.payer,
    tx_hash: TX, settled_at: new Date().toISOString() }, data };
  return { header, body };
}

function gateway(options: {
  network?: RelayNetwork;
  treasury?: Hex;
  challenge?: (challenge: any) => void;
  bodyChallenge?: (challenge: any) => void;
  initial?: (challenge: X402Challenge) => Response;
  paid?: (proof: X402PaymentProof, params: Record<string, unknown>) => Response | Promise<Response>;
} = {}) {
  // Generated only for this offline test run; no chain transport or funded account is used.
  const privateKey = generatePrivateKey();
  const requests: Array<{ url: string; body: Record<string, unknown>; headers: Headers }> = [];
  const proofs: X402PaymentProof[] = [];
  const transport: typeof fetch = async (input, init) => {
    const url = String(input);
    assert.equal(new URL(url).origin, ORIGIN);
    assert.equal(init?.redirect, 'error');
    const headers = new Headers(init?.headers);
    assert.equal(headers.has('Authorization'), false);
    assert.equal(headers.has('X-Payment-Proof'), false);
    const body = JSON.parse(String(init?.body ?? '{}'));
    requests.push({ url, body, headers });
    if (headers.has('PAYMENT-SIGNATURE')) {
      const proof = decodePaymentHeader(headers.get('PAYMENT-SIGNATURE')) as X402PaymentProof;
      proofs.push(proof);
      if (options.paid) return options.paid(proof, body);
      const receipt = settled(proof, body);
      return json(receipt.body, 200, { 'PAYMENT-RESPONSE': encodePaymentHeader(receipt.header) });
    }
    const challenge = offer(new URL(url).pathname, options.network, options.treasury);
    options.challenge?.(challenge);
    if (options.initial) return options.initial(challenge);
    const bodyChallenge = structuredClone(challenge);
    options.bodyChallenge?.(bodyChallenge);
    return json(bodyChallenge, 402, { 'PAYMENT-REQUIRED': encodePaymentHeader(challenge) });
  };
  const client = (overrides: Partial<RelayClientConfig> = {}) => new RelayClient({
    privateKey, gatewayUrl: ORIGIN, network: options.network, treasuryAddress: options.treasury,
    maxPaymentUsdc: '0.12', maxDailyBudgetUsdc: '2', budgetStore: new MemoryBudgetStore(), fetch: transport, ...overrides,
  });
  return { privateKey, transport, requests, proofs, client };
}

test('SDK accepts valid prefixed/unprefixed keys and never replaces an invalid supplied key', () => {
  const mock = gateway();
  assert.equal(mock.client().address, mock.client({ privateKey: mock.privateKey.slice(2) }).address);
  assert.equal(mock.client().address, mock.client({ privateKey: mock.privateKey.toUpperCase() }).address);
  for (const key of ['', 'not-a-key', '0x1234', `0x${'00'.repeat(32)}`, `0x${'ff'.repeat(32)}`]) {
    assert.throws(() => mock.client({ privateKey: key }), /private.?key/i);
  }
  assert.equal(mock.requests.length, 0);
});

test('automatic signing requires both explicit, usable, positive spending limits', async () => {
  const mock = gateway();
  for (const config of [
    { maxPaymentUsdc: undefined }, { maxDailyBudgetUsdc: undefined },
    { maxPaymentUsdc: 0 }, { maxDailyBudgetUsdc: '0.000000' },
  ]) await assert.rejects(mock.client(config).crypto.price(['bitcoin']), /disabled/);
  for (const invalid of [-1, NaN, Infinity, '', 'unlimited', '0.0000001', '1e3']) {
    assert.throws(() => mock.client({ maxDailyBudgetUsdc: invalid }), /Invalid/);
  }
  await assert.rejects(mock.client({ maxPaymentUsdc: '0.039999' }).crypto.price(['bitcoin']), /per-call/);
  assert.equal(mock.requests.length, 0);
  assert.equal(parseUsdcAmount('0.04'), 40000n);
});

test('canonical payment exchange recovers the intended never-funded payer and returns only a matching receipt', async () => {
  const mock = gateway();
  const client = mock.client();
  const result = await client.crypto.price(['solana'], 'eur');
  assert.deepEqual(result.data, { assets: ['solana'], vsCurrency: 'eur' });
  assert.equal(result.settlement.tx_hash, TX);
  assert.equal(mock.requests.length, 2);
  assert.equal(PaymentRequiredV2Schema.safeParse(offer()).success, true);
  const proof = mock.proofs[0];
  assert.equal(PaymentPayloadV2Schema.safeParse(proof).success, true);
  assert.equal(proof.x402Version, 2);
  assert.equal('paymentRequirements' in proof, false);
  assert.equal(typeof proof.payload.authorization.validBefore, 'string');
  const auth = proof.payload.authorization;
  const recovered = await recoverTypedDataAddress({
    domain: { name: 'USD Coin', version: '2', chainId: 8453, verifyingContract: paymentNetwork().asset },
    types: EIP712_TRANSFER_TYPES, primaryType: 'TransferWithAuthorization',
    message: { from: auth.from as Hex, to: auth.to as Hex, value: BigInt(auth.value),
      validAfter: BigInt(auth.validAfter), validBefore: BigInt(auth.validBefore), nonce: auth.nonce as Hex },
    signature: proof.payload.signature as Hex,
  });
  assert.equal(recovered, client.address);
  assert.equal(BigInt(auth.validBefore) - BigInt(auth.validAfter), 300n);
  assert.ok(Number(auth.validBefore) <= Math.floor(Date.now() / 1000) + 300);
  assert.deepEqual(mock.requests[0].body, mock.requests[1].body);
});

test('Base Sepolia uses its official USDC token/domain and an explicitly configured merchant', async () => {
  const treasury = privateKeyToAccount(generatePrivateKey()).address;
  const mock = gateway({ network: 'base-sepolia', treasury });
  const client = mock.client();
  const result = await client.crypto.price(['bitcoin']);
  assert.equal(result.settlement.network, 'eip155:84532');
  assert.equal(mock.proofs[0].accepted.asset, paymentNetwork('base-sepolia').asset);
  assert.equal(mock.proofs[0].accepted.extra.name, 'USDC');
  assert.equal(mock.proofs[0].payload.authorization.to, treasury);
  const validated = validatePaymentChallenge(offer(PATH, 'base-sepolia', treasury), {
    gatewayUrl: ORIGIN, endpoint: PATH, network: 'base-sepolia', treasuryAddress: treasury,
  });
  assert.equal(createPaymentAuthorization(validated, client.address).typedData.domain.chainId, 84532);
});

test('untrusted challenges are rejected before any reservation, signature, or paid request', async t => {
  const other = privateKeyToAccount(generatePrivateKey()).address;
  const mutations: Array<[string, (challenge: any) => void]> = [
    ['version', value => { value.x402Version = '2'; }],
    ['legacy requirements', value => { value.paymentRequirements = {}; }],
    ['scheme', value => { value.accepts[0].scheme = 'upto'; }],
    ['chain', value => { value.accepts[0].network = 'eip155:1'; }],
    ['token', value => { value.accepts[0].asset = other; }],
    ['merchant', value => { value.accepts[0].payTo = other; }],
    ['domain name', value => { value.accepts[0].extra.name = 'Untrusted token'; }],
    ['domain version', value => { value.accepts[0].extra.version = '1'; }],
    ['unsupported transfer method', value => { value.accepts[0].extra.assetTransferMethod = 'permit2'; }],
    ['overpayment', value => { value.accepts[0].amount = '999999999'; }],
    ['underpayment', value => { value.accepts[0].amount = '39999'; }],
    ['numeric amount', value => { value.accepts[0].amount = 40000; }],
    ['expiry', value => { value.accepts[0].maxTimeoutSeconds = 86400; }],
    ['invalid timeout', value => { value.accepts[0].maxTimeoutSeconds = 0; }],
    ['host', value => { value.resource.url = `https://evil.test${PATH}`; }],
    ['path', value => { value.resource.url = `${ORIGIN}/v1/fx/rates`; }],
    ['MIME type', value => { value.resource.mimeType = 'text/html'; }],
    ['multiple offers', value => { value.accepts.push(value.accepts[0]); }],
  ];
  for (const [name, mutation] of mutations) await t.test(name, async () => {
    const mock = gateway({ challenge: mutation });
    let reserved = 0;
    const budget: PaymentBudgetStore = {
      reserve: async () => { reserved++; throw new Error('Unexpected reservation'); },
      release: async () => undefined, commit: async () => undefined,
    };
    await assert.rejects(mock.client({ budgetStore: budget }).crypto.price(['bitcoin']));
    assert.equal(reserved, 0);
    assert.equal(mock.proofs.length, 0);
    assert.equal(mock.requests.length, 1);
  });
});

test('price changes need an explicit per-call ceiling and must still obey the global per-call budget', async () => {
  const mock = gateway({ challenge: value => { value.accepts[0].amount = '50000'; } });
  await assert.rejects(mock.client().crypto.price(['bitcoin']), /price/);
  const client = mock.client({ maxPaymentUsdc: '0.06' });
  const result = await client.call(PATH, { assets: ['bitcoin'] }, { maxPriceUsdc: '0.05' });
  assert.equal(result.settlement.cost_usdc, '$0.050000');
  await assert.rejects(mock.client({ maxPaymentUsdc: '0.04' }).call(PATH, { assets: ['bitcoin'] }, { maxPriceUsdc: '1' }), /price/);
  await assert.rejects(client.call(PATH, { assets: ['bitcoin'] }, { maxPriceUsdc: 0 }), /budget/);
});

test('header/body offer changes, missing canonical headers, and unsolicited initial success are not signed', async () => {
  const changed = gateway({ bodyChallenge: value => { value.resource.description = 'Different approved offer'; } });
  await assert.rejects(changed.client().crypto.price(['bitcoin']), /changed/);
  const missing = gateway({ initial: challenge => json(challenge, 402) });
  await assert.rejects(missing.client().crypto.price(['bitcoin']), /header/);
  const unsolicited = gateway({ initial: () => json({ data: 'unpaid', _settlement: { tx_hash: TX } }) });
  await assert.rejects(unsolicited.client().crypto.price(['bitcoin']), /Expected an HTTP 402/);
  assert.equal(changed.proofs.length + missing.proofs.length + unsolicited.proofs.length, 0);
});

test('gateway origin, exact endpoint paths, and redirects are constrained before exposure', async () => {
  const mock = gateway();
  for (const origin of ['http://remote.test', 'https://relay.test/path', 'https://user:secret@relay.test', 'https://relay.test/?x=1']) {
    assert.throws(() => mock.client({ gatewayUrl: origin }), /Gateway URL/);
  }
  for (const endpoint of ['https://evil.test/v1/crypto/price', '//evil.test', `${PATH}?override=1`, '/v1/crypto/../fx/rates', '/v1/%63rypto/price']) {
    await assert.rejects(mock.client().call(endpoint, { assets: ['bitcoin'] }), /endpoint/);
  }
  assert.equal(mock.requests.length, 0);
  assert.equal(normalizeGatewayUrl('http://127.0.0.1:5173/'), 'http://127.0.0.1:5173');
  const redirect = gateway({ initial: () => json({}, 307, { Location: 'https://evil.test' }) });
  await assert.rejects(redirect.client().crypto.price(['bitcoin']), /redirect/);
  const changedUrl = gateway({ initial: challenge => {
    const response = json(challenge, 402, { 'PAYMENT-REQUIRED': encodePaymentHeader(challenge) });
    Object.defineProperty(response, 'url', { value: `https://evil.test${PATH}` });
    return response;
  } });
  await assert.rejects(changedUrl.client().crypto.price(['bitcoin']), /changed response URLs/);
  assert.equal(redirect.proofs.length + changedUrl.proofs.length, 0);
});

test('all convenience helpers use the actual gateway input fields, including zero coordinates and missing helpers', async () => {
  const mock = gateway();
  const client = mock.client();
  assert.deepEqual((await client.fx.rates('EUR', ['JPY'])).data, { baseCurrency: 'EUR', targets: ['JPY'] });
  assert.deepEqual((await client.geocode.search('Tokyo')).data, { query: 'Tokyo' });
  assert.deepEqual((await client.holidays.list('US', 2027)).data, { countryCode: 'US', year: 2027 });
  assert.deepEqual((await client.weather.forecast(0, 0)).data, { latitude: 0, longitude: 0 });
  await client.crypto.market(['ethereum']);
  await client.academic.search('payment protocols', 2);
  await client.academic.work('10.1000/example');
  await client.news.search('agents');
  await client.knowledge.search('Base');
  await client.research.pack('payments');
  await client.verify.claim('A retrieval is not a proof.');
  assert.equal(mock.proofs.length, 11);
});

test('concurrent clients sharing an account cannot reserve beyond the daily budget', async () => {
  const mock = gateway();
  const clients = [0, 1].map(() => mock.client({ maxDailyBudgetUsdc: '0.08', budgetStore: undefined }));
  const results = await Promise.allSettled(Array.from({ length: 12 }, (_, index) => clients[index % 2].crypto.price(['bitcoin'])));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 2);
  assert.equal(mock.proofs.length, 2);
  assert.equal(new Set(mock.proofs.map(proof => proof.payload.authorization.nonce)).size, 2);
});

test('a reservation precedes signing; only a known local pre-exposure failure can release it', async () => {
  const mock = gateway();
  const store = new MemoryBudgetStore();
  const events: string[] = [];
  const budget: PaymentBudgetStore = {
    reserve: async request => { events.push('reserve'); return store.reserve(request); },
    commit: async reservation => { events.push('commit'); await store.commit(reservation); },
    release: async reservation => { events.push('release'); await store.release(reservation); },
  };
  const client = mock.client({ budgetStore: budget, maxDailyBudgetUsdc: '0.04' });
  Object.defineProperty(client, 'signTypedData', { configurable: true, value: async () => { events.push('sign'); throw new Error('Local signer refused'); } });
  await assert.rejects(client.crypto.price(['bitcoin']), /Local signer refused/);
  assert.deepEqual(events, ['reserve', 'sign', 'release']);
  assert.equal(mock.proofs.length, 0);
  Object.defineProperty(client, 'signTypedData', { value: privateKeyToAccount(mock.privateKey).signTypedData });
  await client.crypto.price(['bitcoin']);
  assert.equal(mock.proofs.length, 1);
});

test('network errors, provider HTTP 502, changed paid challenges and uncertain settlement never release or retry payment', async t => {
  for (const mode of ['network', '502', '402', '503', 'redirect']) await t.test(mode, async () => {
    const mock = gateway({ paid: proof => {
      if (mode === 'network') throw new Error('Connection interrupted after authorization');
      if (mode === 'redirect') return json({}, 307, { Location: 'https://evil.test' });
      const status = Number(mode);
      return json({ error: 'Uncertain payment', transaction: TX }, status, {
        'PAYMENT-RESPONSE': encodePaymentHeader({ success: false, transaction: TX,
          network: proof.accepted.network, payer: proof.payload.authorization.from, amount: proof.accepted.amount }),
      });
    } });
    const client = mock.client({ maxDailyBudgetUsdc: '0.04' });
    await assert.rejects(client.crypto.price(['bitcoin']), error => {
      assert.ok(error instanceof RelayPaymentError);
      assert.equal(error.paymentMayHaveSettled, true);
      if (mode === '503') assert.equal(error.transactionHash, TX);
      return true;
    });
    assert.equal(mock.requests.length, 2);
    await assert.rejects(client.crypto.price(['bitcoin']), /Daily USDC budget exceeded/);
    assert.equal(mock.proofs.length, 1);
  });
});

test('failure to durably commit a reservation does not expose a signature or refund uncertain accounting', async () => {
  const mock = gateway();
  const store = new MemoryBudgetStore();
  let releases = 0;
  const client = mock.client({ maxDailyBudgetUsdc: '0.04', budgetStore: {
    reserve: request => store.reserve(request),
    commit: async () => { throw new Error('Storage interrupted'); },
    release: async () => { releases++; },
  } });
  await assert.rejects(client.crypto.price(['bitcoin']), /Storage interrupted/);
  await assert.rejects(client.crypto.price(['bitcoin']), /Daily USDC budget exceeded/);
  assert.equal(releases, 0);
  assert.equal(mock.proofs.length, 0);
});

test('receipt validation rejects missing, fake, failed, and inconsistent settlement fields', async t => {
  const mock = gateway();
  const validated = validatePaymentChallenge(offer(), { gatewayUrl: ORIGIN, endpoint: PATH });
  const payment = createPaymentAuthorization(validated, mock.client().address);
  const proof = createPaymentPayload(validated, payment.authorization, await privateKeyToAccount(mock.privateKey).signTypedData(payment.typedData));
  const expected = { network: proof.accepted.network, payer: proof.payload.authorization.from, asset: proof.accepted.asset, amount: proof.accepted.amount };
  const mutations: Array<[string, (value: ReturnType<typeof settled>) => void]> = [
    ['failed', value => { value.header.success = false; }],
    ['fake hash', value => { value.header.transaction = 'fabricated'; }],
    ['zero hash', value => { value.header.transaction = `0x${'0'.repeat(64)}`; }],
    ['different hash', value => { value.body._settlement.tx_hash = `0x${'cd'.repeat(32)}`; }],
    ['different payer', value => { value.header.payer = DEFAULT_TREASURY_ADDRESS; }],
    ['different amount', value => { value.header.amount = '1'; }],
    ['different cost', value => { value.body._settlement.cost_usdc = '$0.01'; }],
    ['different network', value => { value.body._settlement.network = 'eip155:84532'; }],
    ['different asset', value => { value.body._settlement.asset = 'ETH'; }],
    ['missing receipt', value => { delete (value.body as any)._settlement; }],
    ['invalid date', value => { value.body._settlement.settled_at = 'not-a-date'; }],
    ['future date', value => { value.body._settlement.settled_at = '9999-01-01T00:00:00Z'; }],
  ];
  for (const [name, mutation] of mutations) await t.test(name, () => {
    const value = settled(proof);
    mutation(value);
    assert.throws(() => validateSettlementResponse(value.body, encodePaymentHeader(value.header), expected));
  });
  const valid = settled(proof, null);
  assert.throws(() => validateSettlementResponse(valid.body, null, expected), /header/);
  assert.equal(validateSettlementResponse(valid.body, encodePaymentHeader(valid.header), expected).tx_hash, TX);
});

test('browser-safe helpers use UTF-8 base64, secure distinct nonces, and immutable validated offers', () => {
  const value = { message: 'Payment \u00e9 \u65e5\u672c\u8a9e' };
  assert.deepEqual(decodePaymentHeader(encodePaymentHeader(value)), value);
  for (const invalid of [null, '', '{}', 'not base64', 'a'.repeat(20_000), '////']) {
    assert.throws(() => decodePaymentHeader(invalid));
  }
  const challenge = offer();
  const validated = validatePaymentChallenge(challenge, { gatewayUrl: ORIGIN, endpoint: PATH });
  challenge.accepts[0].amount = '999999';
  assert.equal(validated.accepted.amount, '40000');
  assert.equal(Object.isFrozen(validated.accepted), true);
  const address = privateKeyToAccount(generatePrivateKey()).address;
  const one = createPaymentAuthorization(validated, address);
  const two = createPaymentAuthorization(validated, address);
  assert.match(one.authorization.nonce, /^0x[0-9a-f]{64}$/);
  assert.notEqual(one.authorization.nonce, two.authorization.nonce);
  assert.throws(() => createPaymentAuthorization({ ...validated }, address), /Validate/);
  assert.throws(() => createPaymentPayload(validated, one.authorization, '0x1234'), /signature/);
});
