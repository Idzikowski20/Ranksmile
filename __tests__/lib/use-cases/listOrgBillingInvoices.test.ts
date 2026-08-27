import type Stripe from 'stripe';
import { listOrgBillingInvoices } from '../../../lib/use-cases/billing/listOrgBillingInvoices';
import type { InvoiceRepository } from '../../../lib/repositories/billing/invoiceRepository';

// No jest.mock needed: the use-case only touches the injected repository, so a
// plain in-memory fake fully exercises its business rules. That testability is
// the point of the repository → use-case split (see ARCHITECTURE.md).

function fakeInvoice(id: string, created: number): Stripe.Invoice {
  return {
    id,
    created,
    currency: 'eur',
    total: 5900,
    subtotal: 5900,
    status: 'paid',
    number: '0001',
    lines: { data: [] },
    invoice_pdf: null,
    hosted_invoice_url: null,
    default_payment_method: null,
  } as unknown as Stripe.Invoice;
}

function makeRepo(over: Partial<InvoiceRepository> = {}): InvoiceRepository {
  return {
    isConfigured: () => true,
    getStripeCustomerId: async () => 'cus_123',
    listInvoices: async () => [fakeInvoice('in_1', 1_700_000_000)],
    getDefaultPaymentMethod: async () => null,
    ...over,
  };
}

describe('listOrgBillingInvoices use-case', () => {
  it('returns [] when Stripe is not configured (no repo reads)', async () => {
    const getCustomer = jest.fn();
    const repo = makeRepo({ isConfigured: () => false, getStripeCustomerId: getCustomer });
    expect(await listOrgBillingInvoices(repo, 42)).toEqual([]);
    expect(getCustomer).not.toHaveBeenCalled();
  });

  it('returns [] when the org has no Stripe customer', async () => {
    const list = jest.fn();
    const repo = makeRepo({ getStripeCustomerId: async () => null, listInvoices: list });
    expect(await listOrgBillingInvoices(repo, 42)).toEqual([]);
    expect(list).not.toHaveBeenCalled();
  });

  it('maps raw Stripe invoices to BillingInvoice entities', async () => {
    const result = await listOrgBillingInvoices(makeRepo(), 42);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'in_1', status: 'paid', totalLabel: expect.any(String) });
  });

  it('clamps the limit to [1, 100] before hitting the repository', async () => {
    const list = jest.fn(async () => []);
    const repo = makeRepo({ listInvoices: list });
    await listOrgBillingInvoices(repo, 42, 9999);
    expect(list).toHaveBeenCalledWith('cus_123', 100);
    await listOrgBillingInvoices(repo, 42, 0);
    expect(list).toHaveBeenLastCalledWith('cus_123', 1);
  });
});
