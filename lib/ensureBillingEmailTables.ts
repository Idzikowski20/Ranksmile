import db from '../database/database';
import { ignoreExistingSchema } from './ignoreExistingSchema';

let ready: Promise<void> | null = null;
const isPostgres = !!process.env.DATABASE_URL;
const PK = isPostgres ? 'BIGSERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
const BIG = isPostgres ? 'BIGINT' : 'INTEGER';
const TS = isPostgres ? 'TIMESTAMPTZ' : 'TIMESTAMP';

const ignore = (label: string, e: unknown) => ignoreExistingSchema('billing-email', label, e);

/** Claim-only billing email dedup ledger (delivery SoT = notification_email_jobs). */
export function ensureBillingEmailTables(): Promise<void> {
  if (!ready) {
    ready = runEnsure().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

async function runEnsure(): Promise<void> {
  await db.query(`CREATE TABLE IF NOT EXISTS billing_email_events (
    id ${PK},
    org_id ${BIG} NOT NULL,
    event_type TEXT NOT NULL,
    stripe_object_id TEXT NOT NULL,
    claimed_at ${TS} NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (org_id, event_type, stripe_object_id)
  )`).catch((e) => ignore('billing_email_events', e));

  try {
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_billing_email_events_org_type
         ON billing_email_events(org_id, event_type, claimed_at)`,
    );
  } catch (e) {
    ignore('idx_billing_email_events_org_type', e);
  }
}
