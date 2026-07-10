import type { BillingPeriod } from './billingPlans';
import { getCheckoutPlan, getPlanPeriodPrice } from './billingPlans';
import { getOrgBillingState, type OrgBillingState, type SubscriptionStatus } from './orgBilling';
import { resolvePlanSlug } from './planLimits';
import type { UpcomingPaymentDetails } from './subscriptionFormat';
import { getStripe, isStripeConfigured } from './stripe';
import { syncSubscriptionToOrg } from './stripeBillingSync';
import type { PlanSlug } from './stripePrices';
import type Stripe from 'stripe';

export type { UpcomingPaymentDetails };

export interface SubscriptionDetails {
  configured: boolean;
  hasStripeSubscription: boolean;
  planSlug: PlanSlug;
  planName: string;
  billingPeriod: BillingPeriod | null;
  subscriptionStatus: SubscriptionStatus | null;
  trialEndsAt: string | null;
  trialEndsAtLabel: string | null;
  currentPeriodEnd: string | null;
  currentPeriodEndLabel: string | null;
  cancelAtPeriodEnd: boolean;
  periodLabel: string | null;
  upcoming: UpcomingPaymentDetails | null;
  isTrialing: boolean;
}

const EU_TAX_RATE = 0.23;

function formatDateLabel(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return null;
  const diffMs = target - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

function formatPeriodLabel(
  cancelAtPeriodEnd: boolean,
  isTrialing: boolean,
  endIso: string | null,
): string | null {
  const days = daysUntil(endIso);
  if (days == null) return null;
  const unit = days === 1 ? 'day' : 'days';
  if (cancelAtPeriodEnd) return `Ends in ${days} ${unit}`;
  if (isTrialing) return `Trial ends in ${days} ${unit}`;
  return `Renews in ${days} ${unit}`;
}

function estimateUpcoming(
  planName: string,
  planSlug: PlanSlug,
  billingPeriod: BillingPeriod | null,
  renewalDate: string | null,
): UpcomingPaymentDetails | null {
  const plan = getCheckoutPlan(planSlug);
  if (!plan || !billingPeriod) return null;
  const net = getPlanPeriodPrice(plan, billingPeriod);
  const tax = Math.round(net * EU_TAX_RATE * 100) / 100;
  const total = net + tax;
  return {
    planName,
    planAmountCents: Math.round(net * 100),
    taxAmountCents: Math.round(tax * 100),
    taxLabel: 'TAX (23%)',
    totalAmountCents: Math.round(total * 100),
    currency: 'eur',
    renewalDate,
    renewalDateLabel: formatDateLabel(renewalDate),
  };
}

async function fetchStripeUpcoming(
  billing: OrgBillingState,
  planName: string,
  renewalDate: string | null,
): Promise<UpcomingPaymentDetails | null> {
  if (!billing.stripeCustomerId || !billing.stripeSubscriptionId || !isStripeConfigured()) {
    return null;
  }

  const stripe = getStripe();
  try {
    const preview = await stripe.invoices.createPreview({
      customer: billing.stripeCustomerId,
      subscription: billing.stripeSubscriptionId,
    });
    const invoice = preview as Stripe.Invoice;

    const currency = invoice.currency ?? 'eur';
    const totalAmountCents = invoice.total ?? 0;
    const subtotalCents = invoice.subtotal ?? totalAmountCents;
    const taxAmountCents = Math.max(0, totalAmountCents - subtotalCents);
    const planAmountCents = subtotalCents;

    let taxLabel: string | null = null;
    if (taxAmountCents > 0) taxLabel = 'TAX';

    const periodEndUnix = invoice.period_end ?? (invoice as Stripe.Invoice & { next_payment_attempt?: number | null }).next_payment_attempt;
    const renewalIso = periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : renewalDate;

    return {
      planName,
      planAmountCents,
      taxAmountCents,
      taxLabel,
      totalAmountCents,
      currency,
      renewalDate: renewalIso,
      renewalDateLabel: formatDateLabel(renewalIso),
    };
  } catch {
    return estimateUpcoming(planName, resolvePlanSlug(billing.planSlug), billing.billingPeriod, renewalDate);
  }
}

export async function getSubscriptionDetails(orgId: number): Promise<SubscriptionDetails> {
  let billing = await getOrgBillingState(orgId);
  const planSlug = resolvePlanSlug(billing?.planSlug);
  const plan = getCheckoutPlan(planSlug);
  const planName = plan?.name ?? 'Growth';

  let cancelAtPeriodEnd = false;
  let subscriptionStatus = billing?.subscriptionStatus ?? null;

  if (billing?.stripeSubscriptionId && isStripeConfigured()) {
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(billing.stripeSubscriptionId);
    cancelAtPeriodEnd = subscription.cancel_at_period_end;
    await syncSubscriptionToOrg(orgId, subscription);
    billing = await getOrgBillingState(orgId);
    subscriptionStatus = billing?.subscriptionStatus ?? subscriptionStatus;
  }

  const isTrialing = subscriptionStatus === 'trialing';
  const trialEndsAt = billing?.trialEndsAt ?? null;
  const currentPeriodEnd = billing?.currentPeriodEnd ?? trialEndsAt;
  const endLabel = formatDateLabel(isTrialing ? trialEndsAt : currentPeriodEnd);
  const periodLabel = formatPeriodLabel(cancelAtPeriodEnd, isTrialing, isTrialing ? trialEndsAt : currentPeriodEnd);

  const upcoming = cancelAtPeriodEnd
    ? null
    : (billing
      ? await fetchStripeUpcoming(billing, planName, isTrialing ? trialEndsAt : currentPeriodEnd)
      : null)
      ?? estimateUpcoming(
        planName,
        planSlug,
        billing?.billingPeriod ?? 'monthly',
        isTrialing ? trialEndsAt : currentPeriodEnd,
      );

  return {
    configured: isStripeConfigured(),
    hasStripeSubscription: !!billing?.stripeSubscriptionId,
    planSlug,
    planName,
    billingPeriod: billing?.billingPeriod ?? null,
    subscriptionStatus,
    trialEndsAt,
    trialEndsAtLabel: formatDateLabel(trialEndsAt),
    currentPeriodEnd,
    currentPeriodEndLabel: formatDateLabel(currentPeriodEnd),
    cancelAtPeriodEnd,
    periodLabel,
    upcoming,
    isTrialing,
  };
}
