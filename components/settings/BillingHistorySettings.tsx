import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from 'react-query';
import { Badge, Button, CompactSelect, Drawer, SearchBar } from '../koala/core';
import { Icon } from '../koala/icons/Icon';
import { Card } from '../koala/product/Card';
import {
  groupInvoicesByDate,
  type BillingInvoice,
  type BillingInvoiceStatus,
} from '../../lib/billingInvoiceModel';

const FONT = 'var(--font-family-primary)';
const BORDER = 'var(--koala-border-primary)';
const TEXT = 'var(--koala-text-primary)';
const MUTED = 'var(--koala-text-secondary)';

type StatusFilter = 'all' | BillingInvoiceStatus;

const STATUS_BADGE: Record<BillingInvoiceStatus, 'success' | 'warning' | 'danger' | 'muted'> = {
  paid: 'success',
  open: 'warning',
  draft: 'muted',
  void: 'muted',
  uncollectible: 'danger',
  unknown: 'muted',
};

const FILTER_OPTIONS = [
  { value: 'all', label: 'All invoices' },
  { value: 'paid', label: 'Paid' },
  { value: 'open', label: 'Open' },
  { value: 'uncollectible', label: 'Failed' },
  { value: 'void', label: 'Void' },
];

function MetaRow({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: MUTED, fontFamily: FONT }}>
      <Icon name={icon} size={16} weight="bold" color={MUTED} />
      <span>{children}</span>
    </div>
  );
}

