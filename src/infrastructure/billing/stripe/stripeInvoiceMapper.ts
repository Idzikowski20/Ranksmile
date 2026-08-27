import type Stripe from 'stripe';
import { formatMoney } from '../../../core/shared/money';
import {
  mapInvoiceStatus,
  STATUS_LABEL,
  type BillingInvoice,
  type BillingInvoiceLine,
} from '../../../core/domain/billing/invoice';

/**
 * Infrastructure adapter: the ONLY place that reads Stripe.Invoice shapes and
 * turns them into the vendor-free BillingInvoice domain entity.
 */

function formatDateLabel(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatPeriodLabel(start: number | null, end: number | null): string | null {
  if (!start || !end) return null;
  const a = new Date(start * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const b = new Date(end * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${a} – ${b}`;
}

export function formatPaymentMethodLabel(
  pm: Stripe.PaymentMethod | string | null | undefined,
): string | null {
  if (!pm || typeof pm === 'string') return null;
  if (pm.card) {
    return `${pm.card.brand?.toUpperCase() ?? 'Card'} ····${pm.card.last4 ?? '••••'}`;
  }
  return null;
}

export function mapStripeInvoice(
  inv: Stripe.Invoice,
  opts?: { fallbackPaymentMethodLabel?: string | null },
): BillingInvoice {
  const status = mapInvoiceStatus(inv.status);
  const currency = inv.currency || 'eur';
  const totalCents = inv.total ?? 0;
  // Tax from total_taxes, not `total - subtotal`. For tax-INCLUSIVE prices (EUR defaults
  // to inclusive) Stripe leaves total == subtotal and records the VAT only in
  // total_taxes, so the subtraction read 0 on invoices that had actually collected VAT —
  // the "Tax €0.00" on a €59 charge that held €11.03 of Polish VAT. The subtraction is
  // kept as a fallback for older invoices with no total_taxes array.
  const totalTaxes = (inv as { total_taxes?: Array<{ amount?: number | null }> | null }).total_taxes;
  const taxCents = Array.isArray(totalTaxes) && totalTaxes.length
    ? totalTaxes.reduce((sum, t) => sum + (t.amount ?? 0), 0)
    : Math.max(0, totalCents - (inv.subtotal ?? totalCents));
  // Net = total - tax in both behaviours (inclusive: 5900-1103=4797; exclusive:
  // 7257-1357=5900), so the Subtotal/Tax/Total lines always add up.
  const subtotalCents = totalCents - taxCents;
  const lineRows = inv.lines?.data ?? [];
  const lines: BillingInvoiceLine[] = lineRows.map((line) => {
    // Show each line net, so the line items add up to the net subtotal above. `line.amount`
    // is gross under inclusive tax, which left one €59.00 line over a €47.97 subtotal.
    // `amount_excluding_tax` is the field for this but is absent in newer API versions, so
    // fall back to subtracting only the line's INCLUSIVE taxes — exclusive tax is already
    // on top of `amount` and must not be subtracted.
    const l = line as {
      amount?: number | null;
      amount_excluding_tax?: number | null;
      taxes?: Array<{ amount?: number | null; tax_behavior?: string | null }> | null;
    };
    const gross = l.amount ?? 0;
    const inclusiveTax = Array.isArray(l.taxes)
      ? l.taxes.reduce((s, t) => s + (t.tax_behavior === 'inclusive' ? (t.amount ?? 0) : 0), 0)
      : 0;
    const amountCents = l.amount_excluding_tax ?? (gross - inclusiveTax);
    return {
      id: line.id,
      description: line.description || 'Subscription',
      quantity: line.quantity ?? 1,
      amountCents,
      amountLabel: formatMoney(amountCents, currency),
    };
  });

  const firstPeriod = lineRows.find((l) => l.period?.start && l.period?.end)?.period;
  const periodStartUnix = firstPeriod?.start ?? inv.period_start ?? null;
  const periodEndUnix = firstPeriod?.end ?? inv.period_end ?? null;

  const paymentMethodLabel =
    formatPaymentMethodLabel(inv.default_payment_method) ?? opts?.fallbackPaymentMethodLabel ?? null;

  return {
    id: inv.id,
    number: inv.number ? `#${inv.number}` : `#${inv.id.slice(-8).toUpperCase()}`,
    status,
    statusLabel: STATUS_LABEL[status],
    currency,
    totalCents,
    totalLabel: formatMoney(totalCents, currency),
    subtotalCents,
    subtotalLabel: formatMoney(subtotalCents, currency),
    taxCents,
    taxLabel: formatMoney(taxCents, currency),
    createdAt: new Date(inv.created * 1000).toISOString(),
    createdLabel: formatDateLabel(inv.created),
    periodStart: periodStartUnix ? new Date(periodStartUnix * 1000).toISOString() : null,
    periodEnd: periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null,
    periodLabel: formatPeriodLabel(periodStartUnix, periodEndUnix),
    pdfUrl: inv.invoice_pdf ?? null,
    hostedUrl: inv.hosted_invoice_url ?? null,
    lines,
    paymentMethodLabel,
  };
}
