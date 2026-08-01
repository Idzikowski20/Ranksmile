import type { Transaction } from 'sequelize';
import db from '../../database/database';

const NS = 'rank-tracking-config';

function configKey(configId: number): number {
  return configId % 2147483647;
}

/** Transaction-scoped lock for one config. No-op on SQLite. */
export async function acquireConfigLock(configId: number, transaction: Transaction): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  await db.query('SELECT pg_advisory_xact_lock(hashtext(?), ?)', {
    replacements: [NS, configKey(configId)],
    transaction,
  });
}

/**
 * Non-blocking try-lock for cron parallelism across configs.
 * Returns false if another worker holds the lock (same config).
 * SQLite: always true (single-process).
 */
export async function tryAcquireConfigLock(configId: number): Promise<boolean> {
  if (!process.env.DATABASE_URL) return true;
  try {
    const rows = await db.query('SELECT pg_try_advisory_lock(hashtext(?), ?) AS ok', {
      replacements: [NS, configKey(configId)],
      type: 'SELECT' as unknown as undefined,
    }) as unknown as Array<{ ok: boolean | number }>;
    const row = Array.isArray(rows) ? rows[0] : undefined;
    const ok = row && (row as { ok?: boolean | number }).ok;
    return ok === true || ok === 1;
  } catch {
    return true;
  }
}

export async function releaseConfigLock(configId: number): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    await db.query('SELECT pg_advisory_unlock(hashtext(?), ?)', {
      replacements: [NS, configKey(configId)],
    });
  } catch {
    /* ignore */
  }
}
