import React, { useState } from 'react';
import PricingPlansSettings from './PricingPlansSettings';

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

// ─── Modal A — Upcoming Bills ─────────────────────────────────────────────────

const UpcomingBillsModal = ({ onClose }: { onClose: () => void }) => {
  const [hoverClose, setHoverClose] = useState(false);

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
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#52525C',
              padding: 4,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F4F5'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* Plan rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#18181B', marginBottom: 12 }}>Plan</span>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, paddingBottom: 8 }}>
            <span style={{ fontSize: 14, color: '#3F3F47' }}>Pro</span>
            <span style={{ fontSize: 14, color: '#3F3F47' }}>€219.00</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, paddingBottom: 8 }}>
            <span style={{ fontSize: 14, color: '#3F3F47' }}>TAX (23%)</span>
            <span style={{ fontSize: 14, color: '#3F3F47' }}>€50.37</span>
          </div>

          {/* Divider */}
          <div style={{ minHeight: 1, background: '#E4E4E7', margin: '8px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, paddingBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#18181B' }}>TOTAL</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#18181B' }}>€269.37</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, paddingBottom: 8 }}>
            <span style={{ fontSize: 14, color: '#3F3F47' }}>Renewal date</span>
            <span style={{ fontSize: 14, color: '#52525C' }}>30 June 2026</span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: hoverClose ? '#783AFB' : '#18181B',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-family-primary)',
              transition: 'background 150ms ease',
            }}
            onMouseEnter={() => setHoverClose(true)}
            onMouseLeave={() => setHoverClose(false)}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Modal B — Cancel Subscription ───────────────────────────────────────────

const LOSS_ITEMS = [
  'Your optimized content',
  'Sites (Topical Maps, Content Audits, and Reports)',
  'AI Tracker projects',
  'Keyword Research tools and saved data',
];

const CancelSubscriptionModal = ({ onClose }: { onClose: () => void }) => {
  const [hoverCancel, setHoverCancel] = useState(false);
  const [hoverKeep, setHoverKeep] = useState(false);

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
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#52525C',
              padding: 4,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 16,
              flexShrink: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F4F5'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <XIcon size={18} />
          </button>
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
                Your subscription stays active until <strong>Jun 30th</strong>.{' '}
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
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: hoverCancel ? '#E4E4E7' : '#F4F4F5',
                  color: '#18181B',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 24px',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-family-primary)',
                  transition: 'background 150ms ease',
                }}
                onMouseEnter={() => setHoverCancel(true)}
                onMouseLeave={() => setHoverCancel(false)}
              >
                Cancel Subscription
              </button>
            </div>
          </div>

          {/* Right column */}
          <div
            style={{
              flex: '1 1 0',
              minWidth: 240,
              border: '1px solid #E4E4E7',
              borderRadius: 8,
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
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: hoverKeep ? '#783AFB' : '#18181B',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 24px',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-family-primary)',
                  transition: 'background 150ms ease',
                }}
                onMouseEnter={() => setHoverKeep(true)}
                onMouseLeave={() => setHoverKeep(false)}
              >
                Keep Subscription
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Subscription Page ────────────────────────────────────────────────────────

