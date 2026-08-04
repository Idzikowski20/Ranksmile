import type Stripe from 'stripe';
import { getCheckoutPlan } from './billingPlans';
import { formatPaymentMethodLabel } from './billingInvoiceModel';
import { getOrgBillingState } from './orgBilling';
import { getStripe, isStripeConfigured } from './stripe';
import { formatMoney } from './subscriptionFormat';
import { syncSubscriptionToOrg } from './stripeBillingSync';

export type ConfirmationLine = {
  id: string;
  title: string;
  detail: string;
  amountLabel: string;
};

export type BillingConfirmation = {
  orderId: string;
  title: string;
  subtitle: string;
  planName: string;
  billingPeriodLabel: string | null;
  isTrialing: boolean;
  billingName: string | null;
  addressLines: string[];
  nextBillingLabel: string | null;
  paymentMethodLabel: string | null;
  lines: ConfirmationLine[];
  subtotalLabel: string;
  taxLabel: string;
  taxRateLabel: string;
  totalLabel: string;
  receiptUrl: string | null;
  invoicePdfUrl: string | null;
};

export function formatConfirmationDateLabel(unixOrIso: number | string | null | undefined): string | null {
  if (unixOrIso == null || unixOrIso === '') return null;
  const date = typeof unixOrIso === 'number'
    ? new Date(unixOrIso * 1000)
    : new Date(unixOrIso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Next renewal / period end for confirmation UI.
 *
 * Do NOT use bare Invoice.period_end alone — Stripe docs note it can equal
 * period_start (same calendar day) when all invoice items land on one day.
 * Prefer: subscription item current_period_end → line.period.end → invoice.period_end.
 */
export function resolveNextBillingUnix(args: {
  isTrialing: boolean;
  trialEndsAt?: string | number | null;
  subscription?: Stripe.Subscription | null;
  invoice?: Stripe.Invoice | null;
}): number | string | null {
  if (args.isTrialing) {
    if (args.trialEndsAt != null && args.trialEndsAt !== '') return args.trialEndsAt;
    if (args.subscription?.trial_end) return args.subscription.trial_end;
  }

  const itemEnd = args.subscription?.items?.data?.[0]?.current_period_end;
  if (typeof itemEnd === 'number' && itemEnd > 0) return itemEnd;

  const legacySubEnd = (args.subscription as { current_period_end?: number | null } | null | undefined)
    ?.current_period_end;
  if (typeof legacySubEnd === 'number' && legacySubEnd > 0) return legacySubEnd;

  const linePeriod = args.invoice?.lines?.data?.find((l) => l.period?.end)?.period;
  if (linePeriod?.end) return linePeriod.end;

  if (args.invoice?.period_end) return args.invoice.period_end;
  return null;
}

/** Card label: subscription default PM first (save_default_payment_method=on_subscription), then invoice. */
export function resolvePaymentMethodLabel(args: {
  subscription?: Stripe.Subscription | null;
  invoice?: Stripe.Invoice | null;
}): string | null {
  const fromSub = formatPaymentMethodLabel(args.subscription?.default_payment_method);
  if (fromSub) return fromSub;
  const fromInv = formatPaymentMethodLabel(args.invoice?.default_payment_method);
  if (fromInv) return fromInv;
  return null;
}

function addressLinesFromCustomer(customer: Stripe.Customer | null): { name: string | null; lines: string[] } {
  if (!customer) return { name: null, lines: [] };
  const addr = customer.address;
  const lines: string[] = [];
  if (addr?.line1) lines.push(addr.line1);
  if (addr?.line2) lines.push(addr.line2);
  const cityLine = [addr?.city, addr?.postal_code].filter(Boolean).join(', ');
  if (cityLine) lines.push(cityLine);
  if (addr?.country) lines.push(addr.country);
  return { name: customer.name || customer.email || null, lines };
}

function fromInvoice(
  inv: Stripe.Invoice,
  opts: {
    isTrialing: boolean;
    planName?: string | null;
    periodLabel?: string | null;
    trialEndsAt?: string | number | null;
    subscription?: Stripe.Subscription | null;
  },
): BillingConfirmation {
  const currency = inv.currency || 'eur';
  const totalCents = inv.total ?? 0;
  const subtotalCents = inv.subtotal ?? totalCents;
  const taxCents = Math.max(0, totalCents - subtotalCents);
  const customer = typeof inv.customer === 'object' && inv.customer && !('deleted' in inv.customer && inv.customer.deleted)
    ? inv.customer as Stripe.Customer
    : null;
  const { name, lines: addressLines } = addressLinesFromCustomer(customer);

  const planDisplay = opts.planName ? `Ranksmile ${opts.planName}` : 'Ranksmile';
  const lines: ConfirmationLine[] = opts.isTrialing
    ? [{
      id: 'trial',
      title: `Free trial for 1 × ${planDisplay}`,
      detail: 'Quantity: 1',
      amountLabel: formatMoney(0, currency),
    }]
    : (inv.lines?.data ?? []).slice(0, 6).map((line) => ({
      id: line.id,
      title: line.description || opts.planName || 'Subscription',
      detail: `Quantity: ${line.quantity ?? 1}`,
      amountLabel: formatMoney(line.amount ?? 0, currency),
    }));

  if (lines.length === 0) {
    lines.push({
      id: 'plan',
      title: opts.planName || 'Subscription',
      detail: opts.periodLabel || 'Plan',
      amountLabel: formatMoney(subtotalCents, currency),
    });
  }

  const orderId = inv.number || inv.id.slice(-10).toUpperCase();
  const nextBillingLabel = formatConfirmationDateLabel(resolveNextBillingUnix({
    isTrialing: opts.isTrialing,
    trialEndsAt: opts.trialEndsAt,
    subscription: opts.subscription,
    invoice: inv,
  }));

  return {
    orderId,
    title: opts.isTrialing ? 'Your trial is ready!' : 'Thank you for your order!',
    subtitle: opts.isTrialing
      ? 'Your Ranksmile trial is active — no charge today.'
      : "We've received your payment and activated your plan",
    planName: opts.planName || lines[0]?.title || 'Subscription',
    billingPeriodLabel: opts.periodLabel,
    isTrialing: opts.isTrialing,
    billingName: name,
    addressLines,
    nextBillingLabel,
    paymentMethodLabel: resolvePaymentMethodLabel({
      subscription: opts.subscription,
      invoice: inv,
    }),
    lines,
    subtotalLabel: formatMoney(subtotalCents, currency),
    taxLabel: formatMoney(taxCents, currency),
    taxRateLabel: 'TAX (23%)',
    totalLabel: formatMoney(totalCents, currency),
    receiptUrl: inv.hosted_invoice_url ?? null,
    invoicePdfUrl: inv.invoice_pdf ?? null,
  };
}

function fallbackConfirmation(
  planName: string,
  isTrialing: boolean,
  trialEndsAt?: string | null,
): BillingConfirmation {
  return {
    orderId: `RS-${Date.now().toString().slice(-8)}`,
    title: isTrialing ? 'Your trial is ready!' : 'Thank you for your order!',
    subtitle: isTrialing
      ? 'Your Ranksmile trial is active — no charge today.'
      : "We've received your payment and activated your plan",
    planName,
    billingPeriodLabel: null,
    isTrialing,
    billingName: null,
    addressLines: [],
    nextBillingLabel: isTrialing ? formatConfirmationDateLabel(trialEndsAt) : null,
    paymentMethodLabel: null,
    lines: [{
      id: 'plan',
      title: isTrialing ? `Free trial for 1 × Ranksmile ${planName}` : planName,
      detail: isTrialing ? 'Quantity: 1' : 'Subscription',
      amountLabel: isTrialing ? '€0.00' : '—',
    }],
    subtotalLabel: isTrialing ? '€0.00' : '—',
    taxLabel: '€0.00',
    taxRateLabel: 'TAX (23%)',
    totalLabel: isTrialing ? '€0.00' : '—',
    receiptUrl: null,
    invoicePdfUrl: null,
  };
}

async function loadSubscription(
  stripe: Stripe,
  subscriptionId: string,
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.retrieve(subscriptionId, {
    expand: [
      'default_payment_method',
      'latest_invoice',
      'latest_invoice.customer',
      'latest_invoice.default_payment_method',
      'items.data',
    ],
  });
}

function confirmationFromSubscription(
  sub: Stripe.Subscription,
  planName: string,
  periodLabel: string | null,
  billingTrialEndsAt: string | null,
): BillingConfirmation | null {
  const inv = sub.latest_invoice && typeof sub.latest_invoice !== 'string'
    ? sub.latest_invoice
    : null;
  if (!inv) return null;
  return fromInvoice(inv, {
    isTrialing: sub.status === 'trialing',
    planName,
    periodLabel,
    trialEndsAt: sub.trial_end ?? billingTrialEndsAt,
    subscription: sub,
  });
}

export async function getBillingConfirmation(
  orgId: number,
  opts?: {
    sessionId?: string | null;
    planSlug?: string | null;
    subscriptionId?: string | null;
  },
): Promise<BillingConfirmation> {
  const plan = opts?.planSlug ? getCheckoutPlan(opts.planSlug) : null;
  const planName = plan?.name ?? 'Ranksmile';

  if (!isStripeConfigured()) {
    return fallbackConfirmation(planName, false);
  }

  const stripe = getStripe();
  const billing = await getOrgBillingState(orgId);

  if (
    opts?.subscriptionId
    && billing?.stripeSubscriptionId
    && opts.subscriptionId !== billing.stripeSubscriptionId
  ) {
    throw new Error('SUBSCRIPTION_MISMATCH');
  }

  if (opts?.sessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(opts.sessionId, {
        expand: [
          'invoice',
          'invoice.default_payment_method',
          'invoice.customer',
          'subscription',
          'subscription.default_payment_method',
          'subscription.items.data',
        ],
      });
      if (session.subscription && typeof session.subscription !== 'string') {
        await syncSubscriptionToOrg(orgId, session.subscription);
      }
      const inv = session.invoice && typeof session.invoice !== 'string' ? session.invoice : null;
      const sub = session.subscription && typeof session.subscription !== 'string'
        ? session.subscription
        : null;
      if (inv) {
        return fromInvoice(inv, {
          isTrialing: sub?.status === 'trialing' || session.mode === 'setup',
          planName,
          periodLabel: plan ? `${plan.name} · ${session.metadata?.billing || 'monthly'}` : null,
          trialEndsAt: sub?.trial_end ?? billing?.trialEndsAt ?? null,
          subscription: sub,
        });
      }
    } catch {
      // fall through
    }
  }

  // Elements checkout (token path): load subscription — PM + current_period live there, not on invoice alone.
  const subscriptionId = opts?.subscriptionId || billing?.stripeSubscriptionId || null;
  if (subscriptionId) {
    try {
      const sub = await loadSubscription(stripe, subscriptionId);
      await syncSubscriptionToOrg(orgId, sub);
      const metaBilling = sub.metadata?.billing_period;
      const billingPeriod = metaBilling === 'yearly' || metaBilling === 'monthly'
        ? metaBilling
        : (billing?.billingPeriod ?? null);
      const displayPlanName = plan?.name
        || (billing?.planSlug ? getCheckoutPlan(billing.planSlug)?.name : null)
        || planName;
      const resolvedPeriodLabel = billingPeriod
        ? `${displayPlanName} · ${billingPeriod}`
        : null;
      const built = confirmationFromSubscription(
        sub,
        displayPlanName,
        resolvedPeriodLabel,
        billing?.trialEndsAt ?? null,
      );
      if (built) return built;
    } catch {
      // fall through to invoice list
    }
  }

  if (billing?.stripeCustomerId) {
    const list = await stripe.invoices.list({
      customer: billing.stripeCustomerId,
      limit: 1,
      expand: ['data.default_payment_method', 'data.customer'],
    });
    const inv = list.data[0];
    if (inv) {
      return fromInvoice(inv, {
        isTrialing: billing.subscriptionStatus === 'trialing',
        planName: planName !== 'Ranksmile' ? planName : (billing.planSlug ? getCheckoutPlan(billing.planSlug)?.name : null) || planName,
        periodLabel: billing.billingPeriod
          ? `${billing.planSlug ?? 'Plan'} · ${billing.billingPeriod}`
          : null,
        trialEndsAt: billing.trialEndsAt,
        subscription: null,
      });
    }
  }

  return fallbackConfirmation(
    (billing?.planSlug ? getCheckoutPlan(billing.planSlug)?.name : null) || planName,
    billing?.subscriptionStatus === 'trialing',
    billing?.trialEndsAt,
  );
}
