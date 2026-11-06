import { randomUUID } from 'node:crypto';
import { mkdir, open, lstat, readFile, rename, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  emptyBudgetLedger, finishBudget, reserveBudget, validateBudgetLedger,
  type BudgetLedger, type BudgetRequest, type BudgetReservation, type PaymentBudgetStore,
} from '../sdk/budgetStore';

export const DEFAULT_MCP_BUDGET_FILE = join(homedir(), '.relay', 'mcp-budget.json');

/** Node-only persistence. A crash leaves its lock in place rather than risking a budget reset. */
export class FileBudgetStore implements PaymentBudgetStore {
  private queue: Promise<void> = Promise.resolve();
  readonly filePath: string;

  constructor(filePath = DEFAULT_MCP_BUDGET_FILE) {
    if (!isAbsolute(filePath)) throw new Error('RELAY_BUDGET_FILE must be an absolute path outside the repository');
    const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
    const withinProject = relative(projectRoot, filePath);
    if (!withinProject || (!withinProject.startsWith(`..${sep}`) && withinProject !== '..' && !isAbsolute(withinProject))) {
      throw new Error('RELAY_BUDGET_FILE must be outside the repository, not in tracked source');
    }
    this.filePath = filePath;
  }

  reserve(request: BudgetRequest): Promise<BudgetReservation> {
    return this.update(ledger => reserveBudget(ledger, request));
  }

  commit(reservation: BudgetReservation): Promise<void> {
    return this.update(ledger => finishBudget(ledger, reservation, true));
  }

  release(reservation: BudgetReservation): Promise<void> {
    return this.update(ledger => finishBudget(ledger, reservation, false));
  }

  private update<T>(mutate: (ledger: BudgetLedger) => T): Promise<T> {
    const operation = this.queue.then(() => this.withLock(mutate));
    this.queue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  private async withLock<T>(mutate: (ledger: BudgetLedger) => T): Promise<T> {
    const directory = dirname(this.filePath);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const lockPath = `${this.filePath}.lock`;
    let lock;
    try { lock = await open(lockPath, 'wx', 0o600); }
    catch {
      throw new Error('MCP budget file is locked or unavailable; payments are disabled. Reconcile outstanding authorizations before manually recovering the lock.');
    }
    try {
      await lock.writeFile(JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }));
      await lock.sync();
      let ledger: BudgetLedger;
      try {
        const stat = await lstat(this.filePath);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 10 * 1024 * 1024) {
          throw new Error('MCP budget file is not a regular, bounded ledger; payments are disabled');
        }
        const data: unknown = JSON.parse(await readFile(this.filePath, 'utf8'));
        validateBudgetLedger(data);
        ledger = data;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw new Error('MCP budget file is corrupt or unreadable; payments are disabled. Do not reset it without reconciling outstanding authorizations.');
        }
        ledger = emptyBudgetLedger();
      }
      const result = mutate(ledger);
      const temporary = `${this.filePath}.${randomUUID()}.tmp`;
      let created = false;
      try {
        const file = await open(temporary, 'wx', 0o600);
        created = true;
        try {
          await file.writeFile(`${JSON.stringify(ledger)}\n`, 'utf8');
          await file.sync();
        } finally { await file.close(); }
        await rename(temporary, this.filePath);
        created = false;
        // On POSIX also persist the directory entry. Windows does not support directory fsync.
        if (process.platform !== 'win32') {
          const parent = await open(directory, 'r');
          try { await parent.sync(); } finally { await parent.close(); }
        }
      } finally {
        if (created) await unlink(temporary).catch(() => undefined);
      }
      return result;
    } finally {
      await lock.close();
      await unlink(lockPath);
    }
  }
}
