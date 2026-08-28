import type Stripe from 'stripe';
import type { IInvoiceRepository } from '../../../core/domain/billing/invoiceRepository';
import { getOrgBillingState } from '@/src/infrastructure/billing/orgBilling';
import { getStripeClient, isStripeConfigured } from './stripeBillingClient';
import { formatPaymentMethodLabel, mapStripeInvoice } from './stripeInvoiceMapper';

/**
 * Stripe-backed IInvoiceRepository. Owns ALL Stripe knowledge: fetches raw
 * invoices + the customer's default payment method, then maps to domain
 * BillingInvoice objects. Domain/application never see a Stripe type.
 */
export function createStripeInvoiceRepository(): IInvoiceRepository {
  return {
    isConfigured: () => isStripeConfigured(),

    async getCustomerId(orgId) {
      const billing = await getOrgBillingState(orgId);
      return billing?.stripeCustomerId ?? null;
    },

    async listInvoices(customerId, limit) {
      const stripe = getStripeClient();
      const [result, customer] = await Promise.all([
        stripe.invoices.list({
          customer: customerId,
          limit,
          expand: ['data.default_payment_method'],
        }),
        stripe.customers.retrieve(customerId, {
          expand: ['invoice_settings.default_payment_method'],
        }),
      ]);

      let fallbackPaymentMethodLabel: string | null = null;
      if (!customer.deleted) {
        fallbackPaymentMethodLabel = formatPaymentMethodLabel(
          customer.invoice_settings?.default_payment_method as
            | Stripe.PaymentMethod
            | string
            | null
            | undefined,
        );
      }

      return result.data.map((inv) => mapStripeInvoice(inv, { fallbackPaymentMethodLabel }));
    },
  };
}
