import db from '../database/database';

let ready: Promise<void> | null = null;

function ignoreExisting(label: string, e: unknown): void {
  const message = String((e as { message?: string } | undefined)?.message ?? e ?? '');
  if (!/exist|duplicate|already/i.test(message)) {
    console.warn(`[billing] ${label} failed:`, message);
  }
}

export function ensureBillingTables(): Promise<void> {
  if (!ready) {
    ready = runEnsureBillingTables().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

async function runEnsureBillingTables(): Promise<void> {
  const columns: Array<{ sql: string; label: string }> = [
    { sql: 'ALTER TABLE organizations ADD COLUMN stripe_customer_id TEXT', label: 'stripe_customer_id' },
    { sql: 'ALTER TABLE organizations ADD COLUMN stripe_subscription_id TEXT', label: 'stripe_subscription_id' },
    { sql: 'ALTER TABLE organizations ADD COLUMN plan_slug TEXT', label: 'plan_slug' },
    { sql: 'ALTER TABLE organizations ADD COLUMN billing_period TEXT', label: 'billing_period' },
    { sql: 'ALTER TABLE organizations ADD COLUMN subscription_status TEXT', label: 'subscription_status' },
    { sql: 'ALTER TABLE organizations ADD COLUMN trial_ends_at TIMESTAMP', label: 'trial_ends_at' },
    { sql: 'ALTER TABLE organizations ADD COLUMN current_period_end TIMESTAMP', label: 'current_period_end' },
  ];

  for (const column of columns) {
    try {
      await db.query(column.sql);
    } catch (e) {
      ignoreExisting(column.label, e);
    }
  }

  try {
    await db.query('CREATE INDEX IF NOT EXISTS idx_org_stripe_customer ON organizations(stripe_customer_id)');
  } catch (e) {
    ignoreExisting('idx_org_stripe_customer', e);
  }
}
