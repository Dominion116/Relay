import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { createRequire, syncBuiltinESMExports } from 'node:module';
import {
  decodeFunctionData, encodeAbiParameters, encodeEventTopics, encodeFunctionResult,
  keccak256, parseAbi, parseTransaction, toHex, type Hex
} from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { eip3009ABI, resetAssetContractCache } from '@x402/evm';
import { ExactEvmScheme as ExactEvmClient } from '@x402/evm/exact/client';
import { PaymentRequiredV2Schema } from '@x402/core/schemas';
import type { X402PaymentProof, X402Resource } from '../src/types/x402';

// All application imports happen after environment isolation and socket blocking.
const require = createRequire(import.meta.url);
let socketAttempts = 0;
const denyNetwork = () => { socketAttempts++; throw new Error('Network is disabled in payment tests'); };
require('node:net').Socket.prototype.connect = denyNetwork;
require('node:tls').connect = denyNetwork;
for (const name of ['node:http', 'node:https']) {
  require(name).request = denyNetwork;
  require(name).get = denyNetwork;
}
syncBuiltinESMExports();
process.env.NODE_ENV = 'test';
for (const name of ['RELAY_FACILITATOR_KEY', 'FACILITATOR_URL', 'AGENT_PRIVATE_KEY', 'BASE_PRIVATE_KEY', 'RELAY_TREASURY_ADDRESS']) delete process.env[name];
process.env.RELAY_NETWORK = 'base';
process.env.GATEWAY_ORIGIN = 'https://relay-payment-test.invalid';
process.env.BASE_RPC_URL = 'https://rpc-payment-test.invalid';
process.env.RELAY_SETTLEMENT_TIMEOUT_MS = '150';

const payerKey = generatePrivateKey();
const facilitatorKey = generatePrivateKey();
const payer = privateKeyToAccount(payerKey);
const facilitator = privateKeyToAccount(facilitatorKey);
const blockHash = `0x${'ba'.repeat(32)}` as Hex;
const transferEvents = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce)'
]);
type Mode = 'success' | 'pending' | 'reverted' | 'bad-transfer' | 'bad-nonce-event' | 'unused-after-receipt' |
  'wrong-receipt-hash' | 'no-logs' | 'lost-ack' | 'bad-broadcast-hash' | 'simulation-error' | 'same-slot-race';
let mode: Mode = 'success';
let chainId = 8453;
let rpcFailure = false;
let sent: Array<{ hash: Hex; chainId: number; data: Hex; to: string; nonce: number; auth: any }> = [];
let calls: string[] = [];
let consumed = new Set<string>();
let receipts = new Map<string, any>();
let raceRelease: (() => void) | undefined;
let raceBarrier: Promise<void> | undefined;
const nonceKey = (from: string, nonce: string) => `${from}:${nonce}`.toLowerCase();
const rpcError = (id: number, message = 'execution reverted: invalid signature') => ({ jsonrpc: '2.0', id, error: { code: 3, message } });

function receiptFor(transaction: (typeof sent)[number], status: '0x0' | '0x1' = '0x1') {
  const auth = transaction.auth;
  const baseLog = { address: transaction.to, blockHash, blockNumber: '0x64', transactionHash: transaction.hash,
    transactionIndex: '0x0', removed: false };
  const transfer = {
    ...baseLog, logIndex: '0x0',
    topics: encodeEventTopics({ abi: transferEvents, eventName: 'Transfer', args: { from: auth.from, to: auth.to } }),
    data: encodeAbiParameters([{ type: 'uint256' }], [mode === 'bad-transfer' ? 1n : auth.value])
  };
  const authorization = {
    ...baseLog, logIndex: '0x1', data: '0x',
    topics: encodeEventTopics({ abi: transferEvents, eventName: 'AuthorizationUsed',
      args: { authorizer: auth.from, nonce: mode === 'bad-nonce-event' ? `0x${'00'.repeat(32)}` : auth.nonce } })
  };
  return {
    transactionHash: mode === 'wrong-receipt-hash' ? blockHash : transaction.hash,
    transactionIndex: '0x0', blockHash, blockNumber: '0x64', from: facilitator.address,
    to: transaction.to, cumulativeGasUsed: '0x186a0', gasUsed: '0x186a0', contractAddress: null,
    logs: mode === 'no-logs' ? [] : status === '0x1' ? [transfer, authorization] : [],
    logsBloom: `0x${'00'.repeat(256)}`, status, effectiveGasPrice: '0x1', type: '0x2'
  };
}

