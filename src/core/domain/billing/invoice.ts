/**
 * Billing invoice domain entity — pure, vendor-free. No Stripe, no lib.
 * Stripe -> BillingInvoice mapping lives in
 * src/infrastructure/billing/stripe/stripeInvoiceMapper.ts.
 */

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

export const STATUS_LABEL: Record<BillingInvoiceStatus, string> = {
  paid: 'Paid',
  open: 'Open',
  draft: 'Draft',
  void: 'Void',
  uncollectible: 'Failed',
  unknown: 'Unknown',
};

/** Vendor-neutral status mapping — takes a plain string, not a Stripe type. */
export function mapInvoiceStatus(status: string | null): BillingInvoiceStatus {
  if (
    status === 'paid'
    || status === 'open'
    || status === 'draft'
    || status === 'void'
    || status === 'uncollectible'
  ) {
    return status;
  }
  return 'unknown';
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
