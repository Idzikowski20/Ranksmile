import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useQuery, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { Button } from '../core';
import { SentryPanel, SentryPanelBody } from '../sentry-pages';
import PricingPlansSettings from './PricingPlansSettings';
import type { SubscriptionDetails } from '../../lib/subscriptionDetails';
import type { UpcomingPaymentDetails } from '../../lib/subscriptionFormat';
import { formatMoney, formatUpcomingTotal } from '../../lib/subscriptionFormat';

// ─── SVG atoms ────────────────────────────────────────────────────────────────

const ChevronRight = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d="m8.25 4.5 7.5 7.5-7.5 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const XIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const TrashIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path
      d="M16 6V5.2C16 4.0799 16 3.51984 15.782 3.09202C15.5903 2.71569 15.2843 2.40973 14.908 2.21799C14.4802 2 13.9201 2 12.8 2H11.2C10.0799 2 9.51984 2 9.09202 2.21799C8.71569 2.40973 8.40973 2.71569 8.21799 3.09202C8 3.51984 8 4.0799 8 5.2V6M10 11.5V16.5M14 11.5V16.5M3 6H21M19 6V17.2C19 18.8802 19 19.7202 18.673 20.362C18.3854 20.9265 17.9265 21.3854 17.362 21.673C16.7202 22 15.8802 22 14.2 22H9.8C8.11984 22 7.27976 22 6.63803 21.673C6.07354 21.3854 5.6146 20.9265 5.32698 20.362C5 19.7202 5 18.8802 5 17.2V6"
      stroke="#DC2626"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const GreenCheckBadge = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path
      d="M8.603 3.799A4.5 4.5 0 0 1 12 2.25c1.357 0 2.573.6 3.397 1.549a4.5 4.5 0 0 1 3.498 1.307a4.5 4.5 0 0 1 1.307 3.497A4.5 4.5 0 0 1 21.75 12a4.5 4.5 0 0 1-1.549 3.397a4.5 4.5 0 0 1-1.307 3.497a4.5 4.5 0 0 1-3.497 1.307A4.5 4.5 0 0 1 12 21.75a4.5 4.5 0 0 1-3.397-1.549a4.5 4.5 0 0 1-3.498-1.306a4.5 4.5 0 0 1-1.307-3.498A4.5 4.5 0 0 1 2.25 12c0-1.357.6-2.573 1.549-3.397a4.5 4.5 0 0 1 1.307-3.497a4.5 4.5 0 0 1 3.497-1.307m7.007 6.387a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094z"
      fill="#1AB25E"
    />
  </svg>
);

const PlayCircleIcon = () => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))' }}
  >
    <circle cx="12" cy="12" r="10" fill="rgba(0,0,0,0.55)" />
    <path d="M10 8l6 4-6 4V8z" fill="#fff" />
  </svg>
);

const ChatBubbleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#52525C" strokeWidth="1.5" aria-hidden="true">
    <path d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193q-.51.041-1.02.072v3.091l-3-3q-2.031 0-4.02-.163a2.1 2.1 0 0 1-.825-.242m9.345-8.334a2 2 0 0 0-.476-.095a48.6 48.6 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.5 48.5 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402c-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235q.865.113 1.74.194V21l4.155-4.155" />
  </svg>
);

// ─── Modal A — Upcoming Bills ─────────────────────────────────────────────────

