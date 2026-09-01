/**
 * Server billing observability — ledger writes. Import only from API / lib server paths.
 */
import db from '../database/database';
import { ensureBillingTables } from './ensureBillingTables';
import {
  ensureCorrelationId,
  isBillingAuditLogEnabled,
  type BillingEventPayload,
} from './billingAuditShared';

export {
  BillingSource,
  captureBillingStack,
  decideBillingChange,
  ensureCorrelationId,
  isBillingAuditLogEnabled,
  isEntitledStatus,
  newBillingCorrelationId,
  type BillingAuditContext,
  type BillingDecision,
  type BillingEventKind,
  type BillingEventPayload,
} from './billingAuditShared';

export async function emitBillingEvent(payload: BillingEventPayload): Promise<void> {
  const correlationId = ensureCorrelationId(payload.correlationId);
  const row = { ...payload, correlationId };

  if (isBillingAuditLogEnabled() && row.decision !== 'SKIP') {
    // eslint-disable-next-line no-console
    console.info('[BILLING_EVENT]', JSON.stringify({
      kind: row.kind,
      source: row.source,
      reason: row.reason,
      decision: row.decision,
      correlationId: row.correlationId,
      orgId: row.orgId ?? null,
      oldPlanSlug: row.oldPlanSlug ?? null,
      newPlanSlug: row.newPlanSlug ?? null,
      oldStatus: row.oldStatus ?? null,
      newStatus: row.newStatus ?? null,
      setupIntentId: row.setupIntentId ?? null,
      stripeSubscriptionId: row.stripeSubscriptionId ?? null,
      stack: row.stack ?? undefined,
      meta: row.meta ?? undefined,
    }));
  }

  try {
    await ensureBillingTables();
    await db.query(
      `INSERT INTO billing_activation_events (
         org_id, correlation_id, kind, source, reason, decision,
         old_plan_slug, new_plan_slug, old_status, new_status,
         stripe_subscription_id, stripe_setup_intent_id, actor_user_id, meta
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      {
        replacements: [
          row.orgId ?? null,
          row.correlationId,
          row.kind,
          row.source,
          row.reason,
          row.decision,
          row.oldPlanSlug ?? null,
          row.newPlanSlug ?? null,
          row.oldStatus ?? null,
          row.newStatus ?? null,
          row.stripeSubscriptionId ?? null,
          row.setupIntentId ?? null,
          row.actorUserId ?? null,
          row.meta || row.stack
            ? JSON.stringify({ ...(row.meta || {}), ...(row.stack ? { stack: row.stack } : {}) })
            : null,
        ],
      },
    );
  } catch (e) {
    console.warn('[billing-audit] ledger insert failed:', e instanceof Error ? e.message : e);
  }
}
