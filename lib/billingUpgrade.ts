import type Stripe from 'stripe';
import {
  getCheckoutPlan,
  getLegacyCheckoutPlan,
  getPlanPeriodPrice,
  type BillingPeriod,
  type CheckoutPlan,
} from './billingPlans';
import { blocksNewPaidCheckout } from './billingPlanLock';
import type { OrgBillingState } from './orgBilling';
import type { LegacyPlanSlug, PlanSlug } from './stripePrices';
import { getStripePriceId } from './stripePrices';
import { clientSecretFromSubscriptionInvoice } from './stripeInvoiceClientSecret';

const PLAN_RANK: Record<string, number> = {
  starter: 0, // legacy — still below Growth for upgrade checks
  growth: 1,
  scale: 2,
  agency: 3,
};

function getBillingPlan(slug: string): CheckoutPlan | undefined {
  return getCheckoutPlan(slug) ?? getLegacyCheckoutPlan(slug);
}

export function planRank(slug: string): number | null {
  if (slug === 'starter' || slug === 'growth' || slug === 'scale' || slug === 'agency') {
    return PLAN_RANK[slug];
  }
  return null;
}

/** True when target is a higher plan tier, or same tier with a more expensive billing period. */
export function isPaidPlanUpgrade(
  fromSlug: string,
  fromBilling: BillingPeriod,
  toSlug: string,
  toBilling: BillingPeriod,
): boolean {
  const from = getBillingPlan(fromSlug);
  const to = getCheckoutPlan(toSlug);
  if (!from || !to) return false;
  const fromR = planRank(from.slug);
  const toR = planRank(to.slug);
  if (fromR == null || toR == null) return false;
  // Higher product tier always counts as upgrade (even yearly → monthly of a higher plan).
  if (toR > fromR) return true;
  if (toR < fromR) return false;
  // Same tier: only monthly → yearly (higher commitment / period total) is an "upgrade".
  return getPlanPeriodPrice(to, toBilling) > getPlanPeriodPrice(from, fromBilling);
}

/**
 * Allowed in-app subscription changes:
 * - higher plan tier (any billing period)
 * - same tier billing-period switch (monthly ↔ yearly)
 * Blocked: lower plan tier, or identical plan+period.
 */
export function isAllowedSubscriptionChange(
  fromSlug: string,
  fromBilling: BillingPeriod,
  toSlug: string,
  toBilling: BillingPeriod,
): boolean {
  if (fromSlug === toSlug && fromBilling === toBilling) return false;
  const from = getBillingPlan(fromSlug);
  const to = getCheckoutPlan(toSlug);
  if (!from || !to) return false;
  const fromR = planRank(from.slug);
  const toR = planRank(to.slug);
  if (fromR == null || toR == null) return false;
  if (toR < fromR) return false;
  return true;
}

export function assertCanUpgradeSubscription(
  billing: OrgBillingState | null,
  targetSlug: string,
  targetBilling: BillingPeriod,
): { ok: true; currentSlug: LegacyPlanSlug; currentBilling: BillingPeriod } | { ok: false; status: number; error: string } {
  if (!billing?.stripeSubscriptionId) {
    return { ok: false, status: 400, error: 'No active Stripe subscription to upgrade' };
  }
  if (!blocksNewPaidCheckout(billing.subscriptionStatus)) {
    return { ok: false, status: 409, error: 'Subscription is not eligible for upgrade' };
  }
  if (!billing.planSlug || !billing.billingPeriod) {
    return { ok: false, status: 409, error: 'Current plan is unknown; cannot upgrade' };
  }
  // Proration on an unpaid subscription would grant the higher plan before the debt is settled.
  if (
    billing.paymentFailedLockedAt != null
    || billing.subscriptionStatus === 'past_due'
    || billing.subscriptionStatus === 'unpaid'
  ) {
    return {
      ok: false,
      status: 409,
      error: 'Settle the outstanding invoice before changing your plan',
    };
  }
  if (billing.planSlug === targetSlug && billing.billingPeriod === targetBilling) {
    return { ok: false, status: 409, error: 'You are already on this plan' };
  }
  if (!isAllowedSubscriptionChange(billing.planSlug, billing.billingPeriod, targetSlug, targetBilling)) {
    return { ok: false, status: 409, error: 'Downgrades are not supported here. Contact support or use billing settings.' };
  }
  return { ok: true, currentSlug: billing.planSlug, currentBilling: billing.billingPeriod };
}