const SubscriptionPage = ({
  onChangePlan,
  onOpenUpcoming,
  onOpenCancel,
}: {
  onChangePlan: () => void;
  onOpenUpcoming: () => void;
  onOpenCancel: () => void;
}) => {
  const [hoverChangePlan, setHoverChangePlan] = useState(false);
  const [hoverDetails, setHoverDetails] = useState(false);
  const [hoverCancel, setHoverCancel] = useState(false);

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 880,
        margin: '0 auto',
        paddingTop: '2.5rem',
        fontFamily: 'var(--font-family-primary)',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: '#18181B' }}>Your subscription</span>
        <span style={{ fontSize: 14, color: '#18181B' }}>Manage your Surfer plan and add-ons</span>
      </div>

      {/* Plan label row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: '#18181B' }}>Plan</span>
        <span style={{ fontSize: 14, fontWeight: 400, color: '#18181B' }}>Renews in 7 days</span>
      </div>

      {/* Two cards row */}
      <div style={{ display: 'flex', gap: 8 }}>
        {/* Left card — plan transition */}
        <div
          style={{
            flex: '1 1 0',
            border: '1px solid #F4F4F5',
            borderRadius: 8,
            padding: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#fff',
          }}
        >
          {/* Left content */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 600, color: '#18181B' }}>Trial</span>
            <ChevronRight />
            <span style={{ fontSize: 14, color: '#3F3F47' }}>on 30 June 2026</span>
            <ChevronRight />
            <span style={{ fontSize: 18, fontWeight: 600, color: '#18181B' }}>Pro</span>
          </div>

          {/* Change plan button */}
          <button
            type="button"
            onClick={onChangePlan}
            style={{
              background: hoverChangePlan ? '#783AFB' : '#18181B',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '6px 16px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-family-primary)',
              transition: 'background 150ms ease',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
            onMouseEnter={() => setHoverChangePlan(true)}
            onMouseLeave={() => setHoverChangePlan(false)}
          >
            Change plan
          </button>
        </div>

        {/* Right card — upcoming payments */}
        <div
          style={{
            flexBasis: 240,
            flexShrink: 0,
            background: '#F8F8F9',
            border: '1px solid #F4F4F5',
            borderRadius: 8,
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 14, color: '#18181B' }}>Upcoming Payments</span>
            <span style={{ fontSize: 20, fontWeight: 600, color: '#18181B' }}>€269.37</span>
          </div>
          <div>
            <button
              type="button"
              onClick={onOpenUpcoming}
              style={{
                background: hoverDetails ? '#E4E4E7' : 'transparent',
                color: '#3F3F47',
                border: 'none',
                borderRadius: 6,
                padding: '6px 16px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'var(--font-family-primary)',
                boxShadow: 'inset 0 0 0 1px #E4E4E7',
                transition: 'background 150ms ease',
              }}
              onMouseEnter={() => setHoverDetails(true)}
              onMouseLeave={() => setHoverDetails(false)}
            >
              Details
            </button>
          </div>
        </div>
      </div>

      {/* Cancel subscription link row */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: '1.5rem' }}>
        <button
          type="button"
          onClick={onOpenCancel}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            color: hoverCancel ? '#52525C' : '#3F3F47',
            fontFamily: 'var(--font-family-primary)',
            fontSize: 14,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            transition: 'color 150ms ease',
          }}
          onMouseEnter={() => setHoverCancel(true)}
          onMouseLeave={() => setHoverCancel(false)}
        >
          <XIcon size={20} />
          <span>Cancel subscription</span>
        </button>
      </div>
    </div>
  );
};

// ─── Main export ──────────────────────────────────────────────────────────────

const SubscriptionSettings = () => {
  const [view, setView] = useState<'subscription' | 'plans'>('subscription');
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  if (view === 'plans') {
    return (
      <div style={{ width: '100%', fontFamily: 'var(--font-family-primary)' }}>
        {/* Back button */}
        <button
          type="button"
          onClick={() => setView('subscription')}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '0 0 16px 0',
            cursor: 'pointer',
            color: '#52525C',
            fontFamily: 'var(--font-family-primary)',
            fontSize: 14,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#18181B'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#52525C'; }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
        <PricingPlansSettings />
      </div>
    );
  }

  return (
    <>
      <SubscriptionPage
        onChangePlan={() => setView('plans')}
        onOpenUpcoming={() => setUpcomingOpen(true)}
        onOpenCancel={() => setCancelOpen(true)}
      />

      {upcomingOpen && <UpcomingBillsModal onClose={() => setUpcomingOpen(false)} />}
      {cancelOpen && <CancelSubscriptionModal onClose={() => setCancelOpen(false)} />}
    </>
  );
};

export default SubscriptionSettings;
