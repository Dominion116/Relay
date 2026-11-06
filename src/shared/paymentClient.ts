import { getAddress, type Address, type Hex } from 'viem';
import type {
  RelayNetwork, X402Authorization, X402Challenge, X402Network,
  X402PaymentProof, X402PaymentRequirements, X402ResourceInfo,
} from '../types/x402';
import {
  BASE_USDC_MAINNET, BASE_USDC_SEPOLIA, DEFAULT_TREASURY_ADDRESS,
  EIP712_TRANSFER_TYPES, PAYMENT_TIMEOUT_SECONDS, RELAY_RESOURCES,
} from './resources';

export { EIP712_TRANSFER_TYPES } from './resources';

const MAX_UINT256 = (1n << 256n) - 1n;
const MAX_HEADER_LENGTH = 16_384;
const knownPrices = new Map(RELAY_RESOURCES.map(resource => [resource.path, resource.amount]));
const validatedSnapshots = new WeakSet<object>();

export interface PaymentPolicy {
  gatewayUrl: string;
  endpoint: string;
  network?: RelayNetwork;
  treasuryAddress?: string;
  /** Exact price in micro-USDC. Defaults to the local catalog unless maxAmount is explicit. */
  expectedAmount?: string;
  /** Explicit price ceiling in micro-USDC, not a grant of daily spending authority. */
  maxAmount?: string;
  maxTimeoutSeconds?: number;
}

export interface ValidatedPaymentChallenge {
  readonly challenge: X402Challenge;
  readonly accepted: X402PaymentRequirements;
  readonly resource: X402ResourceInfo;
  readonly targetUrl: string;
  readonly chainId: 8453 | 84532;
}

export interface SettlementReceipt {
  protocol: 'x402 v2';
  network: X402Network;
  asset: 'USDC';
  cost_usdc: string;
  payer: string;
  tx_hash: string;
  settled_at: string;
}

export interface SettlementExpectation {
  network: X402Network;
  payer: string;
  asset: string;
  amount: string;
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function paymentAddress(value: unknown, label = 'address'): Address {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(value) || /^0x0{40}$/i.test(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return getAddress(value);
}

export function paymentNetwork(network: RelayNetwork = 'base') {
  if (network !== 'base' && network !== 'base-sepolia') throw new Error('Unsupported Base network');
  return network === 'base'
    ? { network: 'eip155:8453' as const, chainId: 8453 as const, asset: BASE_USDC_MAINNET, name: 'USD Coin' as const }
    : { network: 'eip155:84532' as const, chainId: 84532 as const, asset: BASE_USDC_SEPOLIA, name: 'USDC' as const };
}

export function parseAtomicAmount(value: unknown, label = 'amount'): bigint {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,77})$/.test(value)) {
    throw new Error(`Invalid ${label}: expected integer micro-USDC`);
  }
  const amount = BigInt(value);
  if (amount > MAX_UINT256) throw new Error(`Invalid ${label}: amount is too large`);
  return amount;
}

export function parseUsdcAmount(value: string | number, label = 'USDC amount'): bigint {
  if ((typeof value !== 'number' && typeof value !== 'string') ||
      (typeof value === 'number' && (!Number.isFinite(value) || value < 0))) {
    throw new Error(`Invalid ${label}: expected a nonnegative decimal with at most six decimal places`);
  }
  const text = String(value);
  if (!/^(0|[1-9][0-9]{0,71})(\.[0-9]{1,6})?$/.test(text)) {
    throw new Error(`Invalid ${label}: expected a nonnegative decimal with at most six decimal places`);
  }
  const [whole, fraction = ''] = text.split('.');
  return parseAtomicAmount((BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0'))).toString(), label);
}

export function normalizeGatewayUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Invalid gateway URL'); }
  const loopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) ||
      url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Gateway URL must be an HTTPS origin (HTTP is allowed only on loopback)');
  }
  return url.origin;
}

export function resolvePaymentTarget(gatewayUrl: string, endpoint: string) {
  if (typeof endpoint !== 'string') throw new Error('Invalid Relay endpoint');
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const catalogPath = path.startsWith('/api/v1/') ? path.slice(4) : path;
  const amount = knownPrices.get(catalogPath);
  if (!amount) throw new Error('Unsupported Relay endpoint; use an exact catalog path without a query or redirect');
  const origin = normalizeGatewayUrl(gatewayUrl);
  return { path, catalogPath, amount, targetUrl: `${origin}${path}` };
}

export function encodePaymentHeader(value: unknown): string {
  const json = JSON.stringify(value);
  if (typeof json !== 'string') throw new Error('Invalid payment header value');
  const bytes = new TextEncoder().encode(json);
  if (bytes.length > MAX_HEADER_LENGTH) throw new Error('Payment header is too large');
  const encoded = btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''));
  if (encoded.length > MAX_HEADER_LENGTH) throw new Error('Payment header is too large');
  return encoded;
}

