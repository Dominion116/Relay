import { randomBytes } from 'node:crypto';
import { PaymentPayloadV2Schema, PaymentRequirementsV2Schema, z } from '@x402/core/schemas';
import { ExactEvmScheme } from '@x402/evm/exact/facilitator';
import { eip3009ABI, type FacilitatorEvmSigner } from '@x402/evm';
import {
  createPublicClient, createWalletClient, encodeFunctionData, getAddress, http,
  keccak256, parseAbi, parseEventLogs, type Abi, type Address, type Hex
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';
import type {
  RelayNetwork, X402Challenge, X402ErrorCode, X402PaymentProof, X402PaymentRequirements,
  X402Resource, X402SettlementResult, X402VerificationResult, WellKnownX402Manifest
} from '../types/x402';
import {
  RELAY_RESOURCES as PUBLIC_RESOURCES, BASE_USDC_MAINNET, BASE_USDC_SEPOLIA,
  DEFAULT_TREASURY_ADDRESS, PAYMENT_TIMEOUT_SECONDS
} from '../shared/resources';
import * as providers from './providers';

export { BASE_USDC_MAINNET, BASE_USDC_SEPOLIA, DEFAULT_TREASURY_ADDRESS } from '../shared/resources';

const configuredNetwork = process.env.RELAY_NETWORK ?? 'base';
if (configuredNetwork !== 'base' && configuredNetwork !== 'base-sepolia') {
  throw new Error('RELAY_NETWORK must be base or base-sepolia');
}
const treasury = process.env.RELAY_TREASURY_ADDRESS ?? DEFAULT_TREASURY_ADDRESS;
if (!/^0x[0-9a-fA-F]{40}$/.test(treasury) || /^0x0{40}$/i.test(treasury)) {
  throw new Error('RELAY_TREASURY_ADDRESS must be a nonzero address');
}
export const RELAY_RESOURCES: X402Resource[] = PUBLIC_RESOURCES.map(resource => ({
  ...resource,
  network: configuredNetwork,
  chainId: configuredNetwork === 'base' ? base.id : baseSepolia.id,
  asset: configuredNetwork === 'base' ? BASE_USDC_MAINNET : BASE_USDC_SEPOLIA,
  payTo: getAddress(treasury)
}));

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/).refine(value => !/^0x0{40}$/i.test(value));
const uint256 = z.string().refine(value => /^(0|[1-9][0-9]{0,77})$/.test(value) && BigInt(value) < (1n << 256n));
const paymentSchema = PaymentPayloadV2Schema.omit({ extensions: true }).strict().extend({
  accepted: PaymentRequirementsV2Schema.strict().extend({
    scheme: z.literal('exact'), network: z.enum(['eip155:8453', 'eip155:84532']),
    asset: address, payTo: address, amount: uint256,
    maxTimeoutSeconds: z.literal(PAYMENT_TIMEOUT_SECONDS),
    extra: z.object({ name: z.enum(['USD Coin', 'USDC']), version: z.literal('2') }).strict()
  }),
  payload: z.object({
    signature: z.string().regex(/^0x(?:[0-9a-fA-F]{2}){1,4096}$/),
    authorization: z.object({
      from: address, to: address, value: uint256, validAfter: uint256, validBefore: uint256,
      nonce: z.string().regex(/^0x[0-9a-fA-F]{64}$/)
    }).strict()
  }).strict()
});

