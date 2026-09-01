import type Stripe from 'stripe';
import type { BillingPeriod } from './billingPlans';
import { isPaidLikeStatus } from './billingEntitlement';
import {
  BillingSource,
  emitBillingEvent,
  ensureCorrelationId,
  type BillingAuditContext,
} from './billingAudit';
import {
  getOrgBillingState,
  isTerminalSubscriptionStatus,
  updateOrgBillingState,
  type SubscriptionStatus,
} from './orgBilling';
import { getPlanFromPriceId, type LegacyPlanSlug, type PlanSlug } from './stripePrices';

function toDate(unixSeconds: number | null | undefined): Date | null {
  if (!unixSeconds) return null;
  return new Date(unixSeconds * 1000);
}

function asSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  const known: SubscriptionStatus[] = [
    'trialing', 'active', 'past_due', 'canceled', 'unpaid',
    'incomplete', 'incomplete_expired', 'paused',
  ];
  return (known as string[]).includes(status) ? (status as SubscriptionStatus) : 'active';
}

function planFromMetadata(metadata: Stripe.Metadata | null | undefined): {
  slug: LegacyPlanSlug | null;
  billing: BillingPeriod | null;
} {
  const slug = metadata?.plan_slug;
  const billing = metadata?.billing_period;
  const validSlug = slug === 'starter' || slug === 'growth' || slug === 'scale' || slug === 'agency'
    ? slug
    : null;
  const validBilling = billing === 'monthly' || billing === 'yearly' ? billing : null;
  return { slug: validSlug, billing: validBilling };
}

/** Stripe may return Price as id string or expanded object. */
export function priceIdFromSubscriptionItem(
  subscription: Pick<Stripe.Subscription, 'items'>,
): string | null {
  const price = subscription.items?.data?.[0]?.price;
  if (!price) return null;
  if (typeof price === 'string') return price;
  return typeof price.id === 'string' ? price.id : null;
}

export function subscriptionHasDefaultPaymentMethod(subscription: Stripe.Subscription): boolean {
  return Boolean(subscription.default_payment_method);
}

/**
 * Stripe sets status=trialing as soon as trial_period_days is set — before SetupIntent
 * collects a card. Project that as incomplete locally until a PM is on the subscription.
 */
export function projectSubscriptionStatus(subscription: Stripe.Subscription): SubscriptionStatus {
  const status = asSubscriptionStatus(subscription.status);
  if (status === 'trialing' && !subscriptionHasDefaultPaymentMethod(subscription)) {
    return 'incomplete';
  }
  return status;
}

/** Plan entitlements only after PM/setup or charge succeeds — not on incomplete checkout. */
function mayGrantPlanSlug(status: SubscriptionStatus): boolean {
  return isPaidLikeStatus(status) || status === 'past_due' || status === 'unpaid';
}

