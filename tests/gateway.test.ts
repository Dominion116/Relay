import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleGatewayRequest, type GatewayDependencies } from '../src/server/gatewayHandler';
import { RELAY_RESOURCES, verifyPaymentProof } from '../src/server/x402Engine';
import { getRequestSchema, MAX_REQUEST_BYTES, validateResourceParams } from '../src/shared/validation';
import handler from '../src/api-handlers/v1-route';
import discoveryHandler from '../src/api-handlers/well-known-x402';
import { relayGatewayPlugin } from '../src/server/viteGatewayPlugin';
import { EventEmitter } from 'node:events';

const origin = 'https://gateway.example';
const payer = '0x1111111111111111111111111111111111111111';
const transaction = `0x${'a'.repeat(64)}`;
const jsonHeaders = { 'content-type': 'application/json' };
const proofHeader = Buffer.from(JSON.stringify({ payerAddress: 'not-an-address' })).toString('base64');
const paidHeaders = { ...jsonHeaders, 'payment-signature': proofHeader };
const decode = (value: string) => JSON.parse(Buffer.from(value, 'base64').toString('utf8'));

function fixture(overrides: Partial<GatewayDependencies> = {}) {
  const calls: string[] = [];
  const dependencies: GatewayDependencies = {
    verify: async (_proof, resource) => {
      calls.push('verify');
      assert.equal(new URL(resource.url).origin, origin);
      return { valid: true, payer, amount: resource.amount };
    },
    dispatch: async (id, params) => { calls.push('dispatch'); return { id, params }; },
    settle: async (_proof, resource) => {
      calls.push('settle');
      return { valid: true, payer, amount: resource.amount, txHash: transaction, settledAt: '2026-11-05T12:00:00.000Z', network: `eip155:${resource.chainId}` };
    },
    ...overrides
  };
  return { calls, dependencies };
}

for (const resource of RELAY_RESOURCES) {
  test(`${resource.id}: canonical and alias challenges, preflight, method, confirmed flow`, async () => {
    for (const path of [resource.path, `/api${resource.path}`]) {
      const { calls, dependencies } = fixture();
      const challenge = await handleGatewayRequest('POST', path, jsonHeaders, resource.defaultParams, origin, dependencies);
      assert.equal(challenge.status, 402);
      assert.deepEqual(decode(challenge.headers['PAYMENT-REQUIRED']), challenge.body);
      assert.equal(challenge.body.x402Version, 2);
      assert.equal(challenge.body.resource.url, `${origin}${path}`);
      assert.equal(challenge.body.accepts[0].scheme, 'exact');
      assert.equal(challenge.body.accepts[0].amount, resource.amount);
      assert.equal(challenge.body.paymentRequirements, undefined);
      assert.deepEqual(calls, []);
      const preflight = await handleGatewayRequest('OPTIONS', path, {}, undefined, origin, dependencies);
      assert.equal(preflight.status, 204);
      assert.match(preflight.headers['Access-Control-Allow-Headers'], /PAYMENT-SIGNATURE/);
      assert.equal((await handleGatewayRequest('GET', path, {}, undefined, origin, dependencies)).status, 405);
      const response = await handleGatewayRequest('POST', path, paidHeaders, resource.defaultParams, origin, dependencies);
      assert.equal(response.status, 200);
      assert.deepEqual(calls, ['verify', 'dispatch', 'settle']);
      assert.equal(response.body._settlement.tx_hash, transaction);
      assert.deepEqual(decode(response.headers['PAYMENT-RESPONSE']), { success: true, transaction, network: `eip155:${resource.chainId}`, payer, amount: resource.amount });
    }
  });

  test(`${resource.id}: actual verifier rejects forged payer-only proof without provider calls`, async () => {
    const { dependencies, calls } = fixture({ verify: verifyPaymentProof });
    const response = await handleGatewayRequest('POST', resource.path, paidHeaders, resource.defaultParams, origin, dependencies);
    assert.equal(response.status, 402);
    assert.equal(response.body.data, undefined);
    assert.deepEqual(calls, []);
  });
}