globalThis.fetch = async (input: any, init?: any) => {
  const request = input instanceof Request ? input : new Request(input, init);
  assert.equal(new URL(request.url).hostname, 'rpc-payment-test.invalid', 'Unexpected external/provider URL');
  if (rpcFailure) throw new Error('Synthetic private RPC error: do-not-expose-credentials');
  const body = await request.json();
  const respond = async (call: any) => {
    calls.push(call.method);
    let result: any;
    switch (call.method) {
      case 'eth_chainId': result = toHex(chainId); break;
      case 'eth_getCode': result = [resources.BASE_USDC_MAINNET, resources.BASE_USDC_SEPOLIA]
        .some(asset => asset.toLowerCase() === call.params[0].toLowerCase()) ? '0x60006000' : '0x'; break;
      case 'eth_call': {
        const decoded = decodeFunctionData({ abi: eip3009ABI, data: call.params[0].data });
        const args = decoded.args as readonly any[];
        if (decoded.functionName === 'authorizationState') {
          const used = consumed.has(nonceKey(args[0], args[1])) && !(mode === 'unused-after-receipt' && call.params[1] !== 'latest');
          result = encodeFunctionResult({ abi: eip3009ABI, functionName: 'authorizationState', result: used });
        } else if (decoded.functionName === 'transferWithAuthorization') {
          if (consumed.has(nonceKey(args[0], args[5]))) return rpcError(call.id, 'execution reverted: authorization is used');
          if (mode === 'simulation-error') return rpcError(call.id);
          result = '0x';
        } else {
          throw new Error(`Unexpected read-only contract call: ${decoded.functionName}`);
        }
        break;
      }
      case 'eth_getTransactionCount': result = mode === 'same-slot-race' ? '0x0' : toHex(sent.length); break;
      case 'eth_maxPriorityFeePerGas':
      case 'eth_gasPrice': result = '0x1'; break;
      case 'eth_estimateGas': result = '0x186a0'; break;
      case 'eth_getBlockByNumber': result = { number: '0x65', hash: blockHash, parentHash: blockHash, timestamp: toHex(Math.floor(Date.now() / 1000)),
        baseFeePerGas: '0x1', gasLimit: '0x1c9c380', gasUsed: '0x0', transactions: [] }; break;
      case 'eth_blockNumber': result = '0x65'; break;
      case 'eth_sendRawTransaction': {
        const serialized = call.params[0] as Hex;
        const parsed = parseTransaction(serialized);
        const decoded = decodeFunctionData({ abi: eip3009ABI, data: parsed.data! });
        assert.equal(decoded.functionName, 'transferWithAuthorization');
        const args = decoded.args as readonly any[];
        const transaction = { hash: keccak256(serialized), chainId: parsed.chainId!, data: parsed.data!, to: parsed.to!, nonce: parsed.nonce!,
          auth: { from: args[0], to: args[1], value: args[2], validAfter: args[3], validBefore: args[4], nonce: args[5] } };
        sent.push(transaction);
        if (mode === 'same-slot-race') {
          if (sent.length === 2) raceRelease!();
          await raceBarrier;
          if (transaction.hash !== sent[0].hash) return rpcError(call.id, 'replacement transaction underpriced');
        }
        if (mode !== 'pending') {
          const status = mode === 'reverted' ? '0x0' : '0x1';
          receipts.set(transaction.hash, receiptFor(transaction, status));
          if (status === '0x1') consumed.add(nonceKey(args[0], args[5]));
        }
        if (mode === 'lost-ack') throw new Error('Synthetic disconnect after submission');
        result = mode === 'bad-broadcast-hash' ? blockHash : transaction.hash;
        break;
      }
      case 'eth_getTransactionReceipt': result = receipts.get(call.params[0]) ?? null; break;
      default: throw new Error(`Unexpected RPC method: ${call.method}`);
    }
    return { jsonrpc: '2.0', id: call.id, result };
  };
  return Response.json(Array.isArray(body) ? await Promise.all(body.map(respond)) : await respond(body));
};

