import type { BillingPeriod } from './billingPlans';
import db from '../database/database';
import {
  BillingSource,
  captureBillingStack,
  decideBillingChange,
  emitBillingEvent,
  ensureCorrelationId,
  isEntitledStatus,
  type BillingAuditContext,
} from './billingAudit';
import { ensureBillingTables } from './ensureBillingTables';
import { queryOne } from './db/query';
import type { LegacyPlanSlug } from './stripePrices';

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused';

export interface OrgBillingState {
  orgId: number;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  planSlug: LegacyPlanSlug | null;
  billingPeriod: BillingPeriod | null;
  subscriptionStatus: SubscriptionStatus | null;
  trialEndsAt: string | null;
  /** Set once a Growth trial has been started — never cleared on cancel. */
  trialConsumedAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  lastCheckoutStartedAt: string | null;
  starterNudgeSentAt: string | null;
  paymentFailedLockedAt: string | null;
  paymentFailedInvoiceId: string | null;
  paymentFailedSubscriptionId: string | null;
  paymentFailedCustomerId: string | null;
  paymentLockLastEventCreatedAt: string | null;
  paymentLockLastEventId: string | null;
}

const TERMINAL_SUBSCRIPTION_STATUSES = new Set<SubscriptionStatus>([
  'canceled',
  'incomplete_expired',
]);

export function isTerminalSubscriptionStatus(
  status: SubscriptionStatus | null | undefined,
): boolean {
  return status != null && TERMINAL_SUBSCRIPTION_STATUSES.has(status);
}

export function hasNonTerminalStripeSubscription(
  billing: Pick<OrgBillingState, 'stripeSubscriptionId' | 'subscriptionStatus'> | null | undefined,
): boolean {
  if (!billing?.stripeSubscriptionId) return false;
  if (!billing.subscriptionStatus) return true;
  return !TERMINAL_SUBSCRIPTION_STATUSES.has(billing.subscriptionStatus);
}

type OrgBillingRow = {
  id: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan_slug: string | null;
  billing_period: string | null;
  subscription_status: string | null;
  trial_ends_at: string | null;
  trial_consumed_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: number | boolean | null;
  last_checkout_started_at: string | null;
  starter_nudge_sent_at: string | null;
  payment_failed_locked_at: string | null;
  payment_failed_invoice_id: string | null;
  payment_failed_subscription_id: string | null;
  payment_failed_customer_id: string | null;
  payment_lock_last_event_created_at: string | null;
  payment_lock_last_event_id: string | null;
};

function truthyFlag(v: number | boolean | null | undefined): boolean {
  return v === true || v === 1;
}

function mapRow(row: OrgBillingRow): OrgBillingState {
  const billingPeriod = row.billing_period === 'monthly' || row.billing_period === 'yearly'
    ? row.billing_period
    : null;
  const planSlug = row.plan_slug === 'starter'
    || row.plan_slug === 'growth'
    || row.plan_slug === 'scale'
    || row.plan_slug === 'agency'
    ? row.plan_slug
    : null;
  const subscriptionStatus = row.subscription_status as SubscriptionStatus | null;

  return {
    orgId: row.id,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    planSlug,
    billingPeriod,
    subscriptionStatus,
    trialEndsAt: row.trial_ends_at,
    trialConsumedAt: row.trial_consumed_at,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: truthyFlag(row.cancel_at_period_end),
    lastCheckoutStartedAt: row.last_checkout_started_at,
    starterNudgeSentAt: row.starter_nudge_sent_at,
    paymentFailedLockedAt: row.payment_failed_locked_at ?? null,
    paymentFailedInvoiceId: row.payment_failed_invoice_id,
    paymentFailedSubscriptionId: row.payment_failed_subscription_id,
    paymentFailedCustomerId: row.payment_failed_customer_id,
    paymentLockLastEventCreatedAt: row.payment_lock_last_event_created_at,
    paymentLockLastEventId: row.payment_lock_last_event_id,
  };
}

export async function getOrgBillingState(orgId: number): Promise<OrgBillingState | null> {
  await ensureBillingTables();
  const row = await queryOne<OrgBillingRow>(
    `SELECT id, stripe_customer_id, stripe_subscription_id, plan_slug, billing_period,
            subscription_status, trial_ends_at, trial_consumed_at, current_period_end,
            cancel_at_period_end, last_checkout_started_at, starter_nudge_sent_at,
            payment_failed_locked_at, payment_failed_invoice_id,
            payment_failed_subscription_id, payment_failed_customer_id,
            payment_lock_last_event_created_at, payment_lock_last_event_id
       FROM organizations WHERE id = ? LIMIT 1`,
    [orgId],
  );
  return row ? mapRow(row) : null;
}

export async function getOrgIdByStripeCustomerId(customerId: string): Promise<number | null> {
  await ensureBillingTables();
  const row = await queryOne<{ id: number }>(
    'SELECT id FROM organizations WHERE stripe_customer_id = ? LIMIT 1',
    [customerId],
  );
  return row ? Number(row.id) : null;
}

export async function claimTrialActivation(orgId: number, attemptId: string): Promise<boolean> {
  await ensureBillingTables();
  await db.query(
    `UPDATE organizations SET trial_activation_claim_id = ?
      WHERE id = ? AND trial_consumed_at IS NULL
        AND (trial_activation_claim_id IS NULL OR trial_activation_claim_id = ?)`,
    { replacements: [attemptId, orgId, attemptId] },
  );
  const row = await queryOne<{ trial_activation_claim_id: string | null }>(
    'SELECT trial_activation_claim_id FROM organizations WHERE id = ? LIMIT 1',
    [orgId],
  );
  return row?.trial_activation_claim_id === attemptId;
}

