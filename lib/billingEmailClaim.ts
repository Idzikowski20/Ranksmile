import type { Transaction } from 'sequelize';
import db from '../database/database';
import { ensureBillingEmailTables } from './ensureBillingEmailTables';
import { ensureNotificationEmailTables } from './ensureNotificationEmailTables';
import {
  EMAIL_MAX_ATTEMPTS,
  billingEmailIdempotencyKey,
  type BillingEmailEventType,
} from './notifications/emailTypes';

export type ClaimBillingEmailResult =
  | { claimed: true; dbJobId: number; idempotencyKey: string }
  | { claimed: false };

/**
 * Atomic claim + outbox insert. Delivery SoT = notification_email_jobs
 * (polled by email outbox reconciler — no BullMQ).
 */
export async function claimBillingEmailAndEnqueue(opts: {
  orgId: number;
  eventType: BillingEmailEventType;
  stripeObjectId: string;
  toEmail: string;
  payload: Record<string, unknown>;
}): Promise<ClaimBillingEmailResult> {
  await ensureBillingEmailTables();
  await ensureNotificationEmailTables();

  const idempotencyKey = billingEmailIdempotencyKey(
    opts.eventType,
    opts.orgId,
    opts.stripeObjectId,
  );

  return db.transaction(async (transaction: Transaction) => {
    const [claimRows] = await db.query(
      `INSERT INTO billing_email_events (org_id, event_type, stripe_object_id, claimed_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT (org_id, event_type, stripe_object_id) DO NOTHING
       RETURNING id`,
      {
        replacements: [opts.orgId, opts.eventType, opts.stripeObjectId],
        transaction,
      },
    );
    const claimed = (claimRows as Array<{ id: number }>)[0];
    if (!claimed) return { claimed: false as const };

    const [jobRows] = await db.query(
      `INSERT INTO notification_email_jobs (
         idempotency_key, type, org_id, domain_id, domain, to_email,
         status, attempts, max_attempts, payload_json,
         next_attempt_at, created_at, updated_at
       ) VALUES (?, ?, ?, 0, 'billing', ?, 'queued', 0, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING id`,
      {
        replacements: [
          idempotencyKey,
          opts.eventType,
          opts.orgId,
          opts.toEmail,
          EMAIL_MAX_ATTEMPTS,
          JSON.stringify(opts.payload),
        ],
        transaction,
      },
    );
    const job = (jobRows as Array<{ id: number }>)[0];
    if (!job) {
      // Claim won but job already existed (rare) — treat as not newly claimed for send path
      return { claimed: false as const };
    }
    return {
      claimed: true as const,
      dbJobId: Number(job.id),
      idempotencyKey,
    };
  });
}
