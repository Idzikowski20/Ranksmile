import {
  formatPaymentMethodLabel,
  mapStripeInvoice,
  type BillingInvoice,
} from '../../billing/billingInvoiceModel';
import type { InvoiceRepository } from '../../repositories/billing/invoiceRepository';

/**
 * Use-case layer: business rules for listing an org's invoices — gate on Stripe
 * being configured, require a customer, clamp the limit, map raw Stripe objects
 * to the {@link BillingInvoice} domain entity. Pure orchestration; all I/O goes
 * through the injected {@link InvoiceRepository}. See ARCHITECTURE.md.
 */
export async function listOrgBillingInvoices(
  repo: InvoiceRepository,
  orgId: number,
  limit = 40,
): Promise<BillingInvoice[]> {
  if (!repo.isConfigured()) return [];

  const customerId = await repo.getStripeCustomerId(orgId);
  if (!customerId) return [];

  const [invoices, defaultPaymentMethod] = await Promise.all([
    repo.listInvoices(customerId, Math.min(100, Math.max(1, limit))),
    repo.getDefaultPaymentMethod(customerId),
  ]);

  const fallbackPaymentMethodLabel = formatPaymentMethodLabel(defaultPaymentMethod);
  return invoices.map((inv) => mapStripeInvoice(inv, { fallbackPaymentMethodLabel }));
}
