import db from '../database/database';

let checked = false;
const isPostgres = !!process.env.DATABASE_URL;
const PK = isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
const BIG = isPostgres ? 'BIGINT' : 'INTEGER';
const NOW = 'CURRENT_TIMESTAMP';

function ignoreExisting(label: string, e: unknown): void {
  const m = String((e as { message?: string } | undefined)?.message ?? e ?? '');
  if (!/exist|duplicate|already/i.test(m)) console.warn(`[plan-quota] ${label} failed:`, m);
}

/** org_quota_balances + quota_reservations + usage_events */
export async function ensurePlanQuotaTables(): Promise<void> {
  if (checked) return;

  await db.query(`CREATE TABLE IF NOT EXISTS org_quota_balances (
    org_id ${BIG} NOT NULL,
    meter TEXT NOT NULL,
    period_key TEXT NOT NULL DEFAULT '_',
    used ${BIG} NOT NULL DEFAULT 0,
    reserved ${BIG} NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT ${NOW},
    PRIMARY KEY (org_id, meter, period_key)
  )`).catch((e) => ignoreExisting('org_quota_balances', e));

  await db.query(`CREATE TABLE IF NOT EXISTS quota_reservations (
    id ${PK},
    org_id ${BIG} NOT NULL,
    meter TEXT NOT NULL,
    period_key TEXT NOT NULL DEFAULT '_',
    quantity ${BIG} NOT NULL,
    status TEXT NOT NULL DEFAULT 'reserved',
    idempotency_key TEXT NOT NULL,
    ref_type TEXT,
    ref_id TEXT,
    user_id TEXT,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT ${NOW},
    updated_at TIMESTAMP DEFAULT ${NOW}
  )`).catch((e) => ignoreExisting('quota_reservations', e));

  try {
    await db.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_quota_reservations_org_idem ON quota_reservations (org_id, idempotency_key)',
    );
  } catch (e) { ignoreExisting('idx_quota_reservations_org_idem', e); }
  try {
    await db.query(
      'CREATE INDEX IF NOT EXISTS idx_quota_reservations_expires ON quota_reservations (status, expires_at)',
    );
  } catch (e) { ignoreExisting('idx_quota_reservations_expires', e); }

  await db.query(`CREATE TABLE IF NOT EXISTS usage_events (
    id ${PK},
    org_id ${BIG} NOT NULL,
    meter TEXT NOT NULL,
    period_key TEXT NOT NULL DEFAULT '_',
    event_type TEXT NOT NULL,
    quantity ${BIG} NOT NULL,
    idempotency_key TEXT NOT NULL,
    reservation_id ${BIG},
    ref_type TEXT,
    ref_id TEXT,
    user_id TEXT,
    plan_slug TEXT,
    created_at TIMESTAMP DEFAULT ${NOW}
  )`).catch((e) => ignoreExisting('usage_events', e));

  try {
    await db.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_events_org_idem_type ON usage_events (org_id, idempotency_key, event_type)',
    );
  } catch (e) { ignoreExisting('idx_usage_events_org_idem_type', e); }
  try {
    await db.query(
      'CREATE INDEX IF NOT EXISTS idx_usage_events_org_meter ON usage_events (org_id, meter, period_key)',
    );
  } catch (e) { ignoreExisting('idx_usage_events_org_meter', e); }

  checked = true;
}
