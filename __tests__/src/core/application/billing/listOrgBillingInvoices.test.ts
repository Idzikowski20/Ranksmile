import { listOrgBillingInvoices } from '../../../../../src/core/application/billing/listOrgBillingInvoices';
import type { IInvoiceRepository } from '../../../../../src/core/domain/billing/invoiceRepository';
import type { BillingInvoice } from '../../../../../src/core/domain/billing/invoice';

// No jest.mock: the use-case touches only the injected port, so a plain fake
// exercises every business rule. That testability is the point of the split.

const oneInvoice = [{ id: 'in_1', status: 'paid' } as BillingInvoice];

function makeRepo(over: Partial<IInvoiceRepository> = {}): IInvoiceRepository {
  return {
    isConfigured: () => true,
    getCustomerId: async () => 'cus_123',
    listInvoices: async () => oneInvoice,
    ...over,
  };
}

describe('listOrgBillingInvoices use-case', () => {
  it('returns [] when Stripe is not configured (no repo reads)', async () => {
    const getCustomerId = jest.fn();
    const repo = makeRepo({ isConfigured: () => false, getCustomerId });
    expect(await listOrgBillingInvoices(repo, 42)).toEqual([]);
    expect(getCustomerId).not.toHaveBeenCalled();
  });

  it('returns [] when the org has no customer', async () => {
    const listInvoices = jest.fn();
    const repo = makeRepo({ getCustomerId: async () => null, listInvoices });
    expect(await listOrgBillingInvoices(repo, 42)).toEqual([]);
    expect(listInvoices).not.toHaveBeenCalled();
  });

  it('returns the repository invoices for a configured org with a customer', async () => {
    expect(await listOrgBillingInvoices(makeRepo(), 42)).toEqual(oneInvoice);
  });

  it('clamps the limit to [1, 100] before hitting the repository', async () => {
    const listInvoices = jest.fn(async () => [] as BillingInvoice[]);
    const repo = makeRepo({ listInvoices });
    await listOrgBillingInvoices(repo, 42, 9999);
    expect(listInvoices).toHaveBeenCalledWith('cus_123', 100);
    await listOrgBillingInvoices(repo, 42, 0);
    expect(listInvoices).toHaveBeenLastCalledWith('cus_123', 1);
  });
});