export function decodePaymentHeader(header: string | null): unknown {
  if (!header || header.length > MAX_HEADER_LENGTH ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(header)) {
    throw new Error('Missing or malformed canonical payment header');
  }
  try {
    const binary = atob(header);
    if (btoa(binary) !== header) throw new Error('Noncanonical base64');
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, char => char.charCodeAt(0))));
  } catch {
    throw new Error('Malformed base64 JSON payment header');
  }
}

export function validatePaymentChallenge(value: unknown, policy: PaymentPolicy): ValidatedPaymentChallenge {
  const target = resolvePaymentTarget(policy.gatewayUrl, policy.endpoint);
  const trusted = paymentNetwork(policy.network);
  const treasury = paymentAddress(policy.treasuryAddress ?? DEFAULT_TREASURY_ADDRESS, 'treasury address');
  const timeout = policy.maxTimeoutSeconds ?? PAYMENT_TIMEOUT_SECONDS;
  if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > PAYMENT_TIMEOUT_SECONDS) {
    throw new Error('Payment authorization timeout must be between 1 and 300 seconds');
  }
  if (!object(value) || value.x402Version !== 2 || 'paymentRequirements' in value ||
      !object(value.resource) || !Array.isArray(value.accepts) || value.accepts.length !== 1) {
    throw new Error('Unsupported canonical x402 v2 challenge');
  }
  const resource = value.resource;
  if ((resource.url !== target.targetUrl && resource.url !== target.path) ||
      resource.mimeType !== 'application/json' || typeof resource.description !== 'string' || resource.description.length > 2048) {
    throw new Error('Payment challenge resource URL, path, or MIME type does not match the requested resource');
  }
  const requirement = value.accepts[0];
  if (!object(requirement) || requirement.scheme !== 'exact' || requirement.network !== trusted.network ||
      paymentAddress(requirement.asset, 'payment asset') !== trusted.asset ||
      paymentAddress(requirement.payTo, 'payment recipient') !== treasury ||
      !object(requirement.extra) || requirement.extra.name !== trusted.name || requirement.extra.version !== '2' ||
      Object.keys(requirement.extra).some(key => key !== 'name' && key !== 'version')) {
    throw new Error('Payment challenge does not match the trusted Base USDC, merchant, network, or signing domain');
  }
  if (!Number.isSafeInteger(requirement.maxTimeoutSeconds) ||
      (requirement.maxTimeoutSeconds as number) < 1 || (requirement.maxTimeoutSeconds as number) > timeout) {
    throw new Error('Payment challenge authorization lifetime exceeds the permitted bound');
  }
  const amount = parseAtomicAmount(requirement.amount);
  const expected = policy.expectedAmount ?? (policy.maxAmount === undefined ? target.amount : undefined);
  if (amount === 0n || (expected !== undefined && amount !== parseAtomicAmount(expected, 'expected price')) ||
      (policy.maxAmount !== undefined && amount > parseAtomicAmount(policy.maxAmount, 'maximum price'))) {
    throw new Error('Payment challenge price differs from the authorized price');
  }
  const accepted: X402PaymentRequirements = {
    scheme: 'exact', network: trusted.network, asset: trusted.asset, amount: amount.toString(), payTo: treasury,
    maxTimeoutSeconds: requirement.maxTimeoutSeconds as number,
    extra: { name: trusted.name, version: '2' },
  };
  const info: X402ResourceInfo = { url: resource.url as string, description: resource.description, mimeType: resource.mimeType };
  const challenge: X402Challenge = { x402Version: 2, resource: info, accepts: [accepted] };
  // Keep the signed offer fixed even while a wallet approval is awaiting user input.
  Object.freeze(accepted.extra);
  Object.freeze(accepted);
  Object.freeze(info);
  Object.freeze(challenge.accepts);
  Object.freeze(challenge);
  const validated = Object.freeze({ challenge, accepted, resource: info, targetUrl: target.targetUrl, chainId: trusted.chainId });
  validatedSnapshots.add(validated);
  return validated;
}

