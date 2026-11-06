export type RelayNetwork = 'base' | 'base-sepolia';
export type X402Network = 'eip155:8453' | 'eip155:84532';

export interface X402Resource {
  id: string;
  name: string;
  category: 'academic' | 'crypto' | 'market' | 'weather' | 'geo' | 'news' | 'knowledge' | 'research';
  url: string;
  path: string;
  method: 'POST' | 'GET';
  description: string;
  network: RelayNetwork;
  chainId: number;
  asset: string; // Base USDC address
  assetSymbol: string;
  amount: string; // micro-USDC (6 decimals, e.g. 40000 = $0.04)
  priceUsdc: number; // e.g. 0.04
  payTo: string; // Receiver merchant address on Base
  defaultParams: Record<string, any>;
  schema: {
    request: Record<string, { type: string; required: boolean; description: string }>;
    responseSample: Record<string, any>;
  };
}

export interface X402ResourceInfo {
  url: string;
  description: string;
  mimeType: string;
}

export interface X402PaymentRequirements {
  scheme: 'exact';
  network: X402Network;
  asset: string;
  amount: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: { name: 'USD Coin' | 'USDC'; version: '2' };
}

export interface X402Challenge {
  x402Version: 2;
  error?: string;
  resource: X402ResourceInfo;
  accepts: X402PaymentRequirements[];
}

export interface X402Authorization {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
}

export interface X402PaymentProof {
  x402Version: 2;
  resource?: X402ResourceInfo;
  accepted: X402PaymentRequirements;
  payload: {
    signature: string;
    authorization: X402Authorization;
  };
}

export type X402ErrorCode =
  | 'invalid_payment'
  | 'payment_expired'
  | 'payment_not_yet_valid'
  | 'payment_replayed'
  | 'payment_configuration_error'
  | 'payment_verification_unavailable'
  | 'settlement_failed'
  | 'settlement_pending'
  | 'settlement_in_progress';

export interface X402VerificationResult {
  valid: boolean;
  payer: string;
  amount: string;
  error?: string;
  errorCode?: X402ErrorCode;
  /** A known transaction for reconciliation; its presence does not establish settlement. */
  txHash?: string;
}

export interface X402SettlementResult extends X402VerificationResult {
  settledAt?: string;
  network?: X402Network;
}

export interface WellKnownX402Manifest {
  x402Version: 2;
  name: string;
  description: string;
  network: X402Network;
  chainId: number;
  facilitator: string;
  resources: Array<X402PaymentRequirements & {
    url: string;
    method: string;
    description: string;
    mimeType: string;
  }>;
}
