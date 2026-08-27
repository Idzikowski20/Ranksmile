import type Stripe from 'stripe';
import {
  formatPaymentMethodLabel,
  groupInvoicesByDate,
  mapInvoiceStatus,
  mapStripeInvoice,
  type BillingInvoice,
} from '../../lib/billing/billingInvoiceModel';

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

  // Inclusive VAT: Stripe leaves total == subtotal and puts the tax in total_taxes.
  // `total - subtotal` reads 0, which showed "Tax €0.00" on an invoice that actually
  // collected €11.03 of Polish VAT. The tax must come from total_taxes, and the shown
  // subtotal must be the net so the three lines still add up.
  it('reads inclusive VAT from total_taxes, not total minus subtotal', () => {
    const mapped = mapStripeInvoice({
      id: 'in_incl', object: 'invoice', status: 'paid', number: '0002', currency: 'eur',
      total: 5900, subtotal: 5900, subtotal_excluding_tax: 4797,
      total_taxes: [{ amount: 1103 }],
      created: Math.floor(Date.UTC(2026, 7, 15) / 1000),
      lines: { object: 'list', data: [], has_more: false, url: '' },
    } as unknown as Stripe.Invoice);

    expect(mapped.taxCents).toBe(1103);
    expect(mapped.subtotalCents).toBe(4797);
    expect(mapped.totalCents).toBe(5900);
    expect(mapped.subtotalCents + mapped.taxCents).toBe(mapped.totalCents);
  });

  // The line item must show net too, or a single €59.00 line sits over a €47.97
  // subtotal. Under inclusive tax the line carries its own inclusive tax, which is
  // subtracted; the lines then sum to the net subtotal.
  it('shows inclusive line items net, reconciling with the subtotal', () => {
    const mapped = mapStripeInvoice({
      id: 'in_incl_line', object: 'invoice', status: 'paid', number: '0005', currency: 'eur',
      total: 5900, subtotal: 5900, total_taxes: [{ amount: 1103 }],
      created: Math.floor(Date.UTC(2026, 7, 15) / 1000),
      lines: { object: 'list', has_more: false, url: '', data: [{
        id: 'il_incl', object: 'line_item', description: '1 × Growth', quantity: 1,
        amount: 5900,
        taxes: [{ amount: 1103, tax_behavior: 'inclusive' }],
      }] },
    } as unknown as Stripe.Invoice);

    expect(mapped.lines[0].amountCents).toBe(4797);
    expect(mapped.lines.reduce((s, l) => s + l.amountCents, 0)).toBe(mapped.subtotalCents);
  });

  // Exclusive line: tax sits on top of amount, so the line stays at its gross amount and
  // still equals the net subtotal.
  it('leaves exclusive line items at their amount', () => {
    const mapped = mapStripeInvoice({
      id: 'in_excl_line', object: 'invoice', status: 'paid', number: '0006', currency: 'eur',
      total: 7257, subtotal: 5900, total_taxes: [{ amount: 1357 }],
      created: Math.floor(Date.UTC(2026, 7, 15) / 1000),
      lines: { object: 'list', has_more: false, url: '', data: [{
        id: 'il_excl', object: 'line_item', description: '1 × Growth', quantity: 1,
        amount: 5900,
        taxes: [{ amount: 1357, tax_behavior: 'exclusive' }],
      }] },
    } as unknown as Stripe.Invoice);

    expect(mapped.lines[0].amountCents).toBe(5900);
    expect(mapped.lines.reduce((s, l) => s + l.amountCents, 0)).toBe(mapped.subtotalCents);
  });

  // Exclusive VAT: subtotal is the net and tax sits on top. total_taxes carries it too,
  // so the same source works — and the net still equals total minus tax.
  it('reads exclusive VAT and keeps net + tax = total', () => {
    const mapped = mapStripeInvoice({
      id: 'in_excl', object: 'invoice', status: 'paid', number: '0003', currency: 'eur',
      total: 7257, subtotal: 5900, subtotal_excluding_tax: 5900,
      total_taxes: [{ amount: 1357 }],
      created: Math.floor(Date.UTC(2026, 7, 15) / 1000),
      lines: { object: 'list', data: [], has_more: false, url: '' },
    } as unknown as Stripe.Invoice);

    expect(mapped.taxCents).toBe(1357);
    expect(mapped.subtotalCents).toBe(5900);
    expect(mapped.subtotalCents + mapped.taxCents).toBe(mapped.totalCents);
  });

  // No total_taxes (older API shape, or a genuinely untaxed invoice): fall back to the
  // difference, which is 0 for an untaxed invoice and correct for a legacy exclusive one.
  it('falls back to total minus subtotal when total_taxes is absent', () => {
    const mapped = mapStripeInvoice({
      id: 'in_legacy', object: 'invoice', status: 'paid', number: '0004', currency: 'eur',
      total: 1230, subtotal: 1000,
      created: Math.floor(Date.UTC(2026, 7, 15) / 1000),
      lines: { object: 'list', data: [], has_more: false, url: '' },
    } as unknown as Stripe.Invoice);

    expect(mapped.taxCents).toBe(230);
    expect(mapped.subtotalCents).toBe(1000);
  });
});

