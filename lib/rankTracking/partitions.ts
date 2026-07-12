import db from '../../database/database';
import { queryRows } from '../db/query';

const isPostgres = !!process.env.DATABASE_URL;
const RETENTION_MONTHS = 24;
const PARTITIONS_AHEAD = 2;

function monthKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}_${m}`;
}

function monthRange(d: Date): { from: string; to: string; name: string } {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const from = new Date(Date.UTC(y, m, 1)).toISOString();
  const to = new Date(Date.UTC(y, m + 1, 1)).toISOString();
  return { from, to, name: `rank_snapshots_${monthKey(d)}` };
}

/**
 * On Postgres, ensure monthly partition tables exist for current month + N ahead.
 * On SQLite / non-partitioned setups this is a no-op.
 */
export async function ensureSnapshotPartitionsAhead(): Promise<void> {
  if (!isPostgres) return;

  const parentExists = await queryRows<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = 'rank_snapshots_parent' AND n.nspname = 'public'
    ) AS exists`,
  );
  if (!parentExists[0]?.exists) {
    try {
      await db.query(`CREATE TABLE IF NOT EXISTS rank_snapshots_parent (
        LIKE rank_snapshots INCLUDING DEFAULTS INCLUDING CONSTRAINTS
      ) PARTITION BY RANGE (checked_at)`);
      await db.query(`ALTER TABLE rank_snapshots_parent ADD PRIMARY KEY (id, checked_at)`);
    } catch {
      return;
    }
  }

  const now = new Date();
  for (let i = 0; i <= PARTITIONS_AHEAD; i += 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    const { from, to, name } = monthRange(d);
    try {
      await db.query(
        `CREATE TABLE IF NOT EXISTS ${name} PARTITION OF rank_snapshots_parent
         FOR VALUES FROM ('${from}') TO ('${to}')`,
      );
    } catch {
      // Partition may already exist or parent not ready — retention still works on flat table
    }
  }
}

/** Delete snapshots older than retention window (works on flat rank_snapshots table). */
export async function pruneOldSnapshots(): Promise<number> {
  const cutoff = new Date();
  cutoff.setUTCMonth(cutoff.getUTCMonth() - RETENTION_MONTHS);
  const iso = cutoff.toISOString();
  const [, meta] = await db.query(
    'DELETE FROM rank_snapshots WHERE checked_at < ?',
    { replacements: [iso] },
  );
  const rowCount = typeof meta === 'number' ? meta : (meta as { rowCount?: number })?.rowCount ?? 0;
  return rowCount;
}

export const pruneOldSnapshotPartitions = pruneOldSnapshots;
