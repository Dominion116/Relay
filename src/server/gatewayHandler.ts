import {
  RELAY_RESOURCES,
  generate402Challenge,
  verifyPaymentProof,
  settlePaymentProof,
  dispatchResourceRequest,
  getWellKnownManifest
} from './x402Engine';
import { MAX_REQUEST_BYTES, validateResourceParams } from '../shared/validation';

export interface GatewayResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
}

export interface GatewayDependencies {
  verify: typeof verifyPaymentProof;
  settle: typeof settlePaymentProof;
  dispatch: typeof dispatchResourceRequest;
}

export const GATEWAY_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, PAYMENT-SIGNATURE',
  'Access-Control-Expose-Headers': 'PAYMENT-REQUIRED, PAYMENT-RESPONSE',
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store'
};

const defaults: GatewayDependencies = { verify: verifyPaymentProof, settle: settlePaymentProof, dispatch: dispatchResourceRequest };
const unavailableCodes = new Set(['payment_configuration_error', 'payment_verification_unavailable', 'settlement_pending', 'settlement_in_progress']);
const healthPaths = new Set(['/health', '/v1/health', '/api/health', '/api/v1/health', '/.well-known/health']);

export function isGatewayPath(path: string): boolean {
  const clean = path.split('?')[0].replace(/\/+$/, '');
  return clean === '/api/v1' || clean.startsWith('/v1/') || clean.startsWith('/api/v1/') ||
    clean === '/.well-known/x402' || clean === '/.well-known/x402.json' || clean === '/api/well-known/x402' || healthPaths.has(clean);
}