export interface OrgBillingPatch {
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  planSlug?: LegacyPlanSlug | null;
  billingPeriod?: BillingPeriod | null;
  subscriptionStatus?: SubscriptionStatus | null;
  trialEndsAt?: Date | null;
  trialConsumedAt?: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean | null;
  lastCheckoutStartedAt?: Date | null;
  starterNudgeSentAt?: Date | null;
}

export async function updateOrgBillingState(
  orgId: number,
  patch: OrgBillingPatch,
  audit: BillingAuditContext,
): Promise<void> {
  await ensureBillingTables();

  const before = await getOrgBillingState(orgId);
  const oldPlan = before?.planSlug ?? null;
  const oldStatus = before?.subscriptionStatus ?? null;

  const planTouched = patch.planSlug !== undefined;
  const statusTouched = patch.subscriptionStatus !== undefined;
  const { changed, decision } = decideBillingChange({
    oldPlan,
    newPlan: patch.planSlug,
    oldStatus,
    newStatus: patch.subscriptionStatus,
    planTouched,
    statusTouched,
  });

  const sets: string[] = ['updated_at = CURRENT_TIMESTAMP'];
  const replacements: unknown[] = [];

  if (patch.stripeCustomerId !== undefined) {
    sets.push('stripe_customer_id = ?');
    replacements.push(patch.stripeCustomerId);
  }
  if (patch.stripeSubscriptionId !== undefined) {
    sets.push('stripe_subscription_id = ?');
    replacements.push(patch.stripeSubscriptionId);
  }
  if (patch.planSlug !== undefined) {
    sets.push('plan_slug = ?');
    replacements.push(patch.planSlug);
  }
  if (patch.billingPeriod !== undefined) {
    sets.push('billing_period = ?');
    replacements.push(patch.billingPeriod);
  }
  if (patch.subscriptionStatus !== undefined) {
    sets.push('subscription_status = ?');
    replacements.push(patch.subscriptionStatus);
  }
  if (patch.trialEndsAt !== undefined) {
    sets.push('trial_ends_at = ?');
    replacements.push(patch.trialEndsAt ? patch.trialEndsAt.toISOString() : null);
  }
  if (patch.trialConsumedAt !== undefined) {
    if (patch.trialConsumedAt === null) {
      sets.push('trial_consumed_at = NULL');
    } else {
      // Never overwrite an earlier consumption timestamp.
      sets.push('trial_consumed_at = COALESCE(trial_consumed_at, ?)');
      replacements.push(patch.trialConsumedAt.toISOString());
    }
  }
  if (patch.currentPeriodEnd !== undefined) {
    sets.push('current_period_end = ?');
    replacements.push(patch.currentPeriodEnd ? patch.currentPeriodEnd.toISOString() : null);
  }
  if (patch.cancelAtPeriodEnd !== undefined) {
    sets.push('cancel_at_period_end = ?');
    replacements.push(patch.cancelAtPeriodEnd ? 1 : 0);
  }
  if (patch.lastCheckoutStartedAt !== undefined) {
    sets.push('last_checkout_started_at = ?');
    replacements.push(patch.lastCheckoutStartedAt ? patch.lastCheckoutStartedAt.toISOString() : null);
  }
  if (patch.starterNudgeSentAt !== undefined) {
    sets.push('starter_nudge_sent_at = ?');
    replacements.push(patch.starterNudgeSentAt ? patch.starterNudgeSentAt.toISOString() : null);
  }

  replacements.push(orgId);
  await db.query(`UPDATE organizations SET ${sets.join(', ')} WHERE id = ?`, { replacements });

  const correlationId = ensureCorrelationId(audit.correlationId);
  const newPlan = planTouched ? (patch.planSlug ?? null) : oldPlan;
  const newStatus = statusTouched ? (patch.subscriptionStatus ?? null) : oldStatus;
  const subId = patch.stripeSubscriptionId !== undefined
    ? patch.stripeSubscriptionId
    : (audit.stripeSubscriptionId ?? before?.stripeSubscriptionId ?? null);

  if (changed && (planTouched || statusTouched)) {
    await emitBillingEvent({
      kind: 'PLAN_CHANGED',
      source: audit.source,
      reason: audit.reason,
      decision,
      correlationId,
      orgId,
      actorUserId: audit.actorUserId ?? null,
      setupIntentId: audit.setupIntentId ?? null,
      stripeSubscriptionId: subId,
      oldPlanSlug: oldPlan,
      newPlanSlug: newPlan,
      oldStatus,
      newStatus,
      stack: captureBillingStack(),
      meta: audit.meta,
    });

    if (isEntitledStatus(newStatus) && !isEntitledStatus(oldStatus)) {
      await emitBillingEvent({
        kind: 'ENTITLEMENT_GRANTED',
        source: audit.source,
        reason: audit.reason,
        decision: 'ALLOW',
        correlationId,
        orgId,
        actorUserId: audit.actorUserId ?? null,
        setupIntentId: audit.setupIntentId ?? null,
        stripeSubscriptionId: subId,
        oldPlanSlug: oldPlan,
        newPlanSlug: newPlan,
        oldStatus,
        newStatus,
        meta: audit.meta,
      });
    }
  }
  // No PLAN_CHANGED when nothing effectively changed (avoids SKIP spam in logs/ledger).
}