export const showCancellationApprovedToast = () => {
  toast.custom((t: { id: string }) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
        width: 360,
        padding: '16px 18px',
        borderRadius: 8,
        background: '#18181B',
        color: '#FFFFFF',
        boxShadow: '0px 8px 16px 0px rgba(24,26,34,0.04), 0px 2px 8px 0px rgba(24,26,34,0.02), 0px 1px 2px 0px rgba(24,26,34,0.06)',
        fontFamily: 'var(--font-family-primary)',
      }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0, color: '#87E58F', marginTop: 2 }}>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path d="m8 12.2 2.4 2.4L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <span style={{ fontSize: 18, lineHeight: '24px', fontWeight: 700, color: '#87E58F' }}>
          Your request has been approved
        </span>
        <span style={{ fontSize: 16, lineHeight: '24px', fontWeight: 400, color: '#FFFFFF' }}>
          Your plan won&apos;t auto-renew and charges will not be incurred.
        </span>
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => toast.dismiss(t.id)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
          height: 24,
          padding: 0,
          border: 'none',
          background: 'transparent',
          color: '#FFFFFF',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <XIcon size={24} />
      </button>
    </div>
  ));
};

const UpcomingBillsModal = ({ upcoming, canceled, onClose }: {
  upcoming: UpcomingPaymentDetails | null;
  canceled: boolean;
  onClose: () => void;
}) => {
  const planName = upcoming?.planName ?? '—';
  const planAmount = upcoming ? formatMoney(upcoming.planAmountCents, upcoming.currency) : '—';
  const taxAmount = upcoming ? formatMoney(upcoming.taxAmountCents, upcoming.currency) : '—';
  const totalAmount = formatUpcomingTotal(upcoming, canceled);
  const renewalDate = canceled ? '—' : (upcoming?.renewalDateLabel ?? '—');
  const taxLabel = upcoming?.taxLabel ?? 'TAX';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 500,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 16,
          width: 'min(520px, calc(100vw - 32px))',
          padding: 24,
          boxShadow: '0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.10)',
          fontFamily: 'var(--font-family-primary)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: '#18181B' }}>Upcoming bills</span>
          <Button type="button" variant="transparent" size="sm" onClick={onClose} aria-label="Close" icon={<XIcon size={18} />} />
        </div>

        {/* Plan rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#18181B', marginBottom: 12 }}>Plan</span>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, paddingBottom: 8 }}>
            <span style={{ fontSize: 14, color: '#3F3F47' }}>{planName}</span>
            <span style={{ fontSize: 14, color: '#3F3F47' }}>{planAmount}</span>
          </div>

          {!canceled && upcoming && upcoming.taxAmountCents > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, paddingBottom: 8 }}>
              <span style={{ fontSize: 14, color: '#3F3F47' }}>{taxLabel}</span>
              <span style={{ fontSize: 14, color: '#3F3F47' }}>{taxAmount}</span>
            </div>
          )}

          {/* Divider */}
          <div style={{ minHeight: 1, background: '#E4E4E7', margin: '8px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, paddingBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#18181B' }}>TOTAL</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#18181B' }}>{totalAmount}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, paddingBottom: 8 }}>
            <span style={{ fontSize: 14, color: '#3F3F47' }}>Renewal date</span>
            <span style={{ fontSize: 14, color: '#52525C' }}>{renewalDate}</span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
          <Button type="button" variant="primary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Modal B — Cancel Subscription (lose-data, first step) ───────────────────

const LOSS_ITEMS = [
  'Your optimized content',
  'Sites (Topical Maps, Content Audits, and Reports)',
  'AI Tracker projects',
  'Keyword Research tools and saved data',
];

const CancelSubscriptionModal = ({ accessUntilLabel, onClose, onProceed }: {
  accessUntilLabel: string;
  onClose: () => void;
  onProceed: () => void;
}) => {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 500,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 8,
          maxWidth: 800,
          width: 'calc(100% - 2.5rem)',
          maxHeight: '95vh',
          overflowY: 'auto',
          boxShadow: '0 32px 80px rgba(0,0,0,0.22), 0 8px 24px rgba(0,0,0,0.12)',
          fontFamily: 'var(--font-family-primary)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px 24px 20px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <span style={{ fontSize: 18, fontWeight: 600, color: '#18181B', maxWidth: 480, lineHeight: '1.35' }}>
            Are you sure? You will lose all of your data
          </span>
          <Button type="button" variant="transparent" size="sm" onClick={onClose} aria-label="Close" icon={<XIcon size={18} />} style={{ marginLeft: 16, flexShrink: 0 }} />
        </div>

        {/* Body — two columns */}
        <div
          style={{
            padding: '0 24px 24px 24px',
            display: 'flex',
            gap: 24,
            flexWrap: 'wrap',
          }}
        >
          {/* Left column */}
          <div
            style={{
              flex: '1 1 0',
              minWidth: 240,
              background: '#F8F8F9',
              borderRadius: 8,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ margin: 0, fontSize: 14, color: '#3F3F47', lineHeight: '1.55' }}>
                Your subscription stays active until <strong>{accessUntilLabel}</strong>.{' '}
                After that, you will lose access and your data will be{' '}
                <strong>permanently removed</strong>:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {LOSS_ITEMS.map((label) => (
                  <div
                    key={label}
                    style={{
                      background: '#fff',
                      borderRadius: 6,
                      padding: '12px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontWeight: 600,
                      fontSize: 13,
                      color: '#18181B',
                    }}
                  >
                    <TrashIcon />
                    <span>{label}</span>
                  </div>
                ))}
              </div>

              <p style={{ margin: 0, fontSize: 12, color: '#52525C', lineHeight: '1.5' }}>
                This data cannot be recovered after deletion. If you decide to come back later, you will need to start from scratch.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="button" variant="secondary" size="sm" onClick={onProceed}>
                Cancel Subscription
              </Button>
            </div>
          </div>

          {/* Right column */}
          <div
            style={{
              flex: '1 1 0',
              minWidth: 240,
              border: '1px solid #DAD9DE',
              boxShadow: '0 4px 0 0 #e4e4e7',
              borderRadius: 12,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Keep headline row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 14, color: '#18181B' }}>
                <GreenCheckBadge />
                <span>Keep your work and progress</span>
              </div>

              <p style={{ margin: 0, fontSize: 14, color: '#52525C', lineHeight: '1.55' }}>
                Continue optimizing your content and maintain access to all your work and data.
              </p>

              {/* Video row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                {/* Thumbnail */}
                <div style={{ position: 'relative', flexShrink: 0, width: 60, height: 40 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="https://img.youtube.com/vi/h-nBsdWeFJs/maxresdefault.jpg"
                    width={60}
                    height={40}
                    alt="Youtube video"
                    style={{ borderRadius: 4, display: 'block', objectFit: 'cover' }}
                    referrerPolicy="no-referrer"
                  />
                  <PlayCircleIcon />
                </div>
                <p style={{ margin: 0, fontSize: 13, color: '#52525C', lineHeight: '1.55' }}>
                  Need help? Our new{' '}
                  <a
                    href="https://surferseo.com/academy/content-optimization-masterclass/"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#18181B', textDecoration: 'underline' }}
                  >
                    Content Optimization Masterclass
                  </a>{' '}
                  will help you get more value from Surfer.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="button" variant="primary" size="sm" onClick={onClose}>
                Keep Subscription
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Modal C — Cancel Flow (3 steps) ─────────────────────────────────────────

const STEP1_OPTIONS = [
  "I don't use it",
  "I don't see the value",
  "I don't know how to use it",
  'I am not satisfied with the product',
  "It's not useful for me right now",
  'Other',
];

const STEP2_OPTIONS = [
  'Good value',
  'Helpful support',
  'Nothing',
  'Useful features',
  "Many things. I'll be back",
  'Other',
];

const RadioOption = ({
  label,
  name,
  value,
  selected,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  selected: boolean;
  onChange: (v: string) => void;
}) => (
  <label
    style={{
      display: 'flex',
      alignItems: 'center',
      padding: '14px 16px',
      borderRadius: 8,
      border: selected ? '1px solid #AA93FD' : '1px solid #E4E4E7',
      background: selected ? 'rgba(120,58,251,0.04)' : '#fff',
      boxShadow: selected ? '0 0 0 3px rgba(120,58,251,0.1)' : 'none',
      cursor: 'pointer',
      fontSize: 14,
      color: '#18181B',
      fontFamily: 'var(--font-family-primary)',
      transition: 'border 150ms ease, box-shadow 150ms ease, background 150ms ease',
    }}
  >
    <input
      type="radio"
      name={name}
      value={value}
      checked={selected}
      onChange={() => onChange(value)}
      style={{
        position: 'absolute',
        opacity: 0,
        width: 0,
        height: 0,
        pointerEvents: 'none',
      }}
    />
    {label}
  </label>
);

const CancelFlowModal = ({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [step1Selection, setStep1Selection] = useState('');
  const [step2Selection, setStep2Selection] = useState('');

  const step1Valid = step1Selection !== '';
  const step2Valid = step2Selection !== '';

  const stepTitle =
    step === 1
      ? "We're sorry to see you go. How did we fall short?"
      : step === 2
      ? "It wasn't all bad, right? Did we do anything well?"
      : "We're still here for you";

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 500,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 8,
          maxWidth: 800,
          width: 'calc(100% - 2.5rem)',
          maxHeight: '95vh',
          overflowY: 'auto',
          boxShadow: '0 32px 80px rgba(0,0,0,0.22), 0 8px 24px rgba(0,0,0,0.12)',
          fontFamily: 'var(--font-family-primary)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px 24px 20px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 18, fontWeight: 600, color: '#18181B', maxWidth: 560, lineHeight: '1.35' }}>
              {stepTitle}
            </span>
            {step === 3 && (
              <span style={{ fontSize: 14, color: '#52525C', lineHeight: '1.5', maxWidth: 560 }}>
                Your business deserves a watertight SEO strategy. Let&apos;s build yours with Surfer.
              </span>
            )}
          </div>
          <Button type="button" variant="transparent" size="sm" onClick={onClose} aria-label="Close" icon={<XIcon size={18} />} style={{ marginLeft: 16, flexShrink: 0 }} />
        </div>

        {/* Body */}
        <div style={{ padding: '0 24px 24px 24px' }}>
          {/* Step 1 */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {STEP1_OPTIONS.map((opt) => (
                <RadioOption
                  key={opt}
                  label={opt}
                  name="cancel-step1"
                  value={opt}
                  selected={step1Selection === opt}
                  onChange={setStep1Selection}
                />
              ))}
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {STEP2_OPTIONS.map((opt) => (
                <RadioOption
                  key={opt}
                  label={opt}
                  name="cancel-step2"
                  value={opt}
                  selected={step2Selection === opt}
                  onChange={setStep2Selection}
                />
              ))}
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Card 1 — Masterclass */}
              <div
                style={{
                  border: '1px solid #DAD9DE',
                  boxShadow: '0 4px 0 0 #e4e4e7',
                  borderRadius: 12,
                  padding: 24,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 16,
                }}
              >
                <div
                  style={{
                    flexShrink: 0,
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: '#F4F4F5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ChatBubbleIcon />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#18181B' }}>Take Content Optimization Masterclass</span>
                  <p style={{ margin: 0, fontSize: 14, color: '#52525C', lineHeight: '1.55' }}>
                    Need help? Our new{' '}
                    <a
                      href="https://surferseo.com/academy/content-optimization-masterclass/"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#18181B', textDecoration: 'underline' }}
                    >
                      Content Optimization Masterclass
                    </a>{' '}
                    will help you get more value from Surfer.
                  </p>
                  <a
                    href="https://community.surferseo.com/c/content-optimization-masterclass/"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'inline-block', alignSelf: 'flex-start', textDecoration: 'none' }}
                  >
                    <Button type="button" variant="primary" size="sm">
                      Enroll Now
                    </Button>
                  </a>
                </div>
              </div>

              {/* Card 2 — Live Support */}
              <div
                style={{
                  border: '1px solid #DAD9DE',
                  boxShadow: '0 4px 0 0 #e4e4e7',
                  borderRadius: 12,
                  padding: 24,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 16,
                }}
              >
                <div
                  style={{
                    flexShrink: 0,
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: '#F4F4F5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ChatBubbleIcon />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#18181B' }}>Chat with live Support</span>
                  <p style={{ margin: 0, fontSize: 14, color: '#52525C', lineHeight: '1.55' }}>
                    Write to us if you&apos;re feeling stuck on your SEO journey. There&apos;s no question too small, no issue too big. Let&apos;s plan your next move, together.
                  </p>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => toast('Live chat is not available in this demo')}
                    style={{ alignSelf: 'flex-start' }}
                  >
                    Chat now
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Separator */}
        <div style={{ height: 1, background: '#E4E4E7' }} />

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 12,
          }}
        >
          {step === 3 ? (
            <>
              <Button type="button" variant="transparent" size="sm" onClick={onClose}>
                Don&apos;t cancel
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => { onConfirm(); onClose(); }}
              >
                Cancel Subscription
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                Don&apos;t cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => { if (step === 1 && step1Valid) setStep(2); else if (step === 2 && step2Valid) setStep(3); }}
                disabled={step === 1 ? !step1Valid : !step2Valid}
              >
                Next
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Subscription Page ────────────────────────────────────────────────────────