export type UpgradePreview = {
  currentPlanSlug: string;
  currentPlanName: string;
  currentPeriodPriceCents: number;
  targetPlanSlug: string;
  targetPlanName: string;
  targetPeriodPriceCents: number;
  /** Unused-time credit from current plan (positive number displayed as credit). */
  creditCents: number;
  /** Amount due today after proration (invoice total). */
  amountDueCents: number;
  currency: string;
  prorationDate: number;
};

function planPeriodPriceCents(plan: CheckoutPlan, billing: BillingPeriod): number {
  return Math.round(getPlanPeriodPrice(plan, billing) * 100);
}

function sumNegativeLineAmounts(lines: Stripe.InvoiceLineItem[]): number {
  let credit = 0;
  for (const line of lines) {
    if (line.amount < 0) credit += Math.abs(line.amount);
  }
  return credit;
}

export async function previewSubscriptionUpgrade(
  stripe: Stripe,
  args: {
    customerId: string;
    subscriptionId: string;
    targetPriceId: string;
    currentPlan: CheckoutPlan;
    currentBilling: BillingPeriod;
    targetPlan: CheckoutPlan;
    targetBilling: BillingPeriod;
  },
): Promise<UpgradePreview> {
  const subscription = await stripe.subscriptions.retrieve(args.subscriptionId);
  const itemId = subscription.items.data[0]?.id;
  if (!itemId) throw new Error('Subscription has no items');

  const prorationDate = Math.floor(Date.now() / 1000);
  const invoice = await stripe.invoices.createPreview({
    customer: args.customerId,
    subscription: args.subscriptionId,
    subscription_details: {
      items: [{ id: itemId, price: args.targetPriceId }],
      proration_behavior: 'create_prorations',
      proration_date: prorationDate,
    },
  });

  const lines = invoice.lines?.data ?? [];
  return {
    currentPlanSlug: args.currentPlan.slug,
    currentPlanName: args.currentPlan.name,
    currentPeriodPriceCents: planPeriodPriceCents(args.currentPlan, args.currentBilling),
    targetPlanSlug: args.targetPlan.slug,
    targetPlanName: args.targetPlan.name,
    targetPeriodPriceCents: planPeriodPriceCents(args.targetPlan, args.targetBilling),
    creditCents: sumNegativeLineAmounts(lines),
    amountDueCents: invoice.amount_due ?? invoice.total ?? 0,
    currency: invoice.currency ?? 'eur',
    prorationDate,
  };
}

export type UpgradeResult =
  | { status: 'upgraded'; subscriptionId: string }
  | { status: 'requires_payment'; subscriptionId: string; clientSecret: string; intentType: 'payment' };

export async function applySubscriptionUpgrade(
  stripe: Stripe,
  args: {
    orgId: number;
    userId: string;
    subscriptionId: string;
    targetPriceId: string;
    targetSlug: PlanSlug;
    targetBilling: BillingPeriod;
    prorationDate?: number;
  },
): Promise<{ subscription: Stripe.Subscription; result: UpgradeResult }> {
  const subscription = await stripe.subscriptions.retrieve(args.subscriptionId);
  const itemId = subscription.items.data[0]?.id;
  if (!itemId) throw new Error('Subscription has no items');

  // cancel_at_period_end is not allowed with payment_behavior=pending_if_incomplete
  // (Stripe pending-updates supported attributes). Clear it in a separate call first.
  if (subscription.cancel_at_period_end) {
    await stripe.subscriptions.update(args.subscriptionId, { cancel_at_period_end: false });
  }

  const updated = await stripe.subscriptions.update(args.subscriptionId, {
    items: [{ id: itemId, price: args.targetPriceId }],
    proration_behavior: 'always_invoice',
    ...(args.prorationDate ? { proration_date: args.prorationDate } : {}),
    payment_behavior: 'pending_if_incomplete',
    expand: ['latest_invoice.confirmation_secret'],
    metadata: {
      ...subscription.metadata,
      org_id: String(args.orgId),
      user_id: args.userId,
      plan_slug: args.targetSlug,
      billing_period: args.targetBilling,
      checkout_mode: 'upgrade',
    },
  });

  const secret = clientSecretFromSubscriptionInvoice(updated);
  if (secret && updated.pending_update) {
    return {
      subscription: updated,
      result: {
        status: 'requires_payment',
        subscriptionId: updated.id,
        clientSecret: secret.clientSecret,
        intentType: 'payment',
      },
    };
  }

  return {
    subscription: updated,
    result: { status: 'upgraded', subscriptionId: updated.id },
  };
}

export function resolveUpgradePriceId(slug: string, billing: BillingPeriod): string | null {
  const plan = getCheckoutPlan(slug);
  if (!plan) return null;
  return getStripePriceId(plan.slug as PlanSlug, billing);
}