function InvoiceCard({
  invoice,
  onView,
}: {
  invoice: BillingInvoice;
  onView: () => void;
}) {
  return (
    <article
      style={{
        background: 'var(--koala-bg-primary)',
        border: `1px solid ${BORDER}`,
        borderRadius: 16,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        fontFamily: FONT,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: TEXT }}>{invoice.number}</h3>
            <Badge variant={STATUS_BADGE[invoice.status]} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 22, padding: '0 8px', borderRadius: 999 }}>
              {invoice.status === 'paid' ? <Icon name="CheckCircle" size={12} weight="bold" /> : null}
              {invoice.statusLabel}
            </Badge>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
            <MetaRow icon="CalendarBlank">Billed: {invoice.createdLabel}</MetaRow>
            {invoice.periodLabel ? <MetaRow icon="Clock">Period: {invoice.periodLabel}</MetaRow> : null}
            <MetaRow icon="Stack">Items: {invoice.lines.length || 1}</MetaRow>
          </div>
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: TEXT, whiteSpace: 'nowrap' }}>{invoice.totalLabel}</div>
      </div>

      {invoice.lines.length > 0 ? (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 8 }}>Items</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {invoice.lines.slice(0, 4).map((line) => (
              <div
                key={line.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  width: 120,
                  padding: 10,
                  borderRadius: 12,
                  background: 'var(--koala-bg-secondary)',
                  border: `1px solid ${BORDER}`,
                }}
              >
                <Icon name="Package" size={20} weight="bold" color={TEXT} />
                <span style={{ fontSize: 12, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {line.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Button type="button" variant="primary" size="sm" icon={<Icon name="Eye" size={16} weight="bold" />} onClick={onView}>
          View details
        </Button>
        {invoice.pdfUrl ? (
          <a href={invoice.pdfUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
            <Button type="button" variant="secondary" size="sm" icon={<Icon name="FileText" size={16} weight="bold" />}>
              Invoice
            </Button>
          </a>
        ) : (
          <Button type="button" variant="secondary" size="sm" icon={<Icon name="FileText" size={16} weight="bold" />} disabled>
            Invoice
          </Button>
        )}
        <Link href="/settings/billing_subscription" passHref>
          <a style={{ textDecoration: 'none' }}>
            <Button type="button" variant="secondary" size="sm" icon={<Icon name="ArrowClockwise" size={16} weight="bold" />}>
              Manage plan
            </Button>
          </a>
        </Link>
      </div>
    </article>
  );
}

function InvoiceDetailsDrawer({
  invoice,
  onClose,
}: {
  invoice: BillingInvoice | null;
  onClose: () => void;
}) {
  if (!invoice) return null;

  const lines = invoice.lines.length
    ? invoice.lines
    : [{
      id: 'fallback',
      description: 'Subscription',
      quantity: 1,
      amountCents: invoice.totalCents,
      amountLabel: invoice.totalLabel,
    }];

  return (
    <Drawer
      open={Boolean(invoice)}
      onClose={onClose}
      className="koala-drawer-root--billing"
      ariaLabel="Invoice details"
      title={(
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span>Invoice details</span>
          <Badge variant={STATUS_BADGE[invoice.status]} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 22, padding: '0 8px', borderRadius: 999 }}>
              {invoice.status === 'paid' ? <Icon name="CheckCircle" size={12} weight="bold" /> : null}
              {invoice.statusLabel}
            </Badge>
        </div>
      )}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: FONT, paddingBottom: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: MUTED, marginBottom: 4 }}>Invoice date</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{invoice.createdLabel}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: MUTED, marginBottom: 4 }}>Invoice total</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{invoice.totalLabel}</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {invoice.pdfUrl ? (
            <a href={invoice.pdfUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
              <Button type="button" variant="primary" size="sm" icon={<Icon name="FileText" size={16} weight="bold" />}>
                Invoice
              </Button>
            </a>
          ) : null}
          <Link href="/settings/billing_subscription" passHref>
            <a style={{ textDecoration: 'none' }}>
              <Button type="button" variant="secondary" size="sm" icon={<Icon name="ArrowClockwise" size={16} weight="bold" />}>
                Manage plan
              </Button>
            </a>
          </Link>
          <a href="mailto:support@ranksmile.com" style={{ textDecoration: 'none' }}>
            <Button type="button" variant="secondary" size="sm" icon={<Icon name="ChatCircle" size={16} weight="bold" />}>
              Support
            </Button>
          </a>
        </div>

        <section>
          <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: TEXT }}>Line items</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {lines.map((line) => (
              <Card key={line.id} padded>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: 'var(--koala-bg-secondary)',
                        border: `1px solid ${BORDER}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon name="Package" size={18} weight="bold" color={TEXT} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: TEXT,
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {line.description}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: MUTED, marginTop: 2 }}>
                        Qty: {line.quantity}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {line.amountLabel}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: TEXT }}>Payment</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: TEXT }}>
              <Icon name="CreditCard" size={16} weight="bold" color={MUTED} />
              <span style={{ fontWeight: 500 }}>{invoice.paymentMethodLabel || 'No card on file'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: MUTED }}>
              <span style={{ fontWeight: 500 }}>Payment status</span>
              <Badge variant={STATUS_BADGE[invoice.status]} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 22, padding: '0 8px', borderRadius: 999 }}>
              {invoice.status === 'paid' ? <Icon name="CheckCircle" size={12} weight="bold" /> : null}
              {invoice.statusLabel}
            </Badge>
            </div>
            {invoice.periodLabel ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: TEXT }}>
                <Icon name="CalendarBlank" size={16} weight="bold" color={MUTED} />
                <span style={{ fontWeight: 500 }}>Billing period: {invoice.periodLabel}</span>
              </div>
            ) : null}
          </div>
        </section>

        <section style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 16, marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: MUTED, marginBottom: 8 }}>
            <span>Subtotal</span>
            <span style={{ color: TEXT, fontWeight: 500 }}>{invoice.subtotalLabel}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: MUTED, marginBottom: 12 }}>
            <span>Tax</span>
            <span style={{ color: TEXT, fontWeight: 500 }}>{invoice.taxLabel}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700, color: TEXT }}>
            <span>Total</span>
            <span>{invoice.totalLabel}</span>
          </div>
        </section>
      </div>
    </Drawer>
  );
}

export default function BillingHistorySettings() {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selected, setSelected] = useState<BillingInvoice | null>(null);

  const invoicesQ = useQuery(
    ['billing-invoices'],
    async () => {
      const res = await fetch('/api/billing/invoices');
      if (!res.ok) throw new Error('Failed to load invoices');
      const data = await res.json() as { invoices: BillingInvoice[] };
      return data.invoices ?? [];
    },
    { refetchOnWindowFocus: false },
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (invoicesQ.data ?? []).filter((inv) => {
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
      if (!q) return true;
      const hay = `${inv.number} ${inv.lines.map((l) => l.description).join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [invoicesQ.data, query, statusFilter]);

  const groups = useMemo(() => groupInvoicesByDate(filtered), [filtered]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: FONT }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <div style={{ flex: '1 1 240px', minWidth: 0, maxWidth: 420 }}>
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder="Search by invoice number or plan…"
            width="100%"
          />
        </div>
        <CompactSelect
          size="sm"
          value={statusFilter}
          options={FILTER_OPTIONS}
          onChange={(opt) => setStatusFilter(opt.value as StatusFilter)}
        />
      </div>

      {invoicesQ.isLoading ? (
        <div style={{ color: MUTED, fontSize: 14 }}>Loading invoices…</div>
      ) : null}

      {invoicesQ.isError ? (
        <div style={{ color: 'var(--koala-status-danger)', fontSize: 14 }} role="alert">Could not load billing history.</div>
      ) : null}

      {!invoicesQ.isLoading && !invoicesQ.isError && groups.length === 0 ? (
        <div
          style={{
            border: `1px solid ${BORDER}`,
            borderRadius: 16,
            padding: 32,
            textAlign: 'center',
            background: 'var(--koala-bg-primary)',
            color: MUTED,
            fontSize: 14,
          }}
        >
          No invoices yet. They’ll show up here after your first successful charge.
        </div>
      ) : null}

      {groups.map((group) => (
        <section key={group.label} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: BORDER }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: MUTED, whiteSpace: 'nowrap' }}>{group.label}</span>
            <div style={{ flex: 1, height: 1, background: BORDER }} />
          </div>
          {group.invoices.map((invoice) => (
            <InvoiceCard key={invoice.id} invoice={invoice} onView={() => setSelected(invoice)} />
          ))}
        </section>
      ))}

      <InvoiceDetailsDrawer invoice={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
