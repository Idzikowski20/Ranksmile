import type Stripe from 'stripe';
import { getCheckoutPlan } from './billingPlans';
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

function formatDateLabel(unix: number | null | undefined): string | null {
  if (!unix) return null;
  return new Date(unix * 1000).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
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

function cardLabelFromInvoice(inv: Stripe.Invoice | null): string | null {
  const pm = inv?.default_payment_method;
  if (pm && typeof pm !== 'string' && pm.card) {
    const brand = pm.card.brand ? pm.card.brand.charAt(0).toUpperCase() + pm.card.brand.slice(1) : 'Card';
    return `${brand} •••• ${pm.card.last4 ?? '••••'}`;
  }
  return null;
}

function fromInvoice(
  inv: Stripe.Invoice,
  opts: { isTrialing: boolean; planName?: string | null; periodLabel?: string | null },
): BillingConfirmation {
  const currency = inv.currency || 'eur';
  const totalCents = inv.total ?? 0;
  const subtotalCents = inv.subtotal ?? totalCents;
  const taxCents = Math.max(0, totalCents - subtotalCents);
  const customer = typeof inv.customer === 'object' && inv.customer && !('deleted' in inv.customer && inv.customer.deleted)
    ? inv.customer as Stripe.Customer
    : null;
  const { name, lines: addressLines } = addressLinesFromCustomer(customer);

  const lines: ConfirmationLine[] = (inv.lines?.data ?? []).slice(0, 6).map((line) => ({
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
    nextBillingLabel: formatDateLabel(inv.period_end),
    paymentMethodLabel: cardLabelFromInvoice(inv),
    lines,
    subtotalLabel: formatMoney(subtotalCents, currency),
    taxLabel: formatMoney(taxCents, currency),
    taxRateLabel: 'TAX (23%)',
    totalLabel: formatMoney(totalCents, currency),
    receiptUrl: inv.hosted_invoice_url ?? null,
    invoicePdfUrl: inv.invoice_pdf ?? null,
  };
}

function fallbackConfirmation(planName: string, isTrialing: boolean): BillingConfirmation {
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
    nextBillingLabel: null,
    paymentMethodLabel: null,
    lines: [{
      id: 'plan',
      title: planName,
      detail: isTrialing ? '7-day free trial' : 'Subscription',
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

export async function getBillingConfirmation(
  orgId: number,
  opts?: { sessionId?: string | null; planSlug?: string | null },
): Promise<BillingConfirmation> {
  const plan = opts?.planSlug ? getCheckoutPlan(opts.planSlug) : null;
  const planName = plan?.name ?? 'Ranksmile';

  if (!isStripeConfigured()) {
    return fallbackConfirmation(planName, false);
  }

  const stripe = getStripe();
  const billing = await getOrgBillingState(orgId);

  if (opts?.sessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(opts.sessionId, {
        expand: ['invoice', 'invoice.default_payment_method', 'invoice.customer', 'subscription'],
      });
      if (session.subscription && typeof session.subscription !== 'string') {
        await syncSubscriptionToOrg(orgId, session.subscription);
      }
      const inv = session.invoice && typeof session.invoice !== 'string' ? session.invoice : null;
      if (inv) {
        const sub = session.subscription && typeof session.subscription !== 'string' ? session.subscription : null;
        return fromInvoice(inv, {
          isTrialing: sub?.status === 'trialing' || session.mode === 'setup',
          planName,
          periodLabel: plan ? `${plan.name} · ${session.metadata?.billing || 'monthly'}` : null,
        });
      }
    } catch {
      // fall through to latest invoice
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
      });
    }
  }

  return fallbackConfirmation(
    (billing?.planSlug ? getCheckoutPlan(billing.planSlug)?.name : null) || planName,
    billing?.subscriptionStatus === 'trialing',
  );
}