const SubscriptionPage = ({
  subscription,
  loading,
  onChangePlan,
  onOpenUpcoming,
  onOpenCancel,
}: {
  subscription: SubscriptionDetails | null;
  loading: boolean;
  onChangePlan: () => void;
  onOpenUpcoming: () => void;
  onOpenCancel: () => void;
}) => {
  const canceled = subscription?.cancelAtPeriodEnd ?? false;
  const periodLabel = subscription?.periodLabel ?? (loading ? 'Loading…' : null);
  const planName = subscription?.planName ?? 'Growth';
  const transitionDate = subscription?.isTrialing
    ? subscription.trialEndsAtLabel
    : subscription?.currentPeriodEndLabel;
  const upcomingTotal = formatUpcomingTotal(subscription?.upcoming ?? null, canceled);
  const showTrialFlow = subscription?.isTrialing && !canceled && !!transitionDate;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', fontFamily: 'var(--font-family-primary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: '#18181B' }}>Plan</span>
        <span style={{ fontSize: 14, color: '#52525C' }}>
          {periodLabel ?? '—'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%' }}>
        <div style={{ flex: '1 1 280px', minWidth: 0, maxWidth: '100%' }}>
          <SentryPanel>
            <SentryPanelBody>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {canceled ? (
                  <>
                    <span style={{ fontSize: 18, fontWeight: 600, color: '#18181B' }}>{planName}</span>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#1AB25E', flexShrink: 0 }} />
                    <span style={{ fontSize: 14, color: '#52525C' }}>
                      Active until {transitionDate ?? '—'}
                    </span>
                  </>
                ) : showTrialFlow ? (
                  <>
                    <span style={{ fontSize: 18, fontWeight: 600, color: '#18181B' }}>Trial</span>
                    <ChevronRight />
                    <span style={{ fontSize: 14, color: '#3F3F47' }}>on {transitionDate}</span>
                    <ChevronRight />
                    <span style={{ fontSize: 18, fontWeight: 600, color: '#18181B' }}>{planName}</span>
                  </>
                ) : (
                  <span style={{ fontSize: 18, fontWeight: 600, color: '#18181B' }}>{planName}</span>
                )}
              </div>
              <Button type="button" variant="primary" size="sm" onClick={onChangePlan}>
                {subscription?.hasStripeSubscription ? 'Change plan' : 'Choose plan'}
              </Button>
            </div>
          </SentryPanelBody>
          </SentryPanel>
        </div>

        <div style={{ flexBasis: 240, flexShrink: 0, minWidth: 200 }}>
          <SentryPanel>
            <SentryPanelBody>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 14, color: '#18181B' }}>Upcoming payments</span>
                  <span style={{ fontSize: 20, fontWeight: 600, color: '#18181B' }}>
                    {upcomingTotal}
                  </span>
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={onOpenUpcoming}>
                  Details
                </Button>
              </div>
            </SentryPanelBody>
          </SentryPanel>
        </div>
      </div>

      {!canceled && subscription?.hasStripeSubscription && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button type="button" variant="transparent" size="sm" icon={<XIcon size={20} />} onClick={onOpenCancel}>
            Cancel subscription
          </Button>
        </div>
      )}
    </div>
  );
};

