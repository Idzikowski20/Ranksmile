import React, { useState } from 'react';
import toast from 'react-hot-toast';
import Button from '../koala/primitives/Button';
import { Textarea } from '../koala/core';
import { Icon } from '../koala/icons';
import { BounceSmileyAnimation } from '../common/BounceSmileyAnimation';
import type { BillingConfirmation } from '../../lib/billingConfirmation';

const F = 'var(--font-family-primary)';
const BRAND = '#F84416';
const BORDER = '#e5e5e5';
const TEXT = '#1a1a1a';
const MUTED = '#575757';
const CARD: React.CSSProperties = {
  border: `1px solid ${BORDER}`,
  borderRadius: 16,
  padding: 24,
  background: '#fff',
  boxSizing: 'border-box',
};

function MetaBlock({
  icon,
  label,
  children,
}: {
  icon: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 140, flex: '1 1 140px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: MUTED }}>
        <Icon name={icon} size={18} weight="bold" color={MUTED} />
        <span style={{ fontSize: 16, fontWeight: 500, fontFamily: F }}>{label}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 16, fontWeight: 500, color: TEXT, fontFamily: F }}>
        {children}
      </div>
    </div>
  );
}

export default function OrderConfirmationBody({
  data,
  onContinue,
}: {
  data: BillingConfirmation;
  onContinue: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submitFeedback = () => {
    if (!rating && !feedback.trim()) {
      toast.error('Add a rating or a short note');
      return;
    }
    setSubmitting(true);
    window.setTimeout(() => {
      setSubmitting(false);
      setFeedback('');
      toast.success('Thanks for your feedback');
    }, 400);
  };

  const receiptHref = data.invoicePdfUrl || data.receiptUrl;

  return (
    <div className="oco-figma">
      <style>{`
        .oco-figma { color: ${TEXT}; font-family: ${F}; width: 100%; max-width: 1008px; margin: 0 auto; display: flex; flex-direction: column; align-items: center; gap: 32px; }
        .oco-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, 420px); gap: 24px; width: 100%; align-items: start; }
        .oco-left { display: flex; flex-direction: column; gap: 24px; min-width: 0; }
        .oco-right { min-width: 0; }
        .oco-meta { display: flex; flex-wrap: wrap; gap: 24px 32px; }
        .oco-totals-row { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; color: ${MUTED}; }
        .oco-totals-row strong { color: ${TEXT}; font-weight: 600; }
        @media (max-width: 960px) {
          .oco-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div style={{
        width: 48,
        height: 48,
        borderRadius: 9999,
        border: `1px solid ${BORDER}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      >
        <Icon name="CheckCircle" size={32} weight="fill" color="#1AB25E" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '2px 6px',
          borderRadius: 8,
          border: `1px solid ${BORDER}`,
          background: '#fff',
          fontSize: 14,
          fontWeight: 500,
          color: MUTED,
          boxShadow: '0 1px 1px rgba(0,0,0,0.04)',
        }}
        >
          {data.orderId}
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, lineHeight: '36px', letterSpacing: '-0.07px', color: TEXT }}>
            {data.title}
          </h1>
          <p style={{ margin: 0, fontSize: 18, lineHeight: '26px', letterSpacing: '-0.5px', color: MUTED }}>
            {data.subtitle}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        <Button
          type="button"
          variant="primary"
          size="md"
          icon={<Icon name="ArrowRight" size={16} weight="bold" color="#fff" />}
          onClick={onContinue}
        >
          Go to dashboard
        </Button>
        {receiptHref ? (
          <a href={receiptHref} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
            <Button type="button" variant="secondary" size="md" icon={<Icon name="FileText" size={16} weight="bold" />}>
              Receipt
            </Button>
          </a>
        ) : (
          <Button type="button" variant="secondary" size="md" icon={<Icon name="FileText" size={16} weight="bold" />} disabled>
            Receipt
          </Button>
        )}
      </div>

      <div className="oco-grid">
        <div className="oco-left">
          <section style={CARD}>
            <h2 style={{ margin: '0 0 24px', fontSize: 16, fontWeight: 500, color: TEXT }}>Billing details</h2>
            <div className="oco-meta">
              <MetaBlock icon="Truck" label="Billing address">
                {data.billingName ? <span>{data.billingName}</span> : null}
                {data.addressLines.length > 0
                  ? data.addressLines.map((line) => <span key={line}>{line}</span>)
                  : <span style={{ color: MUTED }}>On file with Stripe</span>}
              </MetaBlock>
              <MetaBlock icon="CalendarBlank" label={data.isTrialing ? 'Trial ends' : 'Next billing'}>
                <span>{data.nextBillingLabel || 'â€”'}</span>
              </MetaBlock>
              <MetaBlock icon="CreditCard" label="Payment method">
                <span>{data.paymentMethodLabel || (data.isTrialing ? 'Card on file' : 'â€”')}</span>
              </MetaBlock>
            </div>
          </section>

          <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 500, color: TEXT }}>How would you rate your experience?</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[1, 2, 3, 4, 5].map((n) => {
                  const active = n <= rating;
                  return (
                    <button
                      key={n}
                      type="button"
                      aria-label={`Rate ${n} star${n === 1 ? '' : 's'}`}
                      aria-pressed={active}
                      onClick={() => setRating(n)}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        border: `1px solid ${BORDER}`,
                        background: '#fff',
                        boxShadow: active ? '0 1px 1px rgba(0,0,0,0.04)' : '0 1px 2px rgba(0,0,0,0.04)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      <Icon name="Star" size={24} weight={active ? 'fill' : 'bold'} color={active ? '#F5C518' : MUTED} />
                    </button>
                  );
                })}
              </div>
            </div>
            <Textarea
              label="Help us improve"
              placeholder="Tell us what went well or what we can improveâ€¦"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={4}
            />
            <div>
              <Button type="button" variant="primary" size="md" onClick={submitFeedback} disabled={submitting}>
                {submitting ? 'Submittingâ€¦' : 'Submit feedback'}
              </Button>
            </div>
          </section>
        </div>

        <aside className="oco-right" style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500, color: TEXT }}>Order Summary</h2>
            <span style={{
              fontSize: 12,
              fontWeight: 500,
              color: MUTED,
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              padding: '2px 8px',
              background: '#fff',
            }}
            >
              {data.lines.length} {data.lines.length === 1 ? 'item' : 'items'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.lines.map((line) => (
              <div
                key={line.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  paddingBottom: 12,
                  borderBottom: `1px solid ${BORDER}`,
                }}
              >
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  border: `1px solid ${BORDER}`,
                  background: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  overflow: 'hidden',
                }}
                >
                  <BounceSmileyAnimation compact size={36} entrance={false} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{line.title}</div>
                  <div style={{ fontSize: 13, color: MUTED }}>{line.detail}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, whiteSpace: 'nowrap' }}>{line.amountLabel}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
            <div className="oco-totals-row">
              <span>Subtotal</span>
              <strong>{data.subtotalLabel}</strong>
            </div>
            <div className="oco-totals-row">
              <span>{data.taxRateLabel}</span>
              <strong>{data.taxLabel}</strong>
            </div>
            <div style={{ height: 1, background: BORDER, margin: '4px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>Total</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: TEXT }}>{data.totalLabel}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
