import type Stripe from 'stripe';
import { formatTaxIdForStripe, stripeTaxIdType } from '../checkoutValidation';

/** Default Stripe Tax category: general electronically supplied services. */
export const DEFAULT_STRIPE_TAX_CODE = 'txcd_10000000';

export type TaxPreviewAddress = {
  line1: string;
  line2?: string | null;
  city: string;
  state?: string | null;
  postal_code: string;
  country: string;
};

export type TaxPreviewResult = {
  calculationId: string;
  currency: string;
  subtotalCents: number;
  taxAmountCents: number;
  amountTotalCents: number;
  /** e.g. 23 for 23% — null when mixed/unknown */
  taxPercent: number | null;
  /** UI label, e.g. "VAT (23%)" */
  taxLabel: string;
};

type TaxBreakdownRow = {
  amount?: number;
  tax_rate_details?: {
    percentage_decimal?: string | null;
    tax_type?: string | null;
  } | null;
};

export function buildTaxLabel(args: {
  taxPercent: number | null;
  taxType: string | null;
}): string {
  const kind = args.taxType === 'vat' || args.taxType === 'gst'
    ? args.taxType.toUpperCase()
    : args.taxType === 'sales_tax'
      ? 'Sales tax'
      : 'Tax';
  if (args.taxPercent == null) return kind;
  const pct = Number.isInteger(args.taxPercent)
    ? String(args.taxPercent)
    : args.taxPercent.toFixed(2).replace(/\.?0+$/, '');
  return `${kind} (${pct}%)`;
}

/** Pure mapper — unit-testable without Stripe network. */
export function mapStripeTaxCalculation(
  calc: {
    id: string;
    currency: string;
    amount_total: number;
    tax_amount_exclusive: number;
    tax_amount_inclusive: number;
    tax_breakdown?: TaxBreakdownRow[] | null;
  },
  subtotalCents: number,
): TaxPreviewResult {
  const taxAmountCents = calc.tax_amount_exclusive + calc.tax_amount_inclusive;
  const breakdown = calc.tax_breakdown ?? [];
  const primary = breakdown.find((row) => (row.amount ?? 0) > 0) ?? breakdown[0];
  const rates = new Set(breakdown.map((row) => row.tax_rate_details?.percentage_decimal).filter((rate): rate is string => Boolean(rate)));
  const pctRaw = rates.size === 1 ? primary?.tax_rate_details?.percentage_decimal : null;
  const taxPercent = pctRaw != null && pctRaw !== ''
    ? Number.parseFloat(pctRaw)
    : null;
  const taxTypes = new Set(breakdown.map((row) => row.tax_rate_details?.tax_type).filter((type): type is string => Boolean(type)));
  const taxType = taxTypes.size === 1 ? primary?.tax_rate_details?.tax_type ?? null : null;

  return {
    calculationId: calc.id,
    currency: calc.currency,
    subtotalCents,
    taxAmountCents,
    amountTotalCents: calc.amount_total,
    taxPercent: Number.isFinite(taxPercent) ? taxPercent : null,
    taxLabel: buildTaxLabel({
      taxPercent: Number.isFinite(taxPercent) ? taxPercent : null,
      taxType,
    }),
  };
}

export async function calculateStripeTaxPreview(
  stripe: Stripe,
  args: {
    amountCents: number;
    currency?: string;
    address: TaxPreviewAddress;
    taxId?: string | null;
    reference?: string;
    taxCode?: string;
  },
): Promise<TaxPreviewResult> {
  const currency = (args.currency ?? 'eur').toLowerCase();
  const taxCode = args.taxCode?.trim() || process.env.STRIPE_TAX_CODE?.trim() || DEFAULT_STRIPE_TAX_CODE;
  const country = args.address.country.toUpperCase();

  const customerDetails: Stripe.Tax.CalculationCreateParams.CustomerDetails = {
    address: {
      line1: args.address.line1,
      line2: args.address.line2 ?? undefined,
      city: args.address.city,
      state: args.address.state ?? undefined,
      postal_code: args.address.postal_code,
      country,
    },
    address_source: 'billing',
  };

  const rawTaxId = args.taxId?.trim();
  if (rawTaxId) {
    customerDetails.tax_ids = [{
      type: stripeTaxIdType(country),
      value: formatTaxIdForStripe(country, rawTaxId),
    }];
  }

  const calc = await stripe.tax.calculations.create({
    currency,
    customer_details: customerDetails,
    line_items: [{
      amount: args.amountCents,
      reference: args.reference ?? 'subscription',
      tax_behavior: 'exclusive',
      tax_code: taxCode,
      quantity: 1,
    }],
  });

  return mapStripeTaxCalculation(calc, args.amountCents);
}