const messages: Record<X402ErrorCode, string> = {
  invalid_payment: 'Payment does not match the required signed authorization.',
  payment_expired: 'Payment authorization has expired or is too close to expiry.',
  payment_not_yet_valid: 'Payment authorization is not yet valid.',
  payment_replayed: 'Payment authorization has already been used or cancelled.',
  payment_configuration_error: 'Payment settlement is not configured correctly.',
  payment_verification_unavailable: 'Payment verification is temporarily unavailable.',
  settlement_failed: 'Payment settlement was not confirmed as successful.',
  settlement_pending: 'Payment may have been submitted. Reconcile the transaction before paying again.',
  settlement_in_progress: 'This authorization is already being settled. Do not pay again.'
};
class PaymentError extends Error {
  constructor(readonly code: X402ErrorCode) { super(messages[code]); }
}
function failure(errorCode: X402ErrorCode, payer = '', amount = '0'): X402VerificationResult {
  return { valid: false, payer, amount, errorCode, error: messages[errorCode] };
}
function reasonCode(reason?: string): X402ErrorCode {
  if (reason === 'invalid_exact_evm_nonce_already_used') return 'payment_replayed';
  if (reason === 'invalid_exact_evm_payload_authorization_valid_before') return 'payment_expired';
  if (reason === 'invalid_exact_evm_payload_authorization_valid_after') return 'payment_not_yet_valid';
  if (reason === 'invalid_exact_evm_failed_to_verify_signature' || reason === 'invalid_exact_evm_transaction_simulation_failed') {
    return 'payment_verification_unavailable';
  }
  return 'invalid_payment';
}
function resourceUrl(resource: X402Resource, origin = process.env.GATEWAY_ORIGIN ?? 'https://relayx402.vercel.app'): string {
  const url = new URL(resource.url, origin);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash) {
    throw new PaymentError('payment_configuration_error');
  }
  return url.href;
}
function requirementsFor(resource: X402Resource): X402PaymentRequirements {
  const isBase = resource.network === 'base';
  const asset = isBase ? BASE_USDC_MAINNET : BASE_USDC_SEPOLIA;
  if ((!isBase && resource.network !== 'base-sepolia') ||
      resource.chainId !== (isBase ? base.id : baseSepolia.id) ||
      resource.asset.toLowerCase() !== asset.toLowerCase() ||
      !address.safeParse(resource.payTo).success || !uint256.safeParse(resource.amount).success || BigInt(resource.amount) === 0n) {
    throw new PaymentError('payment_configuration_error');
  }
  return {
    scheme: 'exact', network: isBase ? 'eip155:8453' : 'eip155:84532',
    asset, amount: resource.amount, payTo: getAddress(resource.payTo),
    maxTimeoutSeconds: PAYMENT_TIMEOUT_SECONDS,
    extra: { name: isBase ? 'USD Coin' : 'USDC', version: '2' }
  };
}

export function generate402Challenge(resource: X402Resource, network: RelayNetwork = resource.network, origin?: string): X402Challenge {
  const selected = network === resource.network ? resource : {
    ...resource, network, chainId: network === 'base' ? base.id : baseSepolia.id,
    asset: network === 'base' ? BASE_USDC_MAINNET : BASE_USDC_SEPOLIA
  };
  return {
    x402Version: 2, error: 'Payment Required',
    resource: { url: resourceUrl(resource, origin), description: resource.description, mimeType: 'application/json' },
    accepts: [requirementsFor(selected)]
  };
}

function validateProof(input: unknown, resource: X402Resource):
  { proof: X402PaymentProof; requirements: X402PaymentRequirements } | X402VerificationResult {
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return failure('invalid_payment');
  const proof = parsed.data as X402PaymentProof;
  const auth = proof.payload.authorization;
  try {
    const requirements = requirementsFor(resource);
    const accepted = proof.accepted;
    if (accepted.network !== requirements.network || accepted.scheme !== requirements.scheme ||
        accepted.asset.toLowerCase() !== requirements.asset.toLowerCase() ||
        accepted.payTo.toLowerCase() !== requirements.payTo.toLowerCase() ||
        accepted.amount !== requirements.amount || auth.value !== requirements.amount ||
        auth.to.toLowerCase() !== requirements.payTo.toLowerCase() ||
        accepted.extra.name !== requirements.extra.name || accepted.extra.version !== requirements.extra.version ||
        (proof.resource && proof.resource.url !== resourceUrl(resource))) {
      return failure('invalid_payment', auth.from, resource.amount);
    }
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (BigInt(auth.validBefore) < now + 6n) return failure('payment_expired', auth.from, resource.amount);
    if (BigInt(auth.validAfter) >= now) return failure('payment_not_yet_valid', auth.from, resource.amount);
    if (BigInt(auth.validBefore) > now + BigInt(PAYMENT_TIMEOUT_SECONDS) || BigInt(auth.validBefore) <= BigInt(auth.validAfter)) {
      return failure('invalid_payment', auth.from, resource.amount);
    }
    return { proof, requirements };
  } catch (error) {
    return failure(error instanceof PaymentError ? error.code : 'payment_configuration_error', auth.from, resource.amount);
  }
}