export function createPaymentAuthorization(validated: ValidatedPaymentChallenge, payerAddress: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!validatedSnapshots.has(validated)) throw new Error('Validate the payment challenge before creating an authorization');
  if (!Number.isSafeInteger(nowSeconds) || nowSeconds < 5) throw new Error('Invalid authorization time');
  const accepted = validated.accepted;
  const from = paymentAddress(payerAddress, 'payer address');
  const to = paymentAddress(accepted.payTo, 'payment recipient');
  const bytes = new Uint8Array(32);
  if (!globalThis.crypto?.getRandomValues) throw new Error('A secure random number generator is required for payments');
  globalThis.crypto.getRandomValues(bytes);
  const nonce = `0x${Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')}` as Hex;
  const validAfter = BigInt(nowSeconds - 5);
  const validBefore = validAfter + BigInt(accepted.maxTimeoutSeconds);
  if (validBefore <= BigInt(nowSeconds)) throw new Error('Payment authorization lifetime is too short');
  const authorization: X402Authorization = Object.freeze({
    from, to, value: accepted.amount, validAfter: validAfter.toString(), validBefore: validBefore.toString(), nonce,
  });
  return {
    authorization,
    typedData: {
      domain: { name: accepted.extra.name, version: accepted.extra.version, chainId: validated.chainId, verifyingContract: paymentAddress(accepted.asset) },
      types: EIP712_TRANSFER_TYPES,
      primaryType: 'TransferWithAuthorization' as const,
      message: { from, to, value: BigInt(accepted.amount), validAfter, validBefore, nonce },
    },
  };
}

export function createPaymentPayload(validated: ValidatedPaymentChallenge, authorization: X402Authorization, signature: string): X402PaymentProof {
  if (!validatedSnapshots.has(validated)) throw new Error('Validate the payment challenge before creating a proof');
  const now = BigInt(Math.floor(Date.now() / 1000));
  const validAfter = parseAtomicAmount(authorization.validAfter, 'authorization start');
  const validBefore = parseAtomicAmount(authorization.validBefore, 'authorization expiry');
  if (!/^0x[0-9a-fA-F]{130}$/.test(signature) || !/^0x[0-9a-fA-F]{64}$/.test(authorization.nonce) ||
      paymentAddress(authorization.to) !== paymentAddress(validated.accepted.payTo) ||
      authorization.value !== validated.accepted.amount || validAfter > now || validBefore <= now ||
      validBefore - validAfter > BigInt(validated.accepted.maxTimeoutSeconds) || validBefore > now + BigInt(PAYMENT_TIMEOUT_SECONDS)) {
    throw new Error('Payment signature or authorization no longer matches the approved challenge');
  }
  paymentAddress(authorization.from, 'payer address');
  return { x402Version: 2, resource: validated.resource, accepted: validated.accepted, payload: { signature, authorization: { ...authorization } } };
}

export function isTransactionHash(value: unknown): value is Hex {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value) && !/^0x0{64}$/i.test(value);
}

export function validateSettlementResponse(body: unknown, header: string | null, expected: SettlementExpectation): SettlementReceipt {
  const response = decodePaymentHeader(header);
  const network = expected.network === 'eip155:8453' ? paymentNetwork('base')
    : expected.network === 'eip155:84532' ? paymentNetwork('base-sepolia') : undefined;
  if (!network || paymentAddress(expected.asset) !== network.asset || !object(response) || response.success !== true ||
      response.errorReason || response.network !== expected.network || !isTransactionHash(response.transaction) ||
      paymentAddress(response.payer, 'settlement payer') !== paymentAddress(expected.payer) ||
      (response.amount !== undefined && parseAtomicAmount(response.amount) !== parseAtomicAmount(expected.amount))) {
    throw new Error('Missing, failed, or mismatched canonical settlement response');
  }
  if (!object(body) || !Object.prototype.hasOwnProperty.call(body, 'data') || !object(body._settlement)) {
    throw new Error('Gateway returned no confirmed settlement receipt or paid data');
  }
  const receipt = body._settlement;
  if (receipt.protocol !== 'x402 v2' || receipt.network !== expected.network || receipt.asset !== 'USDC' ||
      paymentAddress(receipt.payer, 'receipt payer') !== paymentAddress(expected.payer) ||
      !isTransactionHash(receipt.tx_hash) || receipt.tx_hash.toLowerCase() !== response.transaction.toLowerCase() ||
      typeof receipt.cost_usdc !== 'string' ||
      parseUsdcAmount(receipt.cost_usdc.replace(/^\$/, ''), 'receipt cost') !== parseAtomicAmount(expected.amount) ||
      typeof receipt.settled_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(receipt.settled_at) ||
      !Number.isFinite(Date.parse(receipt.settled_at)) || Date.parse(receipt.settled_at) > Date.now() + 60_000) {
    throw new Error('Settlement receipt does not match the authorized payment');
  }
  return { protocol: 'x402 v2', network: expected.network, asset: 'USDC', cost_usdc: receipt.cost_usdc,
    payer: receipt.payer as string, tx_hash: receipt.tx_hash, settled_at: receipt.settled_at };
}
