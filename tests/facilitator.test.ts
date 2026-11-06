import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { keccak256, type Hex } from 'viem';
import * as engine from '../src/server/x402Engine';
import * as resources from '../src/shared/resources';
import type { X402PaymentProof, X402Resource } from '../src/types/x402';

const payerKey = generatePrivateKey();
const payer = privateKeyToAccount(payerKey);
const resource: X402Resource = {
  ...engine.RELAY_RESOURCES.find(r => r.id === 'crypto_price')!,
  url: 'https://relayx402.vercel.app/v1/crypto/price'
};

async function proofFor(selected: X402Resource = resource): Promise<X402PaymentProof> {
  const challenge = engine.generate402Challenge(selected);
  const now = Math.floor(Date.now() / 1000);
  const auth = {
    from: payer.address,
    to: selected.payTo,
    value: selected.amount,
    validAfter: String(now - 5),
    validBefore: String(now + 120),
    nonce: keccak256(generatePrivateKey())
  };
  const signature = await payer.signTypedData({
    domain: { ...challenge.accepts[0].extra, chainId: selected.chainId, verifyingContract: selected.asset as Hex },
    types: resources.EIP712_TRANSFER_TYPES,
    primaryType: 'TransferWithAuthorization',
    message: {
      from: auth.from as Hex,
      to: auth.to as Hex,
      value: BigInt(auth.value),
      validAfter: BigInt(auth.validAfter),
      validBefore: BigInt(auth.validBefore),
      nonce: auth.nonce as Hex
    }
  });
  return {
    x402Version: 2,
    resource: challenge.resource,
    accepted: challenge.accepts[0],
    payload: { signature, authorization: auth }
  };
}

beforeEach(() => {
  delete process.env.FACILITATOR_URL;
  delete process.env.RELAY_FACILITATOR_KEY;
  process.env.NODE_ENV = 'test';
});

test('getFacilitatorTarget resolves Primer Systems by default in production and respects overrides', () => {
  process.env.NODE_ENV = 'production';
  delete process.env.FACILITATOR_URL;
  delete process.env.RELAY_FACILITATOR_KEY;
  assert.deepEqual(engine.getFacilitatorTarget(), {
    type: 'http',
    url: engine.PRIMER_FACILITATOR_URL
  });

  process.env.FACILITATOR_URL = 'https://custom-facilitator.example.com';
  assert.deepEqual(engine.getFacilitatorTarget(), {
    type: 'http',
    url: 'https://custom-facilitator.example.com'
  });

  delete process.env.FACILITATOR_URL;
  const dummyKey = generatePrivateKey();
  process.env.RELAY_FACILITATOR_KEY = dummyKey;
  assert.deepEqual(engine.getFacilitatorTarget(), {
    type: 'local',
    key: dummyKey
  });

  process.env.FACILITATOR_URL = 'self-hosted';
  assert.deepEqual(engine.getFacilitatorTarget(), {
    type: 'local',
    key: dummyKey
  });

  process.env.NODE_ENV = 'test';
  delete process.env.FACILITATOR_URL;
  delete process.env.RELAY_FACILITATOR_KEY;
  assert.throws(() => engine.getFacilitatorTarget(), /Payment settlement is not configured correctly/);
});

test('manifest reports Primer Systems facilitator when configured for HTTP', () => {
  process.env.FACILITATOR_URL = engine.PRIMER_FACILITATOR_URL;
  const manifest = engine.getWellKnownManifest();
  assert.ok(manifest.facilitator.includes('Primer Systems public x402 facilitator'));
  assert.ok(manifest.facilitator.includes('https://x402.primer.systems'));

  process.env.RELAY_FACILITATOR_KEY = generatePrivateKey();
  delete process.env.FACILITATOR_URL;
  const localManifest = engine.getWellKnownManifest();
  assert.equal(localManifest.facilitator, 'Relay self-hosted @x402/evm facilitator');
});

test('HTTP facilitator verify handles success, invalid reason, and network error', async () => {
  process.env.FACILITATOR_URL = 'https://mock-facilitator.test';
  const proof = await proofFor();

  // Test success
  globalThis.fetch = async (input: any) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.endsWith('/verify')) {
      return Response.json({ isValid: true });
    }
    throw new Error('Unexpected URL');
  };
  const verified = await engine.verifyPaymentProof(proof, resource);
  assert.equal(verified.valid, true);
  assert.equal(verified.payer, payer.address);
  assert.equal(verified.amount, resource.amount);

  // Test replayed nonce
  globalThis.fetch = async () => Response.json({
    isValid: false,
    invalidReason: 'invalid_exact_evm_nonce_already_used'
  });
  const replayed = await engine.verifyPaymentProof(proof, resource);
  assert.equal(replayed.valid, false);
  assert.equal(replayed.errorCode, 'payment_replayed');

  // Test expired
  globalThis.fetch = async () => Response.json({
    isValid: false,
    invalidReason: 'invalid_exact_evm_payload_authorization_valid_before'
  });
  const expired = await engine.verifyPaymentProof(proof, resource);
  assert.equal(expired.valid, false);
  assert.equal(expired.errorCode, 'payment_expired');

  // Test network error
  globalThis.fetch = async () => { throw new Error('Network failure'); };
  const unavailable = await engine.verifyPaymentProof(proof, resource);
  assert.equal(unavailable.valid, false);
  assert.equal(unavailable.errorCode, 'payment_verification_unavailable');
});

test('HTTP facilitator settle handles success, replayed nonce, and settlement pending', async () => {
  process.env.FACILITATOR_URL = 'https://mock-facilitator.test';
  const proof = await proofFor();
  const txHash = `0x${'aa'.repeat(32)}` as Hex;

  // Test successful settlement
  globalThis.fetch = async (input: any) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.endsWith('/verify')) return Response.json({ isValid: true });
    if (url.endsWith('/settle')) {
      return Response.json({
        success: true,
        transaction: txHash,
        network: 'eip155:8453'
      });
    }
    throw new Error('Unexpected URL');
  };
  const settled = await engine.settlePaymentProof(proof, resource);
  assert.equal(settled.valid, true);
  assert.equal(settled.txHash, txHash);
  assert.equal(settled.network, 'eip155:8453');
  assert.ok(settled.settledAt);

  // Test replayed settle
  globalThis.fetch = async (input: any) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.endsWith('/verify')) return Response.json({ isValid: true });
    if (url.endsWith('/settle')) {
      return new Response(JSON.stringify({
        success: false,
        errorReason: 'invalid_exact_evm_nonce_already_used',
        transaction: '',
        network: 'eip155:8453'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    throw new Error('Unexpected URL');
  };
  const replayedSettle = await engine.settlePaymentProof(await proofFor(), resource);
  assert.equal(replayedSettle.valid, false);
  assert.equal(replayedSettle.errorCode, 'payment_replayed');

  // Test network failure during settle -> fails closed as settlement_pending
  globalThis.fetch = async (input: any) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.endsWith('/verify')) return Response.json({ isValid: true });
    if (url.endsWith('/settle')) throw new Error('Timeout / connection dropped');
    throw new Error('Unexpected URL');
  };
  const pendingSettle = await engine.settlePaymentProof(await proofFor(), resource);
  assert.equal(pendingSettle.valid, false);
  assert.equal(pendingSettle.errorCode, 'settlement_pending');
});