const settlementEvents = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce)'
]);
const inFlight = new Set<string>();
const pending = new Map<string, { txHash: Hex; expiresAt: number }>();
const nonceQueues = new Map<string, Promise<void>>();
function authorizationKey(proof: X402PaymentProof): string {
  const auth = proof.payload.authorization;
  return `${proof.accepted.network}:${proof.accepted.asset}:${auth.from}:${auth.nonce}`.toLowerCase();
}
function pendingFor(key: string) {
  for (const [id, entry] of pending) if (entry.expiresAt < Date.now()) pending.delete(id);
  return pending.get(key);
}
async function serializeSend<T>(key: string, send: () => Promise<T>): Promise<T> {
  const previous = nonceQueues.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const tail = previous.then(() => gate);
  nonceQueues.set(key, tail);
  await previous;
  try { return await send(); }
  finally {
    release();
    if (nonceQueues.get(key) === tail) nonceQueues.delete(key);
  }
}

function createFacilitator(resource: X402Resource, proof: X402PaymentProof, attempt?: { txHash?: Hex }) {
  const key = process.env.RELAY_FACILITATOR_KEY;
  const normalizedKey = key?.startsWith('0x') ? key : `0x${key ?? ''}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalizedKey)) throw new PaymentError('payment_configuration_error');
  let account;
  try { account = privateKeyToAccount(normalizedKey as Hex); }
  catch { throw new PaymentError('payment_configuration_error'); }
  const chain = resource.network === 'base' ? base : baseSepolia;
  const rpcUrl = process.env.BASE_RPC_URL ?? chain.rpcUrls.default.http[0];
  const timeout = Number(process.env.RELAY_SETTLEMENT_TIMEOUT_MS ?? 15000);
  try {
    if (!['https:', 'http:'].includes(new URL(rpcUrl).protocol) || !Number.isInteger(timeout) || timeout < 100 || timeout > 30000) {
      throw new Error();
    }
  } catch { throw new PaymentError('payment_configuration_error'); }
  const transport = http(rpcUrl, { timeout: 5000, retryCount: 0 });
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ chain, account, transport });
  const auth = proof.payload.authorization;
  const token = getAddress(resource.asset);
  const signer: FacilitatorEvmSigner = {
    getAddresses: () => [account.address],
    getCode: args => publicClient.getCode(args),
    readContract: args => publicClient.readContract({ ...args, abi: args.abi as Abi, account: args.account ?? account.address }),
    verifyTypedData: args => publicClient.verifyTypedData(args as Parameters<typeof publicClient.verifyTypedData>[0]),
    sendTransaction: async () => { throw new PaymentError('invalid_payment'); },
    writeContract: async args => {
      if (!attempt || args.functionName !== 'transferWithAuthorization' || args.address.toLowerCase() !== token.toLowerCase()) {
        throw new PaymentError('invalid_payment');
      }
      return serializeSend(`${chain.id}:${account.address}`, async () => {
        // A unique transaction per attempt prevents two replicas claiming the same mined tx.
        // Cross-instance nonce allocation still requires a dedicated/shared signer for throughput.
        const data = `${encodeFunctionData({ abi: args.abi as Abi, functionName: args.functionName, args: args.args })}${randomBytes(16).toString('hex')}` as Hex;
        const request = await walletClient.prepareTransactionRequest({ account, chain, type: 'eip1559', to: token, data, gas: args.gas });
        const serialized = await account.signTransaction({
          type: 'eip1559', chainId: chain.id, to: token, data,
          nonce: request.nonce, gas: request.gas,
          maxFeePerGas: request.maxFeePerGas, maxPriorityFeePerGas: request.maxPriorityFeePerGas
        });
        attempt.txHash = keccak256(serialized);
        const returnedHash = await walletClient.sendRawTransaction({ serializedTransaction: serialized });
        if (returnedHash.toLowerCase() !== attempt.txHash.toLowerCase()) throw new PaymentError('settlement_pending');
        return attempt.txHash;
      });
    },
    waitForTransactionReceipt: async ({ hash }) => {
      const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 2, timeout, pollingInterval: 1000, checkReplacement: false });
      // Never follow a replaced transaction into another request's success.
      if (receipt.transactionHash.toLowerCase() !== hash.toLowerCase() || !Array.isArray(receipt.logs)) {
        throw new PaymentError('settlement_pending');
      }
      if (receipt.status === 'success') {
        const logs = receipt.logs.filter(log => log.address.toLowerCase() === token.toLowerCase());
        const transfers = parseEventLogs({ abi: settlementEvents, eventName: 'Transfer', logs });
        const authorizations = parseEventLogs({ abi: settlementEvents, eventName: 'AuthorizationUsed', logs });
        const transferred = transfers.some(log => log.args.from.toLowerCase() === auth.from.toLowerCase() &&
          log.args.to.toLowerCase() === auth.to.toLowerCase() && log.args.value === BigInt(auth.value));
        const consumed = authorizations.some(log => log.args.authorizer.toLowerCase() === auth.from.toLowerCase() &&
          log.args.nonce.toLowerCase() === auth.nonce.toLowerCase());
        const nonceUsed = await publicClient.readContract({ address: token, abi: eip3009ABI,
          functionName: 'authorizationState', args: [getAddress(auth.from), auth.nonce as Hex], blockNumber: receipt.blockNumber });
        if (!transferred || !consumed || nonceUsed !== true) throw new PaymentError('settlement_pending');
      }
      return receipt;
    }
  };
  // Each request owns its scheme. A pending-store hit must never turn a replay into success.
  const scheme = new ExactEvmScheme(signer, { simulateInSettle: true });
  return { publicClient, scheme, chain };
}

async function verifyOnChain(context: ReturnType<typeof createFacilitator>, proof: X402PaymentProof,
  requirements: X402PaymentRequirements): Promise<X402VerificationResult> {
  const auth = proof.payload.authorization;
  if (await context.publicClient.getChainId() !== context.chain.id) throw new PaymentError('payment_configuration_error');
  const used = await context.publicClient.readContract({ address: getAddress(requirements.asset), abi: eip3009ABI,
    functionName: 'authorizationState', args: [getAddress(auth.from), auth.nonce as Hex] });
  if (used === true) return failure('payment_replayed', auth.from, requirements.amount);
  if (used !== false) throw new PaymentError('payment_verification_unavailable');
  const result = await context.scheme.verify(proof, requirements);
  return result.isValid
    ? { valid: true, payer: auth.from, amount: requirements.amount }
    : failure(reasonCode(result.invalidReason), auth.from, requirements.amount);
}

export async function verifyPaymentProof(input: unknown, resource: X402Resource): Promise<X402VerificationResult> {
  const checked = validateProof(input, resource);
  if (!('proof' in checked)) return checked;
  const { proof, requirements } = checked;
  const key = authorizationKey(proof);
  const existing = pendingFor(key);
  if (existing) return { ...failure('settlement_pending', proof.payload.authorization.from, resource.amount), txHash: existing.txHash };
  if (inFlight.has(key)) return failure('settlement_in_progress', proof.payload.authorization.from, resource.amount);
  try {
    return await verifyOnChain(createFacilitator(resource, proof), proof, requirements);
  } catch (error) {
    return failure(error instanceof PaymentError ? error.code : 'payment_verification_unavailable', proof.payload.authorization.from, resource.amount);
  }
}

export async function settlePaymentProof(input: unknown, resource: X402Resource): Promise<X402SettlementResult> {
  const checked = validateProof(input, resource);
  if (!('proof' in checked)) return checked;
  const { proof, requirements } = checked;
  const auth = proof.payload.authorization;
  const key = authorizationKey(proof);
  const existing = pendingFor(key);
  if (existing) return { ...failure('settlement_pending', auth.from, resource.amount), txHash: existing.txHash, network: requirements.network };
  if (inFlight.has(key)) return failure('settlement_in_progress', auth.from, resource.amount);
  inFlight.add(key);
  const attempt: { txHash?: Hex } = {};
  let result: X402SettlementResult;
  try {
    const context = createFacilitator(resource, proof, attempt);
    const verified = await verifyOnChain(context, proof, requirements);
    if (!verified.valid) return verified;
    const settled = await context.scheme.settle(proof, requirements);
    if (settled.success && attempt.txHash && settled.transaction.toLowerCase() === attempt.txHash.toLowerCase()) {
      return { valid: true, payer: auth.from, amount: requirements.amount,
        txHash: attempt.txHash, settledAt: new Date().toISOString(), network: requirements.network };
    }
    const code = settled.errorReason === 'settlement_pending' || (attempt.txHash && !settled.transaction)
      ? 'settlement_pending' : settled.errorReason === 'invalid_exact_evm_nonce_already_used' ? 'payment_replayed' : 'settlement_failed';
    result = { ...failure(code, auth.from, resource.amount), txHash: attempt.txHash, network: requirements.network };
  } catch (error) {
    result = { ...failure(attempt.txHash ? 'settlement_pending' : error instanceof PaymentError ? error.code : 'settlement_failed', auth.from, resource.amount),
      txHash: attempt.txHash, network: requirements.network };
  } finally {
    inFlight.delete(key);
  }
  if (result.errorCode === 'settlement_pending' && attempt.txHash) {
    pending.set(key, { txHash: attempt.txHash, expiresAt: Number(auth.validBefore) * 1000 + 60000 });
  }
  return result;
}

export async function dispatchResourceRequest(resourceId: string, params: Record<string, any>) {
  switch (resourceId) {
    case 'academic_search': return providers.fetchAcademicSearch(params.query, params.limit ?? 3);
    case 'academic_work': return providers.fetchAcademicWork(params.doi);
    case 'crypto_price': return providers.fetchCryptoPrice(params.assets, params.vsCurrency ?? 'usd');
    case 'crypto_market': return providers.fetchCryptoMarket(params.assets);
    case 'fx_rates': return providers.fetchFxRates(params.baseCurrency ?? 'USD', params.targets ?? ['EUR', 'GBP', 'JPY']);
    case 'weather': return providers.fetchWeather(params.latitude, params.longitude);
    case 'geocode': return providers.fetchGeocode(params.query);
    case 'holidays': return providers.fetchHolidays(params.countryCode, params.year ?? new Date().getUTCFullYear());
    case 'knowledge_search': return providers.fetchKnowledgeSearch(params.query);
    case 'news_search': return providers.fetchNewsSearch(params.query);
    case 'research': return providers.fetchResearchPack(params.topic);
    case 'verify': return providers.fetchVerifyClaim(params.claim);
    case 'health': return providers.getProvidersHealth();
    default: throw new Error(`Unknown resource ID: ${resourceId}`);
  }
}

export function getWellKnownManifest(origin?: string): WellKnownX402Manifest {
  return {
    x402Version: 2, name: 'Relay',
    description: 'Pay-per-use information retrieval with confirmed USDC payments using x402 v2 exact.',
    network: configuredNetwork === 'base' ? 'eip155:8453' : 'eip155:84532',
    chainId: configuredNetwork === 'base' ? base.id : baseSepolia.id,
    facilitator: 'Relay self-hosted @x402/evm facilitator',
    resources: RELAY_RESOURCES.map(resource => ({
      ...requirementsFor(resource), url: resourceUrl(resource, origin), method: resource.method,
      description: resource.description, mimeType: 'application/json'
    }))
  };
}
