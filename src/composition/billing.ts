import type { BillingInvoice } from '../core/domain/billing/invoice';
import { listOrgBillingInvoices as runUseCase } from '../core/application/billing/listOrgBillingInvoices';
import { createStripeInvoiceRepository } from '../infrastructure/billing/stripe/stripeInvoiceRepository';

/**
 * Composition root for billing — the wiring edge (manual DI, no container).
 * Presentation (pages/api) imports only from here; it never sees the repository
 * implementation or the use-case's port parameter.
 */
export function listOrgBillingInvoices(orgId: number, limit = 40): Promise<BillingInvoice[]> {
  return runUseCase(createStripeInvoiceRepository(), orgId, limit);
}
