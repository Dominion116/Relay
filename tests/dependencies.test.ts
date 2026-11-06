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
