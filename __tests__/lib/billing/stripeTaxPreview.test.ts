import {
  buildTaxLabel,
  mapStripeTaxCalculation,
} from '../../../lib/billing/stripeTaxPreview';

describe('buildTaxLabel', () => {
  it('formats VAT with percent', () => {
    expect(buildTaxLabel({ taxPercent: 23, taxType: 'vat' })).toBe('VAT (23%)');
  });

  it('formats sales tax', () => {
    expect(buildTaxLabel({ taxPercent: 10.25, taxType: 'sales_tax' })).toBe('Sales tax (10.25%)');
  });

  it('falls back to Tax without percent', () => {
    expect(buildTaxLabel({ taxPercent: null, taxType: null })).toBe('Tax');
  });
});

describe('mapStripeTaxCalculation', () => {
  it('maps exclusive VAT from Stripe calculation', () => {
    const result = mapStripeTaxCalculation({
      id: 'taxcalc_1',
      currency: 'eur',
      amount_total: 72324,
      tax_amount_exclusive: 13524,
      tax_amount_inclusive: 0,
      tax_breakdown: [{
        amount: 13524,
        tax_rate_details: {
          percentage_decimal: '23.0',
          tax_type: 'vat',
        },
      }],
    }, 58800);

    expect(result).toEqual({
      calculationId: 'taxcalc_1',
      currency: 'eur',
      subtotalCents: 58800,
      taxAmountCents: 13524,
      amountTotalCents: 72324,
      taxPercent: 23,
      taxLabel: 'VAT (23%)',
    });
  });

  it('handles zero tax reverse-charge style breakdown', () => {
    const result = mapStripeTaxCalculation({
      id: 'taxcalc_2',
      currency: 'eur',
      amount_total: 58800,
      tax_amount_exclusive: 0,
      tax_amount_inclusive: 0,
      tax_breakdown: [{
        amount: 0,
        tax_rate_details: {
          percentage_decimal: '0.0',
          tax_type: 'vat',
        },
      }],
    }, 58800);

    expect(result.taxAmountCents).toBe(0);
    expect(result.taxLabel).toBe('VAT (0%)');
  });
});