// ─── Main export ──────────────────────────────────────────────────────────────

const SubscriptionSettings = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [view, setView] = useState<'subscription' | 'plans'>('subscription');
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [flowOpen, setFlowOpen] = useState(false);

  const { data, isLoading } = useQuery(
    'subscriptionDetails',
    async () => {
      const res = await fetch('/api/billing/subscription');
      if (!res.ok) throw new Error('Failed to load subscription');
      return res.json() as Promise<{ subscription: SubscriptionDetails }>;
    },
    { staleTime: 30 * 1000, retry: false },
  );

  const subscription = data?.subscription ?? null;
  const canceled = subscription?.cancelAtPeriodEnd ?? false;
  const accessUntilLabel = subscription?.currentPeriodEndLabel
    ?? subscription?.trialEndsAtLabel
    ?? 'the end of your billing period';

  React.useEffect(() => {
    if (!router.isReady) return;
    setView(router.query.view === 'plans' ? 'plans' : 'subscription');
  }, [router.isReady, router.query.view]);

  const showPlans = () => {
    setView('plans');
    router.replace('/settings/billing_subscription?view=plans', undefined, { shallow: true });
  };

  const showSubscription = () => {
    setView('subscription');
    router.replace('/settings/billing_subscription', undefined, { shallow: true });
  };

  const handleConfirmCancel = async () => {
    try {
      const res = await fetch('/api/billing/cancel', { method: 'POST' });
      const body = await res.json() as { error?: string };
      if (!res.ok) {
        toast.error(body.error ?? 'Could not cancel subscription');
        return;
      }
      await queryClient.invalidateQueries('subscriptionDetails');
      showCancellationApprovedToast();
    } catch {
      toast.error('Could not cancel subscription');
    }
  };

  if (view === 'plans') {
    return (
      <div style={{ width: '100%', fontFamily: 'var(--font-family-primary)' }}>
        <Button type="button" variant="transparent" size="sm" onClick={showSubscription} style={{ marginBottom: 16 }}>
          ← Back
        </Button>
        <PricingPlansSettings />
      </div>
    );
  }

  return (
    <>
      <SubscriptionPage
        subscription={subscription}
        loading={isLoading}
        onChangePlan={showPlans}
        onOpenUpcoming={() => setUpcomingOpen(true)}
        onOpenCancel={() => setCancelOpen(true)}
      />

      {upcomingOpen && (
        <UpcomingBillsModal
          upcoming={subscription?.upcoming ?? null}
          canceled={canceled}
          onClose={() => setUpcomingOpen(false)}
        />
      )}
      {cancelOpen && (
        <CancelSubscriptionModal
          accessUntilLabel={accessUntilLabel}
          onClose={() => setCancelOpen(false)}
          onProceed={() => { setCancelOpen(false); setFlowOpen(true); }}
        />
      )}
      {flowOpen && (
        <CancelFlowModal
          onClose={() => setFlowOpen(false)}
          onConfirm={() => { void handleConfirmCancel(); setFlowOpen(false); }}
        />
      )}
    </>
  );
};

export default SubscriptionSettings;
