import type Stripe from 'stripe';
import type { BillingPeriod } from './billingPlans';
import { updateOrgBillingState, type SubscriptionStatus } from './orgBilling';
import { getPlanFromPriceId, type PlanSlug } from './stripePrices';

function toDate(unixSeconds: number | null | undefined): Date | null {
  if (!unixSeconds) return null;
  return new Date(unixSeconds * 1000);
}

function asSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case 'trialing':
    case 'active':
    case 'past_due':
    case 'canceled':
    case 'unpaid':
    case 'incomplete':
    case 'incomplete_expired':
    case 'paused':
      return status;
    default:
      return 'active';
  }
}

function planFromMetadata(metadata: Stripe.Metadata | null | undefined): {
  slug: PlanSlug | null;
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

export async function syncSubscriptionToOrg(
  orgId: number,
  subscription: Stripe.Subscription,
  fallback?: { slug?: PlanSlug | null; billing?: BillingPeriod | null },
): Promise<void> {
  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const fromPrice = priceId ? getPlanFromPriceId(priceId) : null;
  const fromMeta = planFromMetadata(subscription.metadata);

  const periodEnd = (subscription as Stripe.Subscription & { current_period_end?: number | null }).current_period_end;

  await updateOrgBillingState(orgId, {
    stripeSubscriptionId: subscription.id,
    planSlug: fromPrice?.slug ?? fromMeta.slug ?? fallback?.slug ?? null,
    billingPeriod: fromPrice?.billing ?? fromMeta.billing ?? fallback?.billing ?? null,
    subscriptionStatus: asSubscriptionStatus(subscription.status),
    trialEndsAt: toDate(subscription.trial_end),
    currentPeriodEnd: toDate(periodEnd),
  });

  const { ensureOrgQuotaBalances } = await import('./quota/ensureBalances');
  await ensureOrgQuotaBalances(orgId, { seedFromCounts: true });
}

export async function syncCheckoutSessionToOrg(
  orgId: number,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const meta = planFromMetadata(session.metadata);
  const patch: Parameters<typeof updateOrgBillingState>[1] = {};

  if (session.customer && typeof session.customer === 'string') {
    patch.stripeCustomerId = session.customer;
  }
  if (session.subscription && typeof session.subscription === 'string') {
    patch.stripeSubscriptionId = session.subscription;
  }
  if (meta.slug) patch.planSlug = meta.slug;
  if (meta.billing) patch.billingPeriod = meta.billing;

  await updateOrgBillingState(orgId, patch);
}

export function orgIdFromMetadata(metadata: Stripe.Metadata | null | undefined): number | null {
  const raw = metadata?.org_id;
  if (!raw) return null;
  const orgId = Number(raw);
  return Number.isFinite(orgId) && orgId > 0 ? orgId : null;
}
