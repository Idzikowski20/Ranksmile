import type Stripe from 'stripe';
import {
  formatPaymentMethodLabel,
  groupInvoicesByDate,
  mapInvoiceStatus,
  mapStripeInvoice,
  type BillingInvoice,
} from '../../lib/billingInvoiceModel';

function inv(partial: Partial<BillingInvoice> & Pick<BillingInvoice, 'id' | 'createdAt'>): BillingInvoice {
  return {
    number: '#1',
    status: 'paid',
    statusLabel: 'Paid',
    currency: 'eur',
    totalCents: 1000,
    totalLabel: '€10.00',
    subtotalCents: 1000,
    subtotalLabel: '€10.00',
    taxCents: 0,
    taxLabel: '€0.00',
    createdLabel: 'Jan 1, 2026',
    periodStart: null,
    periodEnd: null,
    periodLabel: null,
    pdfUrl: null,
    hostedUrl: null,
    lines: [],
    paymentMethodLabel: null,
    ...partial,
  };
}

describe('billingInvoices', () => {
  it('maps stripe statuses', () => {
    expect(mapInvoiceStatus('paid')).toBe('paid');
    expect(mapInvoiceStatus('uncollectible')).toBe('uncollectible');
    expect(mapInvoiceStatus(null)).toBe('unknown');
  });

  it('groups invoices by relative date', () => {
    const now = new Date(2026, 7, 1, 12, 0, 0);
    const groups = groupInvoicesByDate(
      [
        inv({ id: 'a', createdAt: new Date(2026, 7, 1, 10, 0, 0).toISOString() }),
        inv({ id: 'b', createdAt: new Date(2026, 6, 31, 10, 0, 0).toISOString() }),
        inv({ id: 'c', createdAt: new Date(2026, 6, 15, 10, 0, 0).toISOString() }),
      ],
      now,
    );
    expect(groups.map((g) => g.label)).toEqual(['Today', 'Yesterday', '07/15/2026']);
    expect(groups[0].invoices.map((i) => i.id)).toEqual(['a']);
  });

  it('formats card payment method and prefers line period', () => {
    expect(formatPaymentMethodLabel({
      id: 'pm_1',
      object: 'payment_method',
      type: 'card',
      card: { brand: 'visa', last4: '4242' },
    } as Stripe.PaymentMethod)).toBe('VISA ····4242');

    const mapped = mapStripeInvoice({
      id: 'in_1',
      object: 'invoice',
      status: 'paid',
      number: '0001',
      currency: 'eur',
      total: 0,
      subtotal: 0,
      created: Math.floor(Date.UTC(2026, 7, 1) / 1000),
      period_start: Math.floor(Date.UTC(2026, 7, 1) / 1000),
      period_end: Math.floor(Date.UTC(2026, 7, 1) / 1000),
      invoice_pdf: null,
      hosted_invoice_url: null,
      default_payment_method: null,
      lines: {
        object: 'list',
        data: [{
          id: 'il_1',
          object: 'line_item',
          description: 'Free trial for 1 × Ranksmile Agency',
          quantity: 1,
          amount: 0,
          period: {
            start: Math.floor(Date.UTC(2026, 7, 1) / 1000),
            end: Math.floor(Date.UTC(2026, 7, 15) / 1000),
          },
        }],
        has_more: false,
        url: '',
      },
    } as Stripe.Invoice, { fallbackPaymentMethodLabel: 'VISA ····4242' });

    expect(mapped.paymentMethodLabel).toBe('VISA ····4242');
    expect(mapped.periodLabel).toContain('Aug 15');
    expect(mapped.lines[0].description).toContain('Ranksmile Agency');
  });
});

