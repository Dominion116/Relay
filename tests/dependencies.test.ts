import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';

const require = createRequire(import.meta.url);

test('legacy MetaMask consumers resolve patched UUID with compatible named and CommonJS APIs', async () => {
  for (const consumer of ['@metamask/utils', '@metamask/sdk-communication-layer', '@metamask/providers', '@metamask/eth-json-rpc-provider', '@metamask/json-rpc-engine', '@metamask/json-rpc-middleware-stream']) {
    const consumerRequire = createRequire(require.resolve(consumer));
    const uuid = consumerRequire('uuid');
    assert.equal(consumerRequire('uuid/package.json').version, '11.1.1', consumer);
    const value = uuid.v4();
    assert.equal(uuid.validate(value), true);
    assert.equal(uuid.version(value), 4);
    assert.equal(uuid.stringify(uuid.parse(value)), value);
    assert.equal(uuid.v5('relay', uuid.v5.DNS), uuid.v5('relay', uuid.v5.DNS));
    assert.throws(() => uuid.v5('relay', uuid.v5.DNS, new Uint8Array(1)), /buffer|length|bounds/i);
    const esm = await import(pathToFileURL(consumerRequire.resolve('uuid')).href);
    assert.equal(typeof esm.v4, 'function');
    assert.equal(typeof esm.validate, 'function');
  }
});

test('query-string resolves patched decode-uri-component with dual CommonJS and ESM support and quadratic DoS protection', async () => {
  const qs = require('query-string');
  const parsed = qs.parse('?search=Relay%20Protocol&tag=%C2%B5USDC');
  assert.equal(parsed.search, 'Relay Protocol');
  assert.equal(parsed.tag, 'µUSDC');

  const qsRequire = createRequire(require.resolve('query-string'));
  const decode = qsRequire('decode-uri-component');
  assert.equal(typeof decode, 'function');
  assert.equal(decode('Relay%20Protocol'), 'Relay Protocol');
  assert.equal(decode('%FE%FFhello'), '\uFFFD\uFFFDhello');

  // Verify quadratic DoS protection completes in bounded time
  const start = Date.now();
  const res = decode('%25'.repeat(20000));
  assert.ok(Date.now() - start < 1000);
  assert.ok(typeof res === 'string');

  const esm = await import(pathToFileURL(qsRequire.resolve('decode-uri-component')).href);
  assert.equal(typeof esm.default, 'function');
  assert.equal(esm.default('Relay%20Protocol'), 'Relay Protocol');
});

test('zod resolves patched 4.6.7 across wallet consumers', async () => {
  for (const consumer of ['@coinbase/cdp-sdk', '@reown/appkit-wallet']) {
    const consumerRequire = createRequire(require.resolve(consumer));
    const zodPkg = consumerRequire('zod/package.json');
    assert.equal(zodPkg.version, '4.6.7', consumer);
  }
});
