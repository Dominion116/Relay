import type { Address } from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import type { RelayNetwork } from '../types/x402';
import { BASE_USDC_MAINNET, DEFAULT_TREASURY_ADDRESS, RELAY_RESOURCES } from '../shared/resources';
import {
  createPaymentAuthorization, createPaymentPayload, decodePaymentHeader, encodePaymentHeader,
  isTransactionHash, normalizeGatewayUrl, parseUsdcAmount, paymentAddress, paymentNetwork,
  resolvePaymentTarget, validatePaymentChallenge, validateSettlementResponse,
  type SettlementReceipt,
} from '../shared/paymentClient';
import { MAX_REQUEST_BYTES, validateResourceParams } from '../shared/validation';
import { MemoryBudgetStore, type PaymentBudgetStore } from './budgetStore';

export const BASE_USDC_ADDRESS = BASE_USDC_MAINNET;
export type { SettlementReceipt } from '../shared/paymentClient';

export interface RelayClientConfig {
  /** A supplied, valid EOA private key. Both prefixed and unprefixed hex are accepted. */
  privateKey: string;
  gatewayUrl?: string;
  network?: RelayNetwork;
  treasuryAddress?: string;
  /** Both limits must be explicitly positive before the client may sign. Zero disables payment. */
  maxPaymentUsdc?: string | number;
  maxDailyBudgetUsdc?: string | number;
  budgetStore?: PaymentBudgetStore;
  timeoutMs?: number;
  /** Optional HTTP transport injection, primarily for offline tests. */
  fetch?: typeof globalThis.fetch;
}

export interface RelayCallOptions {
  /** Explicitly authorize a changed price up to this ceiling. Otherwise the catalog price is exact. */
  maxPriceUsdc?: string | number;
}

export interface RelayResponse<T = unknown> {
  settlement: SettlementReceipt;
  data: T;
}

export class RelayPaymentError extends Error {
  readonly paymentMayHaveSettled = true;

  constructor(message: string, public readonly status?: number, public readonly transactionHash?: string) {
    super(`${message}. The payment budget remains charged; reconcile this authorization before another payment.`);
    this.name = 'RelayPaymentError';
  }
}

const defaultBudgetStore = new MemoryBudgetStore();

export class RelayClient {
  public readonly account: PrivateKeyAccount;
  public readonly gatewayUrl: string;
  public readonly network: RelayNetwork;
  public readonly treasuryAddress: Address;
  private readonly maxPayment: bigint;
  private readonly dailyBudget: bigint;
  private readonly budget: PaymentBudgetStore;
  private readonly transport: typeof globalThis.fetch;
  private readonly timeoutMs: number;
  private readonly signTypedData: PrivateKeyAccount['signTypedData'];

  constructor(config: RelayClientConfig) {
    if (typeof config.privateKey !== 'string' || !/^(?:0x)?[0-9a-fA-F]{64}$/i.test(config.privateKey)) {
      throw new Error('RelayClient requires a valid privateKey: 32-byte hex, optionally prefixed with 0x');
    }
    try {
      this.account = privateKeyToAccount(`0x${config.privateKey.replace(/^0x/i, '')}`);
    } catch {
      throw new Error('RelayClient received an invalid private key; no fallback account will be generated');
    }
    this.signTypedData = this.account.signTypedData.bind(this.account);
    this.gatewayUrl = normalizeGatewayUrl(config.gatewayUrl ?? 'https://relayx402.vercel.app');
    this.network = config.network ?? 'base';
    paymentNetwork(this.network);
    this.treasuryAddress = paymentAddress(config.treasuryAddress ?? DEFAULT_TREASURY_ADDRESS, 'treasury address');
    this.maxPayment = config.maxPaymentUsdc === undefined ? 0n : parseUsdcAmount(config.maxPaymentUsdc, 'maxPaymentUsdc');
    this.dailyBudget = config.maxDailyBudgetUsdc === undefined ? 0n : parseUsdcAmount(config.maxDailyBudgetUsdc, 'maxDailyBudgetUsdc');
    this.budget = config.budgetStore ?? defaultBudgetStore;
    this.transport = config.fetch ?? globalThis.fetch;
    this.timeoutMs = config.timeoutMs ?? 60_000;
    if (!Number.isSafeInteger(this.timeoutMs) || this.timeoutMs < 1 || this.timeoutMs > 300_000) {
      throw new Error('timeoutMs must be an integer between 1 and 300000');
    }
  }

  get address(): Address {
    return this.account.address;
  }

