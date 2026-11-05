import {
  RELAY_RESOURCES,
  generate402Challenge,
  verifyPaymentProof,
  dispatchResourceRequest,
  getWellKnownManifest
} from './x402Engine';
import { X402PaymentProof } from '../types/x402';

export interface GatewayResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
}

/**
 * Core wire protocol handler for Relay x402 endpoints
 */
export async function handleGatewayRequest(
  method: string,
  pathname: string,
  headers: Record<string, string | string[] | undefined>,
  rawBody: any,
  origin: string = (typeof process !== 'undefined' && process.env?.GATEWAY_ORIGIN) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GATEWAY_URL) ||
    'https://relayx402.vercel.app'
): Promise<GatewayResponse> {
  // Normalize pathname
  const cleanPath = pathname.split('?')[0].replace(/\/+$/, '');

  // 1. Well-known machine discovery manifest
  if (cleanPath === '/.well-known/x402' || cleanPath === '/.well-known/x402.json') {
    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600'
      },
      body: getWellKnownManifest(origin)
    };
  }

  // 1b. Live Gateway Health & Provider Telemetry (Free / Unchallenged)
  if (cleanPath === '/health' || cleanPath === '/v1/health' || cleanPath === '/api/health' || cleanPath === '/api/v1/health' || cleanPath === '/.well-known/health') {
    const healthData = await dispatchResourceRequest('health', {});
    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      },
      body: healthData
    };
  }

  // 2. Locate endpoint in registry
  const normalizedRoute = cleanPath.replace(/^\/api/, '');
  const resource = RELAY_RESOURCES.find(r => r.path === normalizedRoute || r.url === normalizedRoute);

  if (!resource) {
    return {
      status: 404,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: {
        error: 'Not Found',
        message: `Endpoint ${cleanPath} not found in Relay x402 registry. Consult /.well-known/x402 for available endpoints.`
      }
    };
  }

  // CORS preflight
  if (method === 'OPTIONS') {
    return {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Payment-Proof, X-Payer-Address, Authorization'
      },
      body: null
    };
  }

  // Parse body
  let parsedParams: Record<string, any> = {};
  if (rawBody) {
    if (typeof rawBody === 'string') {
      try {
        parsedParams = JSON.parse(rawBody);
      } catch {
        parsedParams = {};
      }
    } else if (typeof rawBody === 'object') {
      parsedParams = rawBody;
    }
  }

  // 3. Check for X402 Payment Proof
  const proofHeader = headers['x-payment-proof'] || headers['X-Payment-Proof'] || headers['authorization'] || headers['Authorization'];
  const payerHeader = headers['x-payer-address'] || headers['X-Payer-Address'];

  // If no proof is provided: Return HTTP 402 Challenge
  if (!proofHeader) {
    const challenge = generate402Challenge(resource, 'base');
    return {
      status: 402,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'WWW-Authenticate, X-402-Cost, X-402-Payee, X-402-Token',
        'WWW-Authenticate': `X402 scheme="transferWithAuthorization", token="${resource.asset}", amount="${resource.amount}", payee="${resource.payTo}", chainId="${resource.chainId}"`,
        'X-402-Cost': `${resource.priceUsdc} USDC`,
        'X-402-Payee': resource.payTo,
        'X-402-Token': resource.asset
      },
      body: challenge
    };
  }

  // Parse payment proof
  let proofObj: X402PaymentProof = {
    scheme: 'transferWithAuthorization',
    payerAddress: '0x0000000000000000000000000000000000000000',
    timestamp: Date.now()
  };
  let rawStr = (Array.isArray(proofHeader) ? proofHeader[0] : proofHeader).trim();
  const payerStr = Array.isArray(payerHeader) ? payerHeader[0] : payerHeader;

  // Strip optional 'Bearer ' or 'x402 ' prefix
  if (rawStr.toLowerCase().startsWith('bearer ')) {
    rawStr = rawStr.slice(7).trim();
  } else if (rawStr.toLowerCase().startsWith('x402 ')) {
    rawStr = rawStr.slice(5).trim();
  }

  // Decode URI-encoding if present
  if (rawStr.startsWith('%7B') || rawStr.startsWith('%7b')) {
    try {
      rawStr = decodeURIComponent(rawStr);
    } catch {
      // Continue with raw
    }
  }

  try {
    if (rawStr.startsWith('{')) {
      proofObj = JSON.parse(rawStr);
    } else {
      // Try decoding base64 JSON payload
      let parsedFromB64 = false;
      try {
        if (typeof Buffer !== 'undefined') {
          const b64Decoded = Buffer.from(rawStr, 'base64').toString('utf-8');
          if (b64Decoded.trim().startsWith('{')) {
            proofObj = JSON.parse(b64Decoded);
            parsedFromB64 = true;
          }
        }
      } catch {
        parsedFromB64 = false;
      }

      if (!parsedFromB64) {
        // Raw hex signature or hash
        proofObj = {
          scheme: 'transferWithAuthorization',
          clientSignature: rawStr,
          payerAddress: payerStr || '0x0000000000000000000000000000000000000000',
          timestamp: Date.now()
        };
      }
    }
    // Normalize RFC x402 v2 payload fields into internal proof object
    if (!proofObj.payerAddress && (proofObj as any).payload?.from) {
      proofObj.payerAddress = (proofObj as any).payload.from;
    }
    if (!proofObj.clientSignature && (proofObj as any).signature) {
      proofObj.clientSignature = (proofObj as any).signature;
    }
    if (!proofObj.authorization && (proofObj as any).payload) {
      proofObj.authorization = (proofObj as any).payload;
    }
  } catch {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: { error: 'Bad Request', message: 'Malformed X-Payment-Proof header' }
    };
  }

  // 4. Verify payment proof cryptographically
  const verification = await verifyPaymentProof(proofObj, resource);

  if (!verification.valid) {
    return {
      status: 402,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: {
        error: 'Payment Verification Failed',
        message: verification.error || 'Cryptographic EIP-712 payment authorization was invalid or rejected.',
        challenge: generate402Challenge(resource, 'base')
      }
    };
  }

  // 5. Execute and dispatch real upstream provider
  try {
    const data = await dispatchResourceRequest(resource.id, parsedParams);

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'X-402-Settlement-Tx': verification.txHash || 'settled',
        'X-402-Settlement-Payer': verification.payer
      },
      body: {
        _settlement: {
          protocol: 'RFC x402 v2',
          network: 'Base (Chain ID 8453)',
          asset: 'USDC',
          cost_usdc: `$${resource.priceUsdc.toFixed(2)}`,
          payer: verification.payer,
          tx_hash: verification.txHash,
          settled_at: verification.settledAt
        },
        data
      }
    };
  } catch (err: any) {
    return {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: {
        error: 'Upstream Provider Error',
        message: err.message || 'Error communicating with external live provider.'
      }
    };
  }
}
