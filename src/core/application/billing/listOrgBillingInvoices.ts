import type { BillingInvoice } from '../../domain/billing/invoice';
import type { IInvoiceRepository } from '../../domain/billing/invoiceRepository';

/**
 * Use-case: list an org's billing invoices. Business rules only — gate on Stripe
 * being configured, require a customer, clamp the limit. All I/O + Stripe->domain
 * mapping is behind the injected repository (returns domain BillingInvoice[]),
 * so this is unit-testable with a plain in-memory fake. See ARCHITECTURE.md.
 */
export async function listOrgBillingInvoices(
  repo: IInvoiceRepository,
  orgId: number,
  limit = 40,
): Promise<BillingInvoice[]> {
  if (!repo.isConfigured()) return [];

  const customerId = await repo.getCustomerId(orgId);
  if (!customerId) return [];

  return repo.listInvoices(customerId, Math.min(100, Math.max(1, limit)));
}
