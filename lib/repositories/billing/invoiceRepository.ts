import type Stripe from 'stripe';
import { getOrgBillingState } from '../../orgBilling';
import { getStripe, isStripeConfigured } from '../../stripe';

/**
 * Repository layer: the ONLY place that talks to Stripe / the billing store for
 * invoices. Use-cases depend on this interface, never on Stripe directly, so
 * they can be unit-tested with an in-memory fake. See ARCHITECTURE.md.
 */
export interface InvoiceRepository {
  isConfigured(): boolean;
  getStripeCustomerId(orgId: number): Promise<string | null>;
  listInvoices(customerId: string, limit: number): Promise<Stripe.Invoice[]>;
  getDefaultPaymentMethod(customerId: string): Promise<Stripe.PaymentMethod | string | null>;
}

/** Concrete Stripe-backed implementation used in production. */
export function createStripeInvoiceRepository(): InvoiceRepository {
  return {
    isConfigured: () => isStripeConfigured(),

    async getStripeCustomerId(orgId) {
      const billing = await getOrgBillingState(orgId);
      return billing?.stripeCustomerId ?? null;
    },

    async listInvoices(customerId, limit) {
      const result = await getStripe().invoices.list({
        customer: customerId,
        limit,
        expand: ['data.default_payment_method'],
      });
      return result.data;
    },

    async getDefaultPaymentMethod(customerId) {
      const customer = await getStripe().customers.retrieve(customerId, {
        expand: ['invoice_settings.default_payment_method'],
      });
      if (customer.deleted) return null;
      return customer.invoice_settings?.default_payment_method ?? null;
    },
  };
}
