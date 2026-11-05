export interface X402Resource {
  id: string;
  name: string;
  category: 'academic' | 'crypto' | 'market' | 'weather' | 'geo' | 'news' | 'knowledge' | 'research';
  url: string;
  path: string;
  method: 'POST' | 'GET';
  description: string;
  network: 'base' | 'base-sepolia';
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

export interface X402Challenge {
  x402Version: number;
  error: string;
  message: string;
  paymentRequirements: {
    scheme: 'erc3009' | 'transferWithAuthorization' | 'onchain_transfer';
    network: 'base' | 'base-sepolia';
    chainId: number;
    tokenAddress: string;
    tokenSymbol: string;
    amount: string;
    amountFormatted: string;
    payTo: string;
    nonce: string;
    validBefore: number;
    resource: string;
  };
}

export interface X402PaymentProof {
  scheme: 'transferWithAuthorization' | 'onchain_tx';
  txHash?: string;
  authorization?: {
    from: string;
    to: string;
    value: string;
    validAfter: number;
    validBefore: number;
    nonce: string;
    v?: number;
    r?: string;
    s?: string;
  };
  clientSignature?: string;
  payerAddress: string;
  timestamp: number;
}

export interface X402VerificationResult {
  valid: boolean;
  payer: string;
  amount: string;
  txHash?: string;
  settledAt?: string;
  error?: string;
  onChainBroadcast?: {
    attempted: boolean;
    success: boolean;
    txHash?: string;
    error?: string;
  };
}

export interface WellKnownX402Manifest {
  x402Version: number;
  name: string;
  description: string;
  network: string;
  chainId: number;
  facilitator: string;
  resources: Array<{
    url: string;
    method: string;
    description: string;
    network: string;
    asset: string;
    amount: string;
    payTo: string;
  }>;
}