const engine = await import('../src/server/x402Engine');
const wallet = await import('../src/server/agentWallet');
const resources = await import('../src/shared/resources');
const resource = { ...engine.RELAY_RESOURCES.find(r => r.id === 'crypto_price')!, url: 'https://relay-payment-test.invalid/v1/crypto/price' };
const policy = { gatewayUrl: 'https://relay-payment-test.invalid', endpoint: resource.path, network: 'base' as const };

async function proofFor(selected: X402Resource = resource, changes: Record<string, unknown> = {}): Promise<X402PaymentProof> {
  const challenge = engine.generate402Challenge(selected);
  const account = payer;
  const auth = { from: account.address, to: selected.payTo, value: selected.amount,
    validAfter: String(Math.floor(Date.now() / 1000) - 5), validBefore: String(Math.floor(Date.now() / 1000) + 120),
    nonce: keccak256(generatePrivateKey()), ...changes } as X402PaymentProof['payload']['authorization'];
  const signature = await account.signTypedData({
    domain: { ...challenge.accepts[0].extra, chainId: selected.chainId, verifyingContract: selected.asset as Hex },
    types: resources.EIP712_TRANSFER_TYPES, primaryType: 'TransferWithAuthorization',
    message: { from: auth.from as Hex, to: auth.to as Hex, value: BigInt(auth.value),
      validAfter: BigInt(auth.validAfter), validBefore: BigInt(auth.validBefore), nonce: auth.nonce as Hex }
  });
  return { x402Version: 2, resource: challenge.resource, accepted: challenge.accepts[0], payload: { signature, authorization: auth } };
}

beforeEach(() => {
  mode = 'success'; chainId = 8453; rpcFailure = false; sent = []; calls = []; consumed = new Set(); receipts = new Map();
  resetAssetContractCache();
  delete process.env.FACILITATOR_URL;
  process.env.RELAY_FACILITATOR_KEY = facilitatorKey;
  process.env.BASE_RPC_URL = 'https://rpc-payment-test.invalid';
  process.env.RELAY_SETTLEMENT_TIMEOUT_MS = '150';
  delete process.env.AGENT_PRIVATE_KEY;
});
after(() => { assert.equal(socketAttempts, 0, 'Tests must not attempt any external connection'); });

test('canonical challenge and manifest preserve all twelve prices and correct domains', () => {
  const challenge = engine.generate402Challenge(resource);
  assert.equal(PaymentRequiredV2Schema.safeParse(challenge).success, true);
  assert.equal('paymentRequirements' in challenge, false);
  assert.equal(challenge.accepts[0].scheme, 'exact');
  assert.equal(challenge.accepts[0].extra.name, 'USD Coin');
  const sepolia = engine.generate402Challenge(resource, 'base-sepolia');
  assert.equal(sepolia.accepts[0].network, 'eip155:84532');
  assert.equal(sepolia.accepts[0].asset, resources.BASE_USDC_SEPOLIA);
  assert.equal(sepolia.accepts[0].extra.name, 'USDC');
  assert.deepEqual(engine.RELAY_RESOURCES.map(r => r.amount), ['80000', '60000', '40000', '60000', '40000', '50000', '40000', '40000', '60000', '80000', '100000', '120000']);
  assert.equal(engine.getWellKnownManifest().resources.length, 12);
  assert.equal(calls.length, 0);
});

test('unsigned, signature-only, txHash-only, invalid-address and noncanonical envelopes fail before RPC', async () => {
  const valid = await proofFor();
  for (const proof of [null, {}, { payerAddress: 'not-an-address' }, { clientSignature: 'invalid', payerAddress: payer.address },
    { txHash: blockHash, payerAddress: payer.address }, valid.payload.signature, { ...valid, txHash: blockHash },
    { ...valid, timestamp: Date.now() + 86400000 }, { ...valid, x402Version: 1 },
    { ...valid, payload: { ...valid.payload, authorization: { ...valid.payload.authorization, value: 'not-a-number' } } }]) {
    assert.equal((await engine.verifyPaymentProof(proof, resource)).valid, false);
    assert.equal((await engine.settlePaymentProof(proof, resource)).valid, false);
  }
  assert.equal(calls.length, 0);
});

