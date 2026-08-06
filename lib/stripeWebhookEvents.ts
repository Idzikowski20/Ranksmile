/**
 * Webhook dedup ledger. Stripe delivers at-least-once and retries a failed delivery
 * for up to three days, so the same event id can arrive many times.
 * @see https://docs.stripe.com/webhooks#handle-duplicate-events
 */
import type Stripe from 'stripe';
import db from '../database/database';
import { ensureBillingTables } from './ensureBillingTables';

/** False when the event was already processed — caller must ack and do nothing. */
export async function claimStripeEvent(event: Stripe.Event): Promise<boolean> {
  await ensureBillingTables();
  const [rows] = await db.query(
    `INSERT INTO stripe_webhook_events (event_id, event_type, event_created_at, processed_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT (event_id) DO NOTHING
     RETURNING event_id`,
    {
      replacements: [
        event.id,
        event.type,
        event.created ? new Date(event.created * 1000).toISOString() : null,
      ],
    },
  );
  return (rows as Array<{ event_id: string }>).length > 0;
}

/**
 * Drop the claim so Stripe's retry can reprocess. Call this whenever handling failed —
 * otherwise the retry is deduped away and the event is silently lost.
 */
export async function releaseStripeEvent(eventId: string): Promise<void> {
  await db.query('DELETE FROM stripe_webhook_events WHERE event_id = ?', {
    replacements: [eventId],
  });
}

/** Retention: Stripe stops retrying after 3 days, keep a wider window for debugging. */
export async function pruneStripeWebhookEvents(olderThanDays = 30): Promise<void> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
  await db.query('DELETE FROM stripe_webhook_events WHERE processed_at < ?', {
    replacements: [cutoff],
  });
}
