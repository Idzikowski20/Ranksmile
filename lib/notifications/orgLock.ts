import type { Transaction } from 'sequelize';
import db from '../../database/database';

const INBOX_LOCK_NAMESPACE = 'inbox-sync';

export function orgKeyForLock(orgId: number): number {
  return orgId % 2147483647;
}

/** Serializes sync + mark-read per org. No-op on SQLite (single-process dev). */
export async function acquireInboxOrgLock(orgId: number, transaction: Transaction): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  await db.query('SELECT pg_advisory_xact_lock(hashtext(?), ?)', {
    replacements: [INBOX_LOCK_NAMESPACE, orgKeyForLock(orgId)],
    transaction,
  });
}