test('missing facilitator fails closed and AGENT_PRIVATE_KEY is never a facilitator fallback', async () => {
  delete process.env.RELAY_FACILITATOR_KEY;
  process.env.AGENT_PRIVATE_KEY = facilitatorKey;
  const proof = await proofFor();
  assert.equal((await engine.verifyPaymentProof(proof, resource)).errorCode, 'payment_configuration_error');
  const result = await engine.settlePaymentProof(proof, resource);
  assert.equal(result.valid, false);
  assert.equal(result.txHash, undefined);
  assert.equal(calls.length, 0);
});

test('read-only verification supports standard ExactEvmScheme client proofs without submitting', async () => {
  const challenge = engine.generate402Challenge(resource);
  const signed = await new ExactEvmClient(payer).createPaymentPayload(2, challenge.accepts[0]);
  const proof = { ...signed, accepted: challenge.accepts[0], resource: challenge.resource };
  const result = await engine.verifyPaymentProof(proof, resource);
  assert.equal(result.valid, true);
  assert.equal(sent.length, 0);
  assert.ok(calls.includes('eth_call'));
  assert.equal('settledAt' in result, false);
});

test('expired and future authorizations reject even after unsigned timestamp manipulation', async () => {
  const now = Math.floor(Date.now() / 1000);
  for (const [changes, errorCode] of [
    [{ validBefore: String(now - 60) }, 'payment_expired'],
    [{ validAfter: String(now + 60) }, 'payment_not_yet_valid'],
    [{ validBefore: String(now + 3600) }, 'invalid_payment']
  ] as const) {
    const proof = await proofFor(resource, changes);
    assert.equal((await engine.verifyPaymentProof(proof, resource)).errorCode, errorCode);
    assert.equal((await engine.verifyPaymentProof({ ...proof, timestamp: Date.now() + 86400000 }, resource)).valid, false);
  }
  assert.equal(sent.length, 0);
});

test('exact requirements reject over/underpayment, alternate asset, merchant, network and request URL', async () => {
  for (const value of ['1', '120000']) assert.equal((await engine.verifyPaymentProof(await proofFor(resource, { value }), resource)).valid, false);
  const proof = await proofFor();
  for (const field of [
    { amount: '120000' }, { asset: '0x1111111111111111111111111111111111111111' },
    { payTo: '0x2222222222222222222222222222222222222222' }, { network: 'eip155:84532' },
    { extra: { name: 'USDC', version: '2' } }
  ]) assert.equal((await engine.verifyPaymentProof({ ...proof, accepted: { ...proof.accepted, ...field } }, resource)).valid, false);
  for (const url of ['https://another-origin.invalid/v1/crypto/price', 'https://relay-payment-test.invalid/v1/fx/rates']) {
    assert.equal((await engine.verifyPaymentProof({ ...proof, resource: { ...proof.resource, url } }, resource)).valid, false);
  }
  assert.equal(calls.length, 0);
});

test('a cryptographically wrong signature or payer cannot pass verification', async () => {
  const proof = await proofFor();
  const wrongPayer = privateKeyToAccount(generatePrivateKey()).address;
  const result = await engine.verifyPaymentProof({ ...proof, payload: { ...proof.payload,
    authorization: { ...proof.payload.authorization, from: wrongPayer } } }, resource);
  assert.equal(result.valid, false);
  assert.equal(sent.length, 0);
});

test('signatures for another token or chain fail even when accepted metadata is rewritten', async () => {
  for (const wrongResource of [
    { ...resource, network: 'base-sepolia' as const, chainId: 84532, asset: resources.BASE_USDC_SEPOLIA },
    { ...resource, payTo: '0x2222222222222222222222222222222222222222' }
  ]) {
    const signed = await proofFor(wrongResource);
    const proof = { ...signed, accepted: engine.generate402Challenge(resource).accepts[0] };
    assert.equal((await engine.verifyPaymentProof(proof, resource)).valid, false);
  }
  assert.equal(sent.length, 0);
});