export async function syncSubscriptionToOrg(
  orgId: number,
  subscription: Stripe.Subscription,
  fallback?: { slug?: LegacyPlanSlug | PlanSlug | null; billing?: BillingPeriod | null },
  audit?: BillingAuditContext,
): Promise<void> {
  const priceId = priceIdFromSubscriptionItem(subscription);
  const fromPrice = priceId ? getPlanFromPriceId(priceId) : null;
  const fromMeta = planFromMetadata(subscription.metadata);
  const rawStatus = asSubscriptionStatus(subscription.status);
  const subscriptionStatus = projectSubscriptionStatus(subscription);
  const correlationId = ensureCorrelationId(
    audit?.correlationId
    || subscription.metadata?.checkout_attempt_id
    || subscription.id,
  );
  const resolvedAudit: BillingAuditContext = {
    source: audit?.source ?? BillingSource.UNKNOWN,
    reason: audit?.reason ?? 'syncSubscriptionToOrg',
    correlationId,
    actorUserId: audit?.actorUserId,
    setupIntentId: audit?.setupIntentId || subscription.metadata?.setup_intent_id || undefined,
    stripeSubscriptionId: subscription.id,
    meta: {
      ...(audit?.meta || {}),
      stripeStatus: rawStatus,
      projectedStatus: subscriptionStatus,
    },
  };

  // A terminal event for a subscription the org no longer tracks must not wipe the current one.
  // create-subscription cancels dangling checkouts, so canceled/incomplete_expired webhooks for
  // old ids can land after the replacement subscription is already active.
  if (isTerminalSubscriptionStatus(subscriptionStatus)) {
    const current = await getOrgBillingState(orgId);
    if (current?.stripeSubscriptionId && current.stripeSubscriptionId !== subscription.id) {
      await emitBillingEvent({
        kind: 'SUBSCRIPTION_SYNCED',
        source: resolvedAudit.source,
        reason: `${resolvedAudit.reason}.stale_subscription_ignored`,
        decision: 'SKIP',
        correlationId,
        orgId,
        stripeSubscriptionId: subscription.id,
        setupIntentId: resolvedAudit.setupIntentId ?? null,
        newStatus: subscriptionStatus,
        meta: { ...resolvedAudit.meta, trackedSubscriptionId: current.stripeSubscriptionId },
      });
      return;
    }
  }

  // Basil+/dahlia: current_period_end lives on SubscriptionItem, not Subscription.
  const itemPeriodEnd = subscription.items?.data?.[0]?.current_period_end;
  const legacyPeriodEnd = (subscription as Stripe.Subscription & {
    current_period_end?: number | null;
  }).current_period_end;
  const periodEnd = (typeof itemPeriodEnd === 'number' && itemPeriodEnd > 0)
    ? itemPeriodEnd
    : legacyPeriodEnd;

  const patch: Parameters<typeof updateOrgBillingState>[1] = {
    stripeSubscriptionId: subscription.id,
    subscriptionStatus,
    trialEndsAt: toDate(subscription.trial_end),
    currentPeriodEnd: toDate(periodEnd),
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
  };

  // Hosted Checkout / webhook path: mark org trial as used once Stripe is truly trialing with a PM.
  if (subscriptionStatus === 'trialing') {
    patch.trialConsumedAt = new Date();
  }

  if (mayGrantPlanSlug(subscriptionStatus)) {
    // Only write when resolved — never wipe an existing plan_slug with null on lookup miss.
    const slug = fromPrice?.slug ?? fromMeta.slug ?? fallback?.slug ?? null;
    const period = fromPrice?.billing ?? fromMeta.billing ?? fallback?.billing ?? null;
    if (slug) patch.planSlug = slug;
    if (period) patch.billingPeriod = period;
  } else if (
    subscriptionStatus === 'incomplete'
    || subscriptionStatus === 'incomplete_expired'
    || subscriptionStatus === 'canceled'
  ) {
    // Clear premature / abandoned checkout entitlements (Stripe may already be "trialing").
    patch.planSlug = null;
    patch.billingPeriod = null;
  }

  const decision = mayGrantPlanSlug(subscriptionStatus)
    ? 'ALLOW'
    : (subscriptionStatus === 'incomplete' && rawStatus === 'trialing' ? 'SKIP' : 'ALLOW');

  await emitBillingEvent({
    kind: 'SUBSCRIPTION_SYNCED',
    source: resolvedAudit.source,
    reason: resolvedAudit.reason,
    decision,
    correlationId,
    orgId,
    stripeSubscriptionId: subscription.id,
    setupIntentId: resolvedAudit.setupIntentId ?? null,
    newStatus: subscriptionStatus,
    meta: resolvedAudit.meta,
  });

  await updateOrgBillingState(orgId, patch, resolvedAudit);

  const { ensureOrgQuotaBalances } = await import('./quota/ensureBalances');
  await ensureOrgQuotaBalances(orgId, { seedFromCounts: true });
}

export async function syncCheckoutSessionToOrg(
  orgId: number,
  session: Stripe.Checkout.Session,
  audit?: BillingAuditContext,
): Promise<void> {
  // Customer / subscription ids only — plan slug comes from syncSubscriptionToOrg
  // after the subscription is trialing/active (not from Checkout metadata alone).
  const patch: Parameters<typeof updateOrgBillingState>[1] = {};

  if (session.customer && typeof session.customer === 'string') {
    patch.stripeCustomerId = session.customer;
  }
  if (session.subscription && typeof session.subscription === 'string') {
    patch.stripeSubscriptionId = session.subscription;
  }

  if (Object.keys(patch).length) {
    await updateOrgBillingState(orgId, patch, {
      source: audit?.source ?? BillingSource.WEBHOOK_SUB,
      reason: audit?.reason ?? 'checkout.session.completed',
      correlationId: ensureCorrelationId(
        audit?.correlationId
        || session.metadata?.checkout_attempt_id
        || session.id,
      ),
      meta: audit?.meta,
    });
  }
}

export function orgIdFromMetadata(metadata: Stripe.Metadata | null | undefined): number | null {
  const raw = metadata?.org_id;
  if (!raw) return null;
  const orgId = Number(raw);
  return Number.isFinite(orgId) && orgId > 0 ? orgId : null;
}
