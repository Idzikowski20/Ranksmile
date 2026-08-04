/**
 * Billing domain events — SoT for “what happened”. Timeline is a projection.
 */
import db from '../../database/database';
import { ensureBillingTables } from '../ensureBillingTables';

export type BillingDomainEventType =
  | 'TRIAL_STARTED'
  | 'CARD_ADDED'
  | 'CARD_REMOVED'
  | 'DEFAULT_CHANGED'
  | 'SUBSCRIPTION_CREATED'
  | 'SUBSCRIPTION_RENEWED'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_RECOVERED';

export type BillingDomainEventSource =
  | 'manual'
  | 'webhook'
  | 'checkout'
  | 'portal'
  | 'reconcile';

export type BillingDomainEvent = {
  id: string;
  orgId: number;
  type: BillingDomainEventType;
  source: BillingDomainEventSource;
  at: string;
  payload: Record<string, unknown>;
};

export type TimelineItem = {
  type: BillingDomainEventType;
  source: BillingDomainEventSource;
  at: string;
  payload: Record<string, unknown>;
};

export async function ensureBillingDomainEventsTable(): Promise<void> {
  await ensureBillingTables();
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS billing_domain_events (
        id BIGSERIAL PRIMARY KEY,
        at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        org_id INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        source TEXT NOT NULL,
        payload TEXT
      )`);
  } catch (e) {
    const message = String((e as { message?: string } | undefined)?.message ?? e ?? '');
    if (!/exist|duplicate|already/i.test(message)) {
      console.warn('[billing] billing_domain_events create failed:', message);
    }
  }
  try {
    await db.query(
      'CREATE INDEX IF NOT EXISTS idx_billing_domain_events_org_at ON billing_domain_events(org_id, at DESC)',
    );
  } catch {
    /* ignore */
  }
}

export async function appendBillingDomainEvent(args: {
  orgId: number;
  type: BillingDomainEventType;
  source: BillingDomainEventSource;
  payload?: Record<string, unknown>;
}): Promise<void> {
  try {
    await ensureBillingDomainEventsTable();
    await db.query(
      `INSERT INTO billing_domain_events (org_id, event_type, source, payload)
       VALUES (?, ?, ?, ?)`,
      {
        replacements: [
          args.orgId,
          args.type,
          args.source,
          args.payload ? JSON.stringify(args.payload) : null,
        ],
      },
    );
  } catch (e) {
    console.warn('[billing-domain-events] append failed:', e instanceof Error ? e.message : e);
  }
}

export async function listBillingDomainEvents(
  orgId: number,
  limit = 40,
): Promise<BillingDomainEvent[]> {
  await ensureBillingDomainEventsTable();
  try {
    const [rows] = await db.query(
      `SELECT id, at, org_id, event_type, source, payload
       FROM billing_domain_events
       WHERE org_id = ?
       ORDER BY at DESC
       LIMIT ?`,
      { replacements: [orgId, Math.min(100, Math.max(1, limit))] },
    ) as [Array<Record<string, unknown>>, unknown];

    return (rows ?? []).map((r) => {
      let payload: Record<string, unknown> = {};
      if (typeof r.payload === 'string' && r.payload) {
        try {
          payload = JSON.parse(r.payload) as Record<string, unknown>;
        } catch {
          payload = {};
        }
      }
      return {
        id: String(r.id),
        orgId: Number(r.org_id),
        type: r.event_type as BillingDomainEventType,
        source: r.source as BillingDomainEventSource,
        at: r.at instanceof Date ? r.at.toISOString() : String(r.at),
        payload,
      };
    });
  } catch {
    return [];
  }
}

/** Timeline projection for snapshot — enums only, UI localizes. */
export function projectTimeline(events: BillingDomainEvent[]): TimelineItem[] {
  return events.map((e) => ({
    type: e.type,
    source: e.source,
    at: e.at,
    payload: e.payload,
  }));
}