test('RPC failure and wrong RPC chain fail closed with sanitized errors', async () => {
  const proof = await proofFor();
  rpcFailure = true;
  const result = await engine.verifyPaymentProof(proof, resource);
  assert.equal(result.errorCode, 'payment_verification_unavailable');
  assert.equal(JSON.stringify(result).includes('do-not-expose'), false);
  rpcFailure = false; chainId = 1;
  assert.equal((await engine.verifyPaymentProof(proof, resource)).errorCode, 'payment_configuration_error');
  assert.equal(sent.length, 0);
});

test('simulation rejection never becomes a fabricated successful receipt', async () => {
  mode = 'simulation-error';
  const result = await engine.settlePaymentProof(await proofFor(), resource);
  assert.equal(result.valid, false);
  assert.equal(result.txHash, undefined);
  assert.equal(sent.length, 0);
});

test('confirmed settlement requires the exact transaction, transfer, and consumed authorization', async () => {
  const result = await engine.settlePaymentProof(await proofFor(), resource);
  assert.equal(result.valid, true, JSON.stringify(result));
  assert.equal(result.txHash, sent[0].hash);
  assert.equal(result.amount, '40000');
  assert.equal(result.network, 'eip155:8453');
  assert.ok(result.settledAt);
  assert.ok(calls.includes('eth_getTransactionReceipt'));
  assert.equal(sent[0].auth.value, 40000n);
  assert.equal(sent[0].chainId, 8453);
});

test('consumed authorization is rejected durably on subsequent verification and settlement', async () => {
  const proof = await proofFor();
  assert.equal((await engine.settlePaymentProof(proof, resource)).valid, true);
  assert.equal((await engine.verifyPaymentProof(proof, resource)).errorCode, 'payment_replayed');
  assert.equal((await engine.settlePaymentProof(proof, resource)).errorCode, 'payment_replayed');
  assert.equal(sent.length, 1);
});

test('eight concurrent replays release only one successful settlement', async () => {
  const proof = await proofFor();
  const results = await Promise.all(Array.from({ length: 8 }, () => engine.settlePaymentProof(proof, resource)));
  assert.equal(results.filter(result => result.valid).length, 1);
  assert.equal(sent.length, 1);
  assert.equal(results.filter(result => result.errorCode === 'settlement_in_progress').length, 7);
});

test('independent concurrent payments serialize facilitator transaction nonce allocation', async () => {
  const proofs = await Promise.all([proofFor(), proofFor()]);
  const results = await Promise.all(proofs.map(proof => engine.settlePaymentProof(proof, resource)));
  assert.equal(results.filter(result => result.valid).length, 2);
  assert.deepEqual(sent.map(transaction => transaction.nonce), [0, 1]);
});

test('pending transaction retains only its real hash and is not resubmitted or promoted to success', async () => {
  mode = 'pending';
  const proof = await proofFor();
  const result = await engine.settlePaymentProof(proof, resource);
  assert.equal(result.errorCode, 'settlement_pending');
  assert.equal(result.valid, false);
  assert.equal(result.txHash, sent[0].hash);
  assert.equal(result.settledAt, undefined);
  assert.equal((await engine.settlePaymentProof(proof, resource)).errorCode, 'settlement_pending');
  const repeatedVerification = await engine.verifyPaymentProof(proof, resource);
  assert.equal(repeatedVerification.valid, false);
  assert.equal(repeatedVerification.txHash, result.txHash);
  assert.equal(sent.length, 1);
});

test('lost acknowledgement and incorrect RPC submission hash remain ambiguous, not settled', async () => {
  for (const scenario of ['lost-ack', 'bad-broadcast-hash'] as const) {
    mode = scenario;
    const result = await engine.settlePaymentProof(await proofFor(), resource);
    assert.equal(result.valid, false);
    assert.equal(result.errorCode, 'settlement_pending');
    assert.equal(result.txHash, sent[sent.length - 1].hash);
  }
});

