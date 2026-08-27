import type { BillingInvoice } from './billingInvoiceModel';
import { createStripeInvoiceRepository } from '../repositories/billing/invoiceRepository';
import { listOrgBillingInvoices as listOrgBillingInvoicesUseCase } from '../use-cases/billing/listOrgBillingInvoices';

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

/**
 * Public facade — unchanged signature, so existing callers and test mocks keep
 * working. Wires the Stripe repository into the use-case. New billing reads
 * should follow this repository → use-case → facade shape (see ARCHITECTURE.md).
 */
export function listOrgBillingInvoices(orgId: number, limit = 40): Promise<BillingInvoice[]> {
  return listOrgBillingInvoicesUseCase(createStripeInvoiceRepository(), orgId, limit);
}
