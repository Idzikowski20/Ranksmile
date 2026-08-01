import type Stripe from 'stripe';
import {
  formatPaymentMethodLabel,
  mapStripeInvoice,
  type BillingInvoice,
} from './billingInvoiceModel';
import { getOrgBillingState } from './orgBilling';
import { getStripe, isStripeConfigured } from './stripe';

export type {
  BillingInvoice,
  BillingInvoiceLine,
  BillingInvoiceStatus,
  InvoiceDateGroup,
} from './billingInvoiceModel';
export {
  groupInvoicesByDate,
  mapInvoiceStatus,
  mapStripeInvoice,
} from './billingInvoiceModel';

export async function listOrgBillingInvoices(orgId: number, limit = 40): Promise<BillingInvoice[]> {
  if (!isStripeConfigured()) return [];
  const billing = await getOrgBillingState(orgId);
  if (!billing?.stripeCustomerId) return [];

  const stripe = getStripe();
  const [result, customer] = await Promise.all([
    stripe.invoices.list({
      customer: billing.stripeCustomerId,
      limit: Math.min(100, Math.max(1, limit)),
      expand: ['data.default_payment_method'],
    }),
    stripe.customers.retrieve(billing.stripeCustomerId, {
      expand: ['invoice_settings.default_payment_method'],
    }),
  ]);

  let fallbackPm: string | null = null;
  if (!customer.deleted) {
    const pm = customer.invoice_settings?.default_payment_method;
    fallbackPm = formatPaymentMethodLabel(pm as Stripe.PaymentMethod | string | null | undefined);
  }

  return result.data.map((inv) => mapStripeInvoice(inv, { fallbackPaymentMethodLabel: fallbackPm }));
}