test('validation rejects missing, null, malformed, unknown, invalid and oversized inputs before verification', async () => {
  const cases: [string, unknown, number, Record<string, string>][] = [
    ['/v1/weather', {}, 400, paidHeaders],
    ['/v1/fx/rates', null, 400, paidHeaders],
    ['/v1/weather', 'null', 400, paidHeaders],
    ['/v1/weather', '{invalid', 400, paidHeaders],
    ['/v1/academic/search', { query: 'x', extra: true }, 400, paidHeaders],
    ['/v1/academic/search', { query: 'x', limit: 1.5 }, 400, paidHeaders],
    ['/v1/academic/search', { query: 'x', limit: 21 }, 400, paidHeaders],
    ['/v1/crypto/price', { assets: 123 }, 400, paidHeaders],
    ['/v1/crypto/price', { assets: Array.from({ length: 11 }, (_, i) => `asset${i}`) }, 400, paidHeaders],
    ['/v1/weather', { latitude: 91, longitude: 0 }, 400, paidHeaders],
    ['/v1/academic/work', { doi: 'not-a-doi' }, 400, paidHeaders],
    ['/v1/holidays', { countryCode: 'USA' }, 400, paidHeaders],
    ['/v1/academic/search', { query: 'x'.repeat(MAX_REQUEST_BYTES) }, 413, paidHeaders],
    ['/v1/weather', { latitude: 0, longitude: 0 }, 415, { 'content-type': 'text/plain' }]
  ];
  for (const [path, body, status, headers] of cases) {
    const { calls, dependencies } = fixture();
    const response = await handleGatewayRequest('POST', path, headers, body, origin, dependencies);
    assert.equal(response.status, status, `${path}: ${JSON.stringify(response.body)}`);
    assert.deepEqual(calls, []);
  }
});

test('zero coordinates survive validation and provider dispatch', async () => {
  const { dependencies } = fixture();
  const response = await handleGatewayRequest('POST', '/v1/weather', paidHeaders, { latitude: 0, longitude: 0 }, origin, dependencies);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.params, { latitude: 0, longitude: 0 });
});

test('provider failure never submits a payment', async () => {
  let settlements = 0;
  const { dependencies } = fixture({ dispatch: async () => { throw new Error('upstream timeout'); }, settle: async () => { settlements++; throw new Error('must not run'); } });
  const response = await handleGatewayRequest('POST', '/v1/weather', paidHeaders, { latitude: 0, longitude: 0 }, origin, dependencies);
  assert.equal(response.status, 502);
  assert.equal(settlements, 0);
  assert.match(response.body.message, /No payment was submitted/);
});

test('unserializable and oversized provider responses are rejected before charging', async () => {
  const cyclic: any = {};
  cyclic.self = cyclic;
  for (const value of [cyclic, undefined, { value: 'x'.repeat(1_000_001) }]) {
    let settlements = 0;
    const { dependencies } = fixture({ dispatch: async () => value, settle: async () => { settlements++; throw new Error('must not run'); } });
    const response = await handleGatewayRequest('POST', '/v1/weather', paidHeaders, { latitude: 0, longitude: 0 }, origin, dependencies);
    assert.equal(response.status, 502);
    assert.equal(settlements, 0);
  }
});

test('invalid, unavailable and expired proofs never execute providers or settlement', async () => {
  for (const [errorCode, expectedStatus] of [['invalid_payment', 402], ['payment_expired', 402], ['payment_replayed', 402], ['payment_verification_unavailable', 503], ['payment_configuration_error', 503]] as const) {
    const { dependencies, calls } = fixture({ verify: async () => ({ valid: false, payer, amount: '0', errorCode }) });
    const response = await handleGatewayRequest('POST', '/v1/weather', paidHeaders, { latitude: 0, longitude: 0 }, origin, dependencies);
    assert.equal(response.status, expectedStatus);
    assert.deepEqual(calls, []);
  }
});

test('failed or pending settlement cannot expose data or create a transaction hash', async () => {
  for (const pending of [false, true]) {
    const { dependencies } = fixture({ settle: async () => ({ valid: false, payer, amount: '50000', errorCode: pending ? 'settlement_pending' : 'settlement_failed', ...(pending ? { txHash: transaction } : {}) }) });
    const response = await handleGatewayRequest('POST', '/v1/weather', paidHeaders, { latitude: 0, longitude: 0 }, origin, dependencies);
    assert.equal(response.status, pending ? 503 : 402);
    assert.equal(response.body.data, undefined);
    assert.equal(response.body.transaction, pending ? transaction : '');
    const receipt = decode(response.headers['PAYMENT-RESPONSE']);
    assert.equal(receipt.success, false);
    assert.equal(receipt.transaction, pending ? transaction : '');
  }
});

test('a pending verification retry preserves the known transaction without dispatching again', async () => {
  const { dependencies, calls } = fixture({ verify: async () => ({ valid: false, payer, amount: '50000', errorCode: 'settlement_pending', txHash: transaction }) });
  const response = await handleGatewayRequest('POST', '/v1/weather', paidHeaders, { latitude: 0, longitude: 0 }, origin, dependencies);
  assert.equal(response.status, 503);
  assert.equal(response.body.transaction, transaction);
  assert.equal(decode(response.headers['PAYMENT-RESPONSE']).transaction, transaction);
  assert.equal(response.body.data, undefined);
  assert.deepEqual(calls, []);
});