export async function handleGatewayRequest(
  method: string,
  pathname: string,
  headers: Record<string, string | string[] | undefined>,
  rawBody: unknown,
  origin = process.env.GATEWAY_ORIGIN || 'https://relayx402.vercel.app',
  dependencies: GatewayDependencies = defaults
): Promise<GatewayResponse> {
  const respond = (status: number, body: any, extra: Record<string, string> = {}): GatewayResponse => ({ status, headers: { ...GATEWAY_HEADERS, ...extra }, body });
  const header = (name: string) => {
    const values = Object.entries(headers).filter(([key]) => key.toLowerCase() === name.toLowerCase()).map(([, value]) => value);
    if (values.length > 1 || Array.isArray(values[0])) throw new Error(`Duplicate ${name} header.`);
    return values[0] as string | undefined;
  };
  const cleanPath = pathname.split('?')[0].replace(/\/+$/, '');
  const discovery = ['/.well-known/x402', '/.well-known/x402.json', '/api/well-known/x402'].includes(cleanPath);
  const health = healthPaths.has(cleanPath);
  const matchedResource = RELAY_RESOURCES.find(candidate => candidate.path === cleanPath.replace(/^\/api(?=\/v1\/)/, ''));
  const resource = matchedResource ? { ...matchedResource, url: new URL(cleanPath, origin).href } : undefined;
  if (!discovery && !health && !resource) return respond(404, { error: 'Not Found', message: 'Consult /.well-known/x402 for available endpoints.' });

  const allowedMethods = resource ? `${resource.method}, OPTIONS` : 'GET, HEAD, OPTIONS';
  if (method === 'OPTIONS') return respond(204, null, { 'Access-Control-Allow-Methods': allowedMethods, 'Access-Control-Max-Age': '600' });
  if (resource ? method !== resource.method : method !== 'GET' && method !== 'HEAD') {
    return respond(405, { error: 'Method Not Allowed' }, { Allow: allowedMethods, 'Access-Control-Allow-Methods': allowedMethods });
  }
  if (discovery) return respond(200, method === 'HEAD' ? null : getWellKnownManifest(origin), { 'Cache-Control': 'public, max-age=300' });
  if (health) {
    try {
      const result = await dependencies.dispatch('health', {});
      const operational = result && typeof result === 'object' && 'status' in result && result.status === 'operational';
      return respond(operational ? 200 : 503, method === 'HEAD' ? null : result);
    } catch {
      return respond(503, { status: 'degraded', error: 'Provider health checks unavailable.' });
    }
  }
  if (!resource) return respond(404, { error: 'Not Found' });

  let params: Record<string, any>;
  let encodedProof: string | undefined;
  try {
    const length = header('content-length');
    if (length && (!/^\d+$/.test(length) || Number(length) > MAX_REQUEST_BYTES)) {
      return respond(413, { error: 'Request Too Large', message: `Maximum request body is ${MAX_REQUEST_BYTES} bytes.` });
    }
    if (header('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      return respond(415, { error: 'Unsupported Media Type', message: 'Send Content-Type: application/json.' });
    }
    const serialized = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody === undefined ? {} : rawBody);
    if (Buffer.byteLength(serialized, 'utf8') > MAX_REQUEST_BYTES) return respond(413, { error: 'Request Too Large' });
    params = validateResourceParams(resource, serialized ? JSON.parse(serialized) : {});
    encodedProof = header('payment-signature');
    if (['authorization', 'x-payment-proof', 'x-payment', 'x-payer-address'].some(name => header(name) !== undefined)) {
      return respond(400, { error: 'Unsupported Payment Format', message: 'Use a canonical x402 v2 PAYMENT-SIGNATURE header; legacy proof headers are not accepted.' });
    }
  } catch (error) {
    return respond(400, { error: 'Bad Request', message: error instanceof SyntaxError ? 'Malformed JSON body.' : error instanceof Error ? error.message : 'Invalid request.' });
  }

  const challenge = generate402Challenge(resource, resource.network, origin);
  const challengeHeader = { 'PAYMENT-REQUIRED': Buffer.from(JSON.stringify(challenge)).toString('base64') };
  if (!encodedProof) return respond(402, challenge, challengeHeader);

  let proof: unknown;
  try {
    if (encodedProof.length > 8192 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encodedProof)) throw new Error('Invalid payment header.');
    const decoded = Buffer.from(encodedProof, 'base64');
    if (decoded.toString('base64') !== encodedProof) throw new Error('Invalid base64 payment header.');
    proof = JSON.parse(decoded.toString('utf8'));
  } catch {
    return respond(400, { error: 'Bad Request', message: 'PAYMENT-SIGNATURE must be base64-encoded x402 v2 JSON.' });
  }

  let verification;
  try {
    verification = await dependencies.verify(proof, resource);
  } catch {
    return respond(503, { error: 'Payment Verification Unavailable', message: 'Payment verification could not complete. No payment was submitted.' });
  }
  if (!verification.valid) {
    const code = verification.errorCode || 'invalid_payment';
    if (code === 'settlement_pending' || code === 'settlement_in_progress') {
      const transaction = verification.txHash && /^0x[0-9a-fA-F]{64}$/.test(verification.txHash) ? verification.txHash : '';
      const network = `eip155:${resource.chainId}`;
      const paymentResponse = { success: false, errorReason: code, transaction, network, payer: verification.payer, amount: verification.amount };
      return respond(503, {
        error: 'Payment Settlement Failed', code, transaction, network,
        message: 'Settlement is not confirmed. Reconcile this authorization on-chain before retrying; do not submit a new payment.'
      }, { 'PAYMENT-RESPONSE': Buffer.from(JSON.stringify(paymentResponse)).toString('base64') });
    }
    return respond(unavailableCodes.has(code) ? 503 : 402, { error: 'Payment Verification Failed', code, message: verification.error || 'Payment authorization rejected.' }, challengeHeader);
  }

  let data;
  try {
    data = await dependencies.dispatch(resource.id, params);
    const serialized = JSON.stringify(data);
    if (serialized === undefined || Buffer.byteLength(serialized, 'utf8') > 1_000_000) throw new Error('Invalid provider response size.');
    data = JSON.parse(serialized);
  } catch {
    return respond(502, { error: 'Upstream Provider Error', message: 'The provider could not fulfill the request. No payment was submitted.' });
  }

  let settlement;
  try {
    settlement = await dependencies.settle(proof, resource);
  } catch {
    return respond(503, { error: 'Payment Settlement Failed', code: 'settlement_pending', message: 'Settlement status is uncertain. Reconcile this authorization on-chain before retrying; do not submit a new payment.' });
  }
  const transaction = settlement.txHash && /^0x[0-9a-fA-F]{64}$/.test(settlement.txHash) ? settlement.txHash : '';
  const network = `eip155:${resource.chainId}`;
  const confirmed = settlement.valid && Boolean(transaction) && Boolean(settlement.settledAt) &&
    settlement.amount === resource.amount && settlement.payer.toLowerCase() === verification.payer.toLowerCase() &&
    (!settlement.network || settlement.network === network);
  const paymentResponse = {
    success: confirmed,
    transaction,
    network,
    payer: settlement.payer,
    amount: settlement.amount,
    ...(!confirmed ? { errorReason: settlement.errorCode || 'settlement_failed' } : {})
  };
  const responseHeader = { 'PAYMENT-RESPONSE': Buffer.from(JSON.stringify(paymentResponse)).toString('base64') };
  if (!confirmed) {
    const code = settlement.errorCode || 'settlement_failed';
    return respond(unavailableCodes.has(code) || transaction ? 503 : 402, {
      error: 'Payment Settlement Failed', code, transaction, network,
      message: transaction || unavailableCodes.has(code)
        ? 'Settlement is not confirmed. Reconcile this authorization on-chain before retrying; do not submit a new payment.'
        : settlement.error || 'Payment settlement was rejected. No paid data was released.'
    }, responseHeader);
  }

  return respond(200, {
    _settlement: {
      protocol: 'x402 v2', network, asset: 'USDC', cost_usdc: `$${resource.priceUsdc.toFixed(2)}`,
      payer: settlement.payer, tx_hash: transaction, settled_at: settlement.settledAt
    },
    data
  }, responseHeader);
}