test('reverted, unrelated, incomplete or replacement receipts never release paid data', async () => {
  for (const scenario of ['reverted', 'bad-transfer', 'bad-nonce-event', 'unused-after-receipt', 'wrong-receipt-hash', 'no-logs'] as const) {
    mode = scenario;
    const result = await engine.settlePaymentProof(await proofFor(), resource);
    assert.equal(result.valid, false, scenario);
    assert.equal(result.settledAt, undefined, scenario);
    assert.equal(result.txHash, sent[sent.length - 1].hash, scenario);
  }
});

test('Sepolia uses its correct token domain and transaction chain, never mainnet', async () => {
  chainId = 84532;
  const sepolia = { ...resource, network: 'base-sepolia' as const, chainId, asset: resources.BASE_USDC_SEPOLIA };
  const result = await engine.settlePaymentProof(await proofFor(sepolia), sepolia);
  assert.equal(result.valid, true, JSON.stringify(result));
  assert.equal(result.network, 'eip155:84532');
  assert.equal(sent[0].chainId, 84532);
  assert.equal(sent[0].to.toLowerCase(), resources.BASE_USDC_SEPOLIA.toLowerCase());
});

test('two independent instances cannot claim the same facilitator nonce transaction as two successes', async () => {
  const replica = await import(new URL('../src/server/x402Engine.ts?payment-test-replica', import.meta.url).href);
  mode = 'same-slot-race';
  raceBarrier = new Promise<void>(resolve => { raceRelease = resolve; });
  const proof = await proofFor();
  const results = await Promise.all([engine.settlePaymentProof(proof, resource), replica.settlePaymentProof(proof, resource)]);
  assert.equal(sent.length, 2);
  assert.equal(sent[0].nonce, sent[1].nonce);
  assert.notEqual(sent[0].data, sent[1].data);
  assert.notEqual(sent[0].hash, sent[1].hash);
  assert.equal(results.filter(result => result.valid).length, 1);
});

test('server network and merchant configuration do not mutate the browser catalog', async () => {
  process.env.RELAY_NETWORK = 'base-sepolia';
  process.env.RELAY_TREASURY_ADDRESS = '0x2222222222222222222222222222222222222222';
  try {
    const configured = await import(new URL('../src/server/x402Engine.ts?payment-test-config', import.meta.url).href);
    assert.equal(configured.RELAY_RESOURCES[0].chainId, 84532);
    assert.equal(configured.RELAY_RESOURCES[0].payTo, process.env.RELAY_TREASURY_ADDRESS);
    assert.equal(resources.RELAY_RESOURCES[0].chainId, 8453);
    assert.equal(resources.RELAY_RESOURCES[0].payTo, resources.DEFAULT_TREASURY_ADDRESS);
  } finally {
    process.env.RELAY_NETWORK = 'base';
    delete process.env.RELAY_TREASURY_ADDRESS;
  }
});

test('wallet signers validate challenge policy and never read, replace or delete legacy stored keys', async () => {
  const legacy = new Map([['relay_agent_session_key', generatePrivateKey()]]);
  const before = legacy.get('relay_agent_session_key');
  (globalThis as any).window = {};
  (globalThis as any).localStorage = {
    getItem: denyNetwork, setItem: denyNetwork, removeItem: denyNetwork
  };
  try {
    const session = wallet.createAgentWallet();
    assert.equal(session.isEphemeral, true);
    assert.equal(legacy.get('relay_agent_session_key'), before);
    assert.equal('resetAgentWallet' in wallet, false);
    assert.equal('getOrCreateAgentWallet' in wallet, false);
    const challenge = engine.generate402Challenge(resource);
    const proof = await wallet.signChallengeWithAgentKey(payerKey, challenge, policy);
    assert.equal(proof.x402Version, 2);
    assert.equal((await engine.verifyPaymentProof(proof, resource)).valid, true);
    for (const changes of [{ asset: '0x1111111111111111111111111111111111111111' },
      { payTo: '0x2222222222222222222222222222222222222222' }, { amount: '1000000000000000000000000' }, { network: 'eip155:1' }]) {
      await assert.rejects(wallet.signChallengeWithAgentKey(payerKey, { ...challenge, accepts: [{ ...challenge.accepts[0], ...changes }] }, policy));
    }
  } finally {
    delete (globalThis as any).window;
    delete (globalThis as any).localStorage;
  }
  assert.equal(sent.length, 0);
});
