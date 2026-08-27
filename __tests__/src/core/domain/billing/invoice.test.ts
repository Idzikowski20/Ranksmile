import {
  mapInvoiceStatus,
  groupInvoicesByDate,
  type BillingInvoice,
} from '../../../../../src/core/domain/billing/invoice';

describe('billing invoice domain', () => {
  it('maps known statuses through and unknown to "unknown"', () => {
    expect(mapInvoiceStatus('paid')).toBe('paid');
    expect(mapInvoiceStatus('uncollectible')).toBe('uncollectible');
    expect(mapInvoiceStatus('weird')).toBe('unknown');
    expect(mapInvoiceStatus(null)).toBe('unknown');
  });

  it('groups invoices into date buckets', () => {
    const mk = (id: string, createdAt: string) => ({ id, createdAt } as BillingInvoice);
    const today = new Date();
    const groups = groupInvoicesByDate([mk('a', today.toISOString())], today);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('Today');
    expect(groups[0].invoices[0].id).toBe('a');
  });
});
