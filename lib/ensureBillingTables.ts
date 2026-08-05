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
    { sql: 'ALTER TABLE organizations ADD COLUMN cancel_at_period_end INTEGER DEFAULT 0', label: 'cancel_at_period_end' },
    { sql: 'ALTER TABLE organizations ADD COLUMN last_checkout_started_at TIMESTAMP', label: 'last_checkout_started_at' },
    { sql: 'ALTER TABLE organizations ADD COLUMN starter_nudge_sent_at TIMESTAMP', label: 'starter_nudge_sent_at' },
    { sql: 'ALTER TABLE organizations ADD COLUMN payment_failed_locked_at TIMESTAMP', label: 'payment_failed_locked_at' },
    { sql: 'ALTER TABLE organizations ADD COLUMN payment_failed_invoice_id TEXT', label: 'payment_failed_invoice_id' },
    { sql: 'ALTER TABLE organizations ADD COLUMN payment_failed_subscription_id TEXT', label: 'payment_failed_subscription_id' },
    { sql: 'ALTER TABLE organizations ADD COLUMN payment_failed_customer_id TEXT', label: 'payment_failed_customer_id' },
    { sql: 'ALTER TABLE organizations ADD COLUMN payment_lock_last_event_created_at TIMESTAMP', label: 'payment_lock_last_event_created_at' },
    { sql: 'ALTER TABLE organizations ADD COLUMN payment_lock_last_event_id TEXT', label: 'payment_lock_last_event_id' },
    // One free Growth trial per org — survives cancel / re-checkout.
    { sql: 'ALTER TABLE organizations ADD COLUMN trial_consumed_at TIMESTAMP', label: 'trial_consumed_at' },
    { sql: 'ALTER TABLE organizations ADD COLUMN trial_activation_claim_id TEXT', label: 'trial_activation_claim_id' },
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

  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS billing_activation_events (
        id BIGSERIAL PRIMARY KEY,
        at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        org_id INTEGER,
        correlation_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        source TEXT NOT NULL,
        reason TEXT NOT NULL,
        decision TEXT NOT NULL,
        old_plan_slug TEXT,
        new_plan_slug TEXT,
        old_status TEXT,
        new_status TEXT,
        stripe_subscription_id TEXT,
        stripe_setup_intent_id TEXT,
        actor_user_id TEXT,
        meta TEXT
      )`);
  } catch (e) {
    ignoreExisting('billing_activation_events', e);
  }

  try {
    await db.query(
      'CREATE INDEX IF NOT EXISTS idx_billing_activation_corr ON billing_activation_events(correlation_id)',
    );
  } catch (e) {
    ignoreExisting('idx_billing_activation_corr', e);
  }

  try {
    await db.query(
      'CREATE INDEX IF NOT EXISTS idx_billing_activation_org_at ON billing_activation_events(org_id, at)',
    );
  } catch (e) {
    ignoreExisting('idx_billing_activation_org_at', e);
  }
}