  private async request(url: string, init: RequestInit = {}): Promise<{ response: Response; body: unknown }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.transport(url, { ...init, redirect: 'error', signal: controller.signal });
      if (response.redirected || (response.url && response.url !== url) || (response.status >= 300 && response.status < 400)) {
        throw new Error('Gateway redirects and changed response URLs are not permitted');
      }
      const text = await response.text();
      let body: unknown;
      try { body = JSON.parse(text); } catch { throw new Error(`Gateway returned invalid JSON (HTTP ${response.status})`); }
      return { response, body };
    } finally {
      clearTimeout(timeout);
    }
  }

  async health(): Promise<unknown> {
    const { response, body } = await this.request(`${this.gatewayUrl}/health`);
    if (!response.ok) throw new Error(`Health check failed with HTTP ${response.status}`);
    return body;
  }

  async getManifest(): Promise<unknown> {
    const { response, body } = await this.request(`${this.gatewayUrl}/.well-known/x402`);
    if (!response.ok) throw new Error(`Manifest query failed with HTTP ${response.status}`);
    return body;
  }

  async call<T = unknown>(endpoint: string, body: Record<string, unknown> = {}, options: RelayCallOptions = {}): Promise<RelayResponse<T>> {
    if (this.maxPayment === 0n || this.dailyBudget === 0n) {
      throw new Error('Automatic payments are disabled: explicitly configure positive maxPaymentUsdc and maxDailyBudgetUsdc');
    }
    const target = resolvePaymentTarget(this.gatewayUrl, endpoint);
    const resource = RELAY_RESOURCES.find(item => item.path === target.catalogPath)!;
    const params = validateResourceParams(resource, body);
    const requestBody = JSON.stringify(params);
    if (new TextEncoder().encode(requestBody).length > MAX_REQUEST_BYTES) throw new Error('Relay request body is too large');
    const explicitMax = options.maxPriceUsdc === undefined ? undefined : parseUsdcAmount(options.maxPriceUsdc, 'maxPriceUsdc');
    const priceLimit = explicitMax === undefined || explicitMax > this.maxPayment ? this.maxPayment : explicitMax;
    if (priceLimit === 0n || (explicitMax === undefined && BigInt(target.amount) > priceLimit)) {
      throw new Error('Resource price exceeds the authorized per-call USDC budget');
    }
    const init = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: requestBody };
    const initial = await this.request(target.targetUrl, init);
    if (initial.response.status !== 402) {
      throw new Error(`Expected an HTTP 402 payment challenge, received HTTP ${initial.response.status}; no payment signed`);
    }
    const policy = {
      gatewayUrl: this.gatewayUrl, endpoint: target.path, network: this.network, treasuryAddress: this.treasuryAddress,
      expectedAmount: explicitMax === undefined ? target.amount : undefined, maxAmount: priceLimit.toString(),
    };
    const challenge = validatePaymentChallenge(decodePaymentHeader(initial.response.headers.get('PAYMENT-REQUIRED')), policy);
    const bodyChallenge = validatePaymentChallenge(initial.body, policy);
    if (JSON.stringify(challenge.challenge) !== JSON.stringify(bodyChallenge.challenge)) {
      throw new Error('Payment challenge changed between the header and response body');
    }
    const payment = createPaymentAuthorization(challenge, this.address);
    const reservation = await this.budget.reserve({
      account: this.address, network: challenge.accepted.network, amount: challenge.accepted.amount, dailyLimit: this.dailyBudget.toString(),
    });
    let canRelease = true;
    let paidResponse: Response | undefined;
    let paidBody: unknown;
    try {
      const signature = await this.signTypedData(payment.typedData);
      const proof = createPaymentPayload(challenge, payment.authorization, signature);
      const header = encodePaymentHeader(proof);
      // Durably charge before exposing a spendable authorization. HTTP failures cannot undo it.
      canRelease = false;
      await this.budget.commit(reservation);
      const paid = await this.request(target.targetUrl, {
        ...init, headers: { ...init.headers, 'PAYMENT-SIGNATURE': header },
      });
      paidResponse = paid.response;
      paidBody = paid.body;
      if (!paidResponse.ok) throw new Error(`Payment request failed (HTTP ${paidResponse.status})`);
      const settlement = validateSettlementResponse(paidBody, paidResponse.headers.get('PAYMENT-RESPONSE'), {
        network: challenge.accepted.network, payer: this.address, asset: challenge.accepted.asset, amount: challenge.accepted.amount,
      });
      return { settlement, data: (paidBody as { data: T }).data };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Payment request failed';
      if (canRelease) {
        try { await this.budget.release(reservation); }
        catch { throw new Error(`${message}. Budget reservation could not be released and remains counted`); }
        throw error;
      }
      let transactionHash: string | undefined;
      try {
        const response = decodePaymentHeader(paidResponse?.headers.get('PAYMENT-RESPONSE') ?? null) as Record<string, unknown>;
        if (response.network === challenge.accepted.network && isTransactionHash(response.transaction) &&
            paymentAddress(response.payer) === this.address) transactionHash = response.transaction;
      } catch { /* An absent or invalid receipt is not evidence of a failed transfer. */ }
      throw new RelayPaymentError(message, paidResponse?.status, transactionHash);
    }
  }

  public readonly crypto = {
    price: (assets: string[] = ['ethereum', 'bitcoin'], vsCurrency = 'usd') =>
      this.call('/v1/crypto/price', { assets, vsCurrency }),
    market: (assets: string[] = ['ethereum', 'bitcoin']) => this.call('/v1/crypto/market', { assets }),
  };

  public readonly academic = {
    search: (query: string, limit = 5) => this.call('/v1/academic/search', { query, limit }),
    work: (doi: string) => this.call('/v1/academic/work', { doi }),
  };

  public readonly fx = {
    rates: (baseCurrency = 'USD', targets: string[] = ['EUR', 'GBP', 'JPY']) =>
      this.call('/v1/fx/rates', { baseCurrency, targets }),
  };

  public readonly weather = {
    forecast: (latitude: number, longitude: number) => this.call('/v1/weather', { latitude, longitude }),
  };

  public readonly geocode = {
    search: (query: string) => this.call('/v1/geocode', { query }),
  };

  public readonly holidays = {
    list: (countryCode: string, year = new Date().getUTCFullYear()) => this.call('/v1/holidays', { countryCode, year }),
  };

  public readonly news = { search: (query: string) => this.call('/v1/news/search', { query }) };
  public readonly knowledge = { search: (query: string) => this.call('/v1/knowledge/search', { query }) };
  public readonly research = { pack: (topic: string) => this.call('/v1/research', { topic }) };
  public readonly verify = { claim: (claim: string) => this.call('/v1/verify', { claim }) };
}
