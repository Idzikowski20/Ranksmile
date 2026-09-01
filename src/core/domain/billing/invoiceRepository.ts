import type { BillingInvoice } from './invoice';

/**
 * Port for reading an org's invoices. Domain/application depend on this
 * interface only; the Stripe-backed implementation lives in
 * src/infrastructure/billing/stripe/stripeInvoiceRepository.ts and returns
 * domain BillingInvoice objects (all Stripe knowledge stays in infrastructure).
 */
export interface IInvoiceRepository {
  isConfigured(): boolean;
  getCustomerId(orgId: number): Promise<string | null>;
  listInvoices(customerId: string, limit: number): Promise<BillingInvoice[]>;
}
