import db from '../database/database';
import { ignoreExistingSchema } from './ignoreExistingSchema';

let checked = false;
const isPostgres = !!process.env.DATABASE_URL;
const PK = isPostgres ? 'BIGSERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
const BIG = isPostgres ? 'BIGINT' : 'INTEGER';
const TS = isPostgres ? 'TIMESTAMPTZ' : 'TIMESTAMP';
const NOW = 'CURRENT_TIMESTAMP';

const ignore = (label: string, e: unknown) => ignoreExistingSchema('email-outbox', label, e);

/** Durable email outbox — Postgres = source of truth for deliveries. */
export async function ensureNotificationEmailTables(): Promise<void> {
  if (checked) return;

  await db.query(`CREATE TABLE IF NOT EXISTS notification_email_jobs (
    id ${PK},
    idempotency_key TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    org_id ${BIG} NOT NULL,
    domain_id INTEGER NOT NULL,
    domain TEXT NOT NULL,
    to_email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    last_error TEXT,
    skip_reason TEXT,
    provider_msg_id TEXT,
    payload_json TEXT,
    next_attempt_at ${TS} NOT NULL DEFAULT ${NOW},
    created_at ${TS} NOT NULL DEFAULT ${NOW},
    updated_at ${TS} NOT NULL DEFAULT ${NOW},
    sent_at ${TS},
    dlq_at ${TS}
  )`).catch((e) => ignore('notification_email_jobs', e));

  try {
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_email_jobs_due
         ON notification_email_jobs(next_attempt_at, created_at)
         WHERE status IN ('queued', 'failed')`,
    );
  } catch (e) { ignore('idx_email_jobs_due', e); }

  try {
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_email_jobs_stale_running
         ON notification_email_jobs(updated_at)
         WHERE status = 'running'`,
    );
  } catch (e) { ignore('idx_email_jobs_stale_running', e); }

  checked = true;
}
