import type { X402Network } from '../types/x402';
import { parseAtomicAmount, paymentAddress } from '../shared/paymentClient';

export interface BudgetRequest {
  account: string;
  network: X402Network;
  amount: string;
  dailyLimit: string;
}

export interface BudgetReservation {
  scope: string;
  id: string;
  amount: string;
}

export interface PaymentBudgetStore {
  reserve(request: BudgetRequest): Promise<BudgetReservation>;
  /** Permanently account for a signature before it can leave the client. */
  commit(reservation: BudgetReservation): Promise<void>;
  /** Only for local failures before a signature or payment request can be exposed. */
  release(reservation: BudgetReservation): Promise<void>;
}

interface BudgetDay {
  spent: string;
  pending: Record<string, string>;
}

export interface BudgetLedger {
  version: 1;
  days: Record<string, BudgetDay>;
}

export function emptyBudgetLedger(): BudgetLedger {
  return { version: 1, days: {} };
}

export function validateBudgetLedger(value: unknown): asserts value is BudgetLedger {
  const isObject = (input: unknown): input is Record<string, unknown> =>
    input !== null && typeof input === 'object' && !Array.isArray(input);
  if (!isObject(value) || value.version !== 1 || !isObject(value.days) ||
      Object.keys(value).some(key => key !== 'version' && key !== 'days')) {
    throw new Error('Budget file is corrupt or has an unsupported version; payments are disabled');
  }
  for (const [scope, day] of Object.entries(value.days)) {
    if (!/^0x[0-9a-f]{40}\|eip155:(8453|84532)\|\d{4}-\d{2}-\d{2}$/.test(scope) ||
        !isObject(day) || !isObject(day.pending) || Object.keys(day).some(key => key !== 'spent' && key !== 'pending')) {
      throw new Error('Budget file is corrupt; payments are disabled');
    }
    const [account, , date] = scope.split('|');
    paymentAddress(account);
    if (new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date) throw new Error('Budget file contains an invalid UTC day');
    let total = parseAtomicAmount(day.spent, 'recorded spending');
    for (const [id, amount] of Object.entries(day.pending)) {
      if (!/^0x[0-9a-f]{64}$/.test(id)) throw new Error('Budget file contains an invalid reservation');
      const units = parseAtomicAmount(amount, 'recorded reservation');
      if (units === 0n) throw new Error('Budget file contains an empty reservation');
      total += units;
    }
    parseAtomicAmount(total.toString(), 'recorded daily total');
  }
}

export function reserveBudget(ledger: BudgetLedger, request: BudgetRequest): BudgetReservation {
  const account = paymentAddress(request.account, 'budget account').toLowerCase();
  if (request.network !== 'eip155:8453' && request.network !== 'eip155:84532') throw new Error('Unsupported budget network');
  const amount = parseAtomicAmount(request.amount);
  const limit = parseAtomicAmount(request.dailyLimit, 'daily budget');
  if (amount === 0n || limit === 0n) throw new Error('Automatic payments are disabled by the daily budget');
  const scope = `${account}|${request.network}|${new Date().toISOString().slice(0, 10)}`;
  const day = ledger.days[scope] ?? { spent: '0', pending: {} };
  const total = Object.values(day.pending).reduce((sum, value) => sum + BigInt(value), BigInt(day.spent));
  if (total + amount > limit) throw new Error('Daily USDC budget exceeded (including pending or uncertain payments)');
  const random = new Uint8Array(32);
  if (!globalThis.crypto?.getRandomValues) throw new Error('Secure randomness is required for budget reservations');
  globalThis.crypto.getRandomValues(random);
  const id = `0x${Array.from(random, byte => byte.toString(16).padStart(2, '0')).join('')}`;
  if (Object.prototype.hasOwnProperty.call(day.pending, id)) throw new Error('Duplicate budget reservation');
  day.pending[id] = amount.toString();
  ledger.days[scope] = day;
  return Object.freeze({ scope, id, amount: amount.toString() });
}

export function finishBudget(ledger: BudgetLedger, reservation: BudgetReservation, commit: boolean): void {
  const day = ledger.days[reservation.scope];
  if (!day || !Object.prototype.hasOwnProperty.call(day.pending, reservation.id) || day.pending[reservation.id] !== reservation.amount) {
    throw new Error('Unknown or already finalized budget reservation; refusing to change spending');
  }
  if (commit) day.spent = (BigInt(day.spent) + BigInt(reservation.amount)).toString();
  delete day.pending[reservation.id];
}

/** Shared by default within this process; use a persistent store for restart-safe spending. */
export class MemoryBudgetStore implements PaymentBudgetStore {
  private readonly ledger = emptyBudgetLedger();

  async reserve(request: BudgetRequest): Promise<BudgetReservation> {
    // No await between checking and updating: concurrent calls reserve atomically.
    return reserveBudget(this.ledger, request);
  }

  async commit(reservation: BudgetReservation): Promise<void> {
    finishBudget(this.ledger, reservation, true);
  }

  async release(reservation: BudgetReservation): Promise<void> {
    finishBudget(this.ledger, reservation, false);
  }
}
