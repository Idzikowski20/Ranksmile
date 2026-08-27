/**
 * Transitional facade — keeps the historical public surface (existing callers +
 * test mocks import from here) while the implementation now lives in the
 * clean-architecture layers under src/. New code should import directly from
 * src/core/domain (types, pure helpers), src/infrastructure (mapStripeInvoice),
 * and src/composition (listOrgBillingInvoices). See ARCHITECTURE.md.
 */
export type {
  BillingInvoice,
  BillingInvoiceLine,
  BillingInvoiceStatus,
  InvoiceDateGroup,
} from '../../src/core/domain/billing/invoice';
export { groupInvoicesByDate, mapInvoiceStatus } from '../../src/core/domain/billing/invoice';
export { mapStripeInvoice, formatPaymentMethodLabel } from '../../src/infrastructure/billing/stripe/stripeInvoiceMapper';
export { listOrgBillingInvoices } from '../../src/composition/billing';
