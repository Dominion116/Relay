import assert from 'node:assert/strict';
import { test } from 'node:test';
import gateway from '../../api/v1.js';
import discovery from '../../api/well-known/x402.js';

const cases = [
  ['/v1/academic/search', { query: 'cryptography', limit: 1 }],
  ['/v1/academic/work', { doi: '10.1038/s41586-020-2649-2' }],
  ['/v1/crypto/price', { assets: ['bitcoin'], vsCurrency: 'eur' }],
  ['/v1/crypto/market', { assets: ['bitcoin'] }],
  ['/v1/fx/rates', { baseCurrency: 'USD', targets: ['EUR'] }],
  ['/v1/weather', { latitude: 0, longitude: 0 }],
  ['/v1/geocode', { query: 'Berlin' }],
  ['/v1/holidays', { countryCode: 'DE', year: 2026 }],
  ['/v1/knowledge/search', { query: 'Ethereum' }],
  ['/v1/news/search', { query: 'OpenAI' }],
  ['/v1/research', { topic: 'climate change' }],
  ['/v1/verify', { claim: 'Earth is flat' }]
];

async function invoke(entry, method, url, body, headers = {}) {
  const response = {
    headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    status(value) { this.statusCode = value; return this; },
    end() {},
    json(value) { this.body = value; }
  };
  await entry({ method, url, headers: { host: 'gateway.example', 'content-type': 'application/json', ...headers }, body }, response);
  return response;
}

for (const [path, body] of cases) {
  test(`built handler protects ${path} and its alias without any RPC`, async () => {
    for (const url of [path, `/api${path}`]) {
      const response = await invoke(gateway, 'POST', url, body);
      assert.equal(response.statusCode, 402);
      assert.equal(response.body.x402Version, 2);
      assert.equal(response.body.resource.url, `https://gateway.example${url}`);
      assert.deepEqual(JSON.parse(Buffer.from(response.headers['PAYMENT-REQUIRED'], 'base64').toString('utf8')), response.body);
      const preflight = await invoke(gateway, 'OPTIONS', url);
      assert.equal(preflight.statusCode, 204);
      assert.match(preflight.headers['Access-Control-Allow-Headers'], /PAYMENT-SIGNATURE/);
      assert.equal((await invoke(gateway, 'GET', url)).statusCode, 405);
      const forged = await invoke(gateway, 'POST', url, body, {
        'PAYMENT-SIGNATURE': Buffer.from(JSON.stringify({ payerAddress: 'not-an-address' })).toString('base64')
      });
      assert.equal(forged.statusCode, 402);
      assert.equal(forged.body.data, undefined);
    }
  });
}

test('built discovery entrypoint returns the actual catalog for both public paths', async () => {
  for (const path of ['/.well-known/x402', '/.well-known/x402.json']) {
    const response = await invoke(discovery, 'GET', path);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.resources.length, 12);
  }
});

test('built handler rejects malformed input before accepting a payment', async () => {
  assert.equal((await invoke(gateway, 'POST', '/v1/weather', '{bad json')).statusCode, 400);
  assert.equal((await invoke(gateway, 'POST', '/v1/weather', {})).statusCode, 400);
  assert.equal((await invoke(gateway, 'POST', '/v1/weather', { latitude: 0, longitude: 0 }, { 'x-payment-proof': '{}' })).statusCode, 400);
});
