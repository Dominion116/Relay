import { createPublicClient, http, type Hex, type Address, getAddress } from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { base } from 'viem/chains';

export const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;

export interface RelayClientConfig {
  /** Hex private key of the payer agent wallet holding Base USDC */
  privateKey: `0x${string}`;
  /** Custom gateway URL (defaults to production https://relayx402.vercel.app) */
  gatewayUrl?: string;
  /** Custom Base RPC URL (defaults to https://mainnet.base.org) */
  rpcUrl?: string;
}

export interface SettlementReceipt {
  protocol: string;
  network: string;
  asset: string;
  cost_usdc: string;
  payer: string;
  tx_hash: string;
  settled_at: string;
}

export interface RelayResponse<T = any> {
  settlement: SettlementReceipt;
  data: T;
}

export class RelayClient {
  public readonly account: PrivateKeyAccount;
  public readonly gatewayUrl: string;
  public readonly rpcUrl: string;

  constructor(config: RelayClientConfig) {
    if (!config.privateKey) {
      throw new Error('RelayClient requires a valid privateKey (0x...)');
    }
    const cleanKey = config.privateKey.startsWith('0x') ? config.privateKey : `0x${config.privateKey}` as `0x${string}`;
    this.account = privateKeyToAccount(cleanKey);
    this.gatewayUrl = (config.gatewayUrl || 'https://relayx402.vercel.app').replace(/\/+$/, '');
    this.rpcUrl = config.rpcUrl || 'https://mainnet.base.org';
  }

  /**
   * Payer wallet public address on Base
   */
  get address(): Address {
    return this.account.address;
  }

  /**
   * Check gateway system health and upstream provider latencies (free / unmetered)
   */
  async health(): Promise<any> {
    const res = await fetch(`${this.gatewayUrl}/health`);
    if (!res.ok) {
      throw new Error(`Health check failed with HTTP ${res.status}`);
    }
    return await res.json();
  }

  /**
   * Fetch machine discovery manifest (free / unmetered)
   */
  async getManifest(): Promise<any> {
    const res = await fetch(`${this.gatewayUrl}/.well-known/x402`);
    if (!res.ok) {
      throw new Error(`Manifest query failed with HTTP ${res.status}`);
    }
    return await res.json();
  }

  /**
   * Execute an x402 capability call with automated EIP-712 ERC-3009 micropayment
   */
  async call<T = any>(endpoint: string, body: Record<string, any> = {}): Promise<RelayResponse<T>> {
    const cleanPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const targetUrl = `${this.gatewayUrl}${cleanPath}`;

    // Step 1: Initial unauthenticated request (expecting HTTP 402 Challenge)
    const initialRes = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (initialRes.status === 200) {
      const json = await initialRes.json();
      return {
        settlement: json._settlement || { cost_usdc: '$0.00', settled_at: new Date().toISOString() },
        data: json.data || json
      };
    }

    if (initialRes.status !== 402) {
      const errText = await initialRes.text();
      throw new Error(`Unexpected gateway response (HTTP ${initialRes.status}): ${errText}`);
    }

    const challenge = await initialRes.json();
    const reqs = challenge.paymentRequirements;

    if (!reqs || !reqs.tokenAddress || !reqs.payTo || !reqs.amount) {
      throw new Error('Malformed HTTP 402 challenge returned by Relay gateway');
    }

    // Step 2: Sign authentic EIP-712 ERC-3009 TransferWithAuthorization
    const domain = {
      name: 'USD Coin',
      version: '2',
      chainId: reqs.chainId || 8453,
      verifyingContract: getAddress(reqs.tokenAddress)
    } as const;

    const types = {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' }
      ]
    } as const;

    const rawNonce = reqs.nonce || '0x0';
    const nonce = rawNonce.startsWith('0x') && rawNonce.length === 66
      ? (rawNonce as Hex)
      : (`0x${rawNonce.replace(/^0x/, '').padStart(64, '0')}` as Hex);

    const validAfter = 0n;
    const validBefore = BigInt(reqs.validBefore || Math.floor(Date.now() / 1000) + 3600);
    const value = BigInt(reqs.amount);

    const signature = await this.account.signTypedData({
      domain,
      types,
      primaryType: 'TransferWithAuthorization',
      message: {
        from: this.account.address,
        to: getAddress(reqs.payTo),
        value,
        validAfter,
        validBefore,
        nonce
      }
    });

    // Step 3: Package RFC x402 payment proof
    const proof = {
      version: '2',
      scheme: 'exact',
      network: 'base',
      signature,
      payload: {
        from: this.account.address,
        to: reqs.payTo,
        value: reqs.amount,
        validAfter: Number(validAfter),
        validBefore: Number(validBefore),
        nonce
      }
    };

    const b64Proof = Buffer.from(JSON.stringify(proof)).toString('base64');

    // Step 4: Resubmit with cryptographic payment proof
    const paidRes = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `x402 ${b64Proof}`
      },
      body: JSON.stringify(body)
    });

    if (!paidRes.ok) {
      const errText = await paidRes.text();
      throw new Error(`Settlement failed (HTTP ${paidRes.status}): ${errText}`);
    }

    const payload = await paidRes.json();
    return {
      settlement: payload._settlement,
      data: payload.data
    };
  }

  // Capability Convenience Namespaces
  public readonly crypto = {
    price: (assets: string[] = ['ethereum', 'bitcoin'], vsCurrency: string = 'usd') =>
      this.call('/v1/crypto/price', { coins: assets.join(','), currencies: vsCurrency }),
    market: (assets: string[] = ['ethereum', 'bitcoin']) =>
      this.call('/v1/crypto/market', { assets })
  };

  public readonly academic = {
    search: (query: string, limit: number = 5) =>
      this.call('/v1/academic/search', { query, limit }),
    work: (doi: string) =>
      this.call('/v1/academic/work', { doi })
  };

  public readonly fx = {
    rates: (baseCurrency: string = 'USD', targets: string[] = ['EUR', 'GBP', 'JPY']) =>
      this.call('/v1/fx/rates', { base: baseCurrency, symbols: targets.join(',') })
  };

  public readonly weather = {
    forecast: (latitude: number, longitude: number) =>
      this.call('/v1/weather', { latitude, longitude })
  };

  public readonly news = {
    search: (query: string) =>
      this.call('/v1/news/search', { query })
  };

  public readonly knowledge = {
    search: (query: string) =>
      this.call('/v1/knowledge/search', { query })
  };

  public readonly research = {
    pack: (topic: string) =>
      this.call('/v1/research', { topic })
  };

  public readonly verify = {
    claim: (claim: string) =>
      this.call('/v1/verify', { claim })
  };
}