test('incomplete or mismatched successful settlement is still rejected', async () => {
  for (const mismatch of [{ txHash: undefined }, { settledAt: undefined }, { amount: '120000' }, { payer: '0x2222222222222222222222222222222222222222' }, { network: 'eip155:84532' }]) {
    const { dependencies } = fixture({ settle: async () => ({ valid: true, payer, amount: '50000', txHash: transaction, settledAt: new Date().toISOString(), ...mismatch } as any) });
    const response = await handleGatewayRequest('POST', '/v1/weather', paidHeaders, { latitude: 0, longitude: 0 }, origin, dependencies);
    assert.notEqual(response.status, 200);
    assert.equal(response.body.data, undefined);
  }
});

test('legacy, duplicate and malformed payment headers are rejected', async () => {
  for (const headers of [
    { ...jsonHeaders, authorization: 'Bearer anything' },
    { ...jsonHeaders, 'x-payment-proof': '{}' },
    { ...jsonHeaders, 'payment-signature': '{' },
    { ...jsonHeaders, 'payment-signature': ['a', 'b'] },
    { ...jsonHeaders, 'payment-signature': proofHeader, 'PAYMENT-SIGNATURE': proofHeader }
  ]) {
    const { dependencies, calls } = fixture();
    assert.equal((await handleGatewayRequest('POST', '/v1/weather', headers, { latitude: 0, longitude: 0 }, origin, dependencies)).status, 400);
    assert.deepEqual(calls, []);
  }
});

test('health and discovery aliases have method checks and honest status codes', async () => {
  const { dependencies } = fixture({ dispatch: async () => ({ status: 'degraded', providers: { fx: { status: 'degraded' } } }) });
  for (const path of ['/health', '/api/health', '/v1/health', '/api/v1/health', '/.well-known/health']) {
    assert.equal((await handleGatewayRequest('GET', path, {}, undefined, origin, dependencies)).status, 503);
    assert.equal((await handleGatewayRequest('POST', path, jsonHeaders, {}, origin, dependencies)).status, 405);
  }
  for (const path of ['/.well-known/x402', '/.well-known/x402.json', '/api/well-known/x402']) {
    assert.equal((await handleGatewayRequest('GET', path, {}, undefined, origin, dependencies)).body.resources.length, 12);
    assert.equal((await handleGatewayRequest('HEAD', path, {}, undefined, origin, dependencies)).body, null);
  }
  assert.equal((await handleGatewayRequest('GET', '/v1/unknown', {}, undefined, origin, dependencies)).status, 404);
});

test('request schemas are reusable and normalize without inventing required input', () => {
  const price = RELAY_RESOURCES.find(resource => resource.id === 'crypto_price')!;
  assert.equal(getRequestSchema(price).properties.assets.items?.type, 'string');
  assert.deepEqual(validateResourceParams(price, { assets: [' BITCOIN '], vsCurrency: 'EUR' }), { assets: ['bitcoin'], vsCurrency: 'eur' });
  assert.throws(() => validateResourceParams(price, { coins: 'bitcoin' }), /Unknown/);
  assert.throws(() => validateResourceParams(price, { assets: ['bitcoin', 'BITCOIN'] }), /duplicate/);
});

test('both Vercel entrypoints preserve canonical preflight headers', async () => {
  for (const [entry, url] of [[handler, '/v1/weather'], [discoveryHandler, '/.well-known/x402']] as const) {
    const response: any = { headers: {}, setHeader(key: string, value: string) { this.headers[key] = value; }, status(value: number) { this.statusCode = value; return this; }, end() {}, json(value: unknown) { this.body = value; } };
    await entry({ method: 'OPTIONS', url, headers: { host: 'gateway.example' } }, response);
    assert.equal(response.statusCode, 204);
    assert.match(response.headers['Access-Control-Allow-Headers'], /PAYMENT-SIGNATURE/);
  }
});

test('development and preview share middleware and reject oversized streamed bodies', () => {
  const plugin = relayGatewayPlugin();
  assert.equal(plugin.configureServer, plugin.configurePreviewServer);
  let middleware: any;
  (plugin.configureServer as any)({ middlewares: { use(callback: any) { middleware = callback; } } });
  const req = Object.assign(new EventEmitter(), { url: '/v1/weather', method: 'POST', headers: jsonHeaders, resume() {} });
  const res: any = { writableEnded: false, destroyed: false, writeHead(status: number, headers: unknown) { this.status = status; this.headers = headers; }, end(body: unknown) { this.body = body; this.writableEnded = true; } };
  middleware(req, res, () => assert.fail('API middleware must intercept this route'));
  req.emit('data', Buffer.alloc(MAX_REQUEST_BYTES + 1));
  req.emit('end');
  assert.equal(res.status, 413);
});
