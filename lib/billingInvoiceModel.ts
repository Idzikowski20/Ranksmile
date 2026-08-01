import type Stripe from 'stripe';
import { formatMoney } from './subscriptionFormat';

export type BillingInvoiceStatus = 'paid' | 'open' | 'draft' | 'void' | 'uncollectible' | 'unknown';

export type BillingInvoiceLine = {
  id: string;
  description: string;
  quantity: number;
  amountCents: number;
  amountLabel: string;
};

export type BillingInvoice = {
  id: string;
  number: string;
  status: BillingInvoiceStatus;
  statusLabel: string;
  currency: string;
  totalCents: number;
  totalLabel: string;
  subtotalCents: number;
  subtotalLabel: string;
  taxCents: number;
  taxLabel: string;
  createdAt: string;
  createdLabel: string;
  periodStart: string | null;
  periodEnd: string | null;
  periodLabel: string | null;
  pdfUrl: string | null;
  hostedUrl: string | null;
  lines: BillingInvoiceLine[];
  paymentMethodLabel: string | null;
};

const STATUS_LABEL: Record<BillingInvoiceStatus, string> = {
  paid: 'Paid',
  open: 'Open',
  draft: 'Draft',
  void: 'Void',
  uncollectible: 'Failed',
  unknown: 'Unknown',
};

export function mapInvoiceStatus(status: Stripe.Invoice.Status | null): BillingInvoiceStatus {
  if (status === 'paid' || status === 'open' || status === 'draft' || status === 'void' || status === 'uncollectible') {
    return status;
  }
  return 'unknown';
}

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
  const subtotalCents = inv.subtotal ?? totalCents;
  const taxCents = Math.max(0, totalCents - subtotalCents);
  const lineRows = inv.lines?.data ?? [];
  const lines: BillingInvoiceLine[] = lineRows.map((line) => {
    const amountCents = line.amount ?? 0;
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

export type InvoiceDateGroup = {
  label: string;
  invoices: BillingInvoice[];
};

export function groupInvoicesByDate(invoices: BillingInvoice[], now = new Date()): InvoiceDateGroup[] {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = startOf(now);
  const yesterday = today - 86_400_000;
  const buckets = new Map<string, BillingInvoice[]>();

  for (const inv of invoices) {
    const t = startOf(new Date(inv.createdAt));
    let label: string;
    if (t === today) label = 'Today';
    else if (t === yesterday) label = 'Yesterday';
    else {
      const d = new Date(inv.createdAt);
      label = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
    }
    const list = buckets.get(label) ?? [];
    list.push(inv);
    buckets.set(label, list);
  }

  return Array.from(buckets.entries()).map(([label, rows]) => ({ label, invoices: rows }));
}
