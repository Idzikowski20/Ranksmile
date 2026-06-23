import React, { useState } from 'react';
import toast from 'react-hot-toast';

// ─── Tiny reusable SVG atoms ──────────────────────────────────────────────────

const Check = ({ color = '#18181B' }: { color?: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path
      d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207"
      fill={color}
    />
  </svg>
);

const Cross = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0, color: '#9F9FA9' }}>
    <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const StarFilled = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="#FACC15" aria-hidden="true">
    <path d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382z" />
  </svg>
);

const ChevronDown = ({ open }: { open: boolean }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    style={{ flexShrink: 0, transition: 'transform 200ms ease', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', color: '#52525C' }}
  >
    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Conic-gradient dot for partial/tier cells */
const Dot = ({ deg }: { deg: number }) => (
  <span
    style={{
      display: 'inline-block',
      width: 16,
      height: 16,
      borderRadius: 9999,
      background: `conic-gradient(#18181B ${deg}deg, transparent ${deg}deg)`,
      border: '1.5px solid #E4E4E7',
      flexShrink: 0,
    }}
  />
);

// ─── Static data ──────────────────────────────────────────────────────────────

type CellValue = boolean | string | { deg: number; text: string };

interface PlanCard {
  name: string;
  price: string;
  recommended?: boolean;
  desc: string;
  cta: string;
  ctaStyle: 'primary' | 'gray' | 'ghost';
  featuresHeader?: string;
  features: string[];
}

const PLAN_CARDS: PlanCard[] = [
  {
    name: 'Standard',
    price: '€119',
    desc: 'Align your team with a unified workflow and start growing your visibility in AI search.',
    cta: 'Start with Standard',
    ctaStyle: 'gray',
    features: [
      'Create and Optimize 30 Documents',
      'Track AI Visibility',
      'Track 25 AI Prompts, refreshed weekly',
      'Integrations',
      '1-click Content Optimization',
      'Brand Knowledge',
      'External Collaboration Links',
      'Plagiarism Check',
      'Rank Drop Detection',
    ],
  },
  {
    name: 'Pro',
    price: '€219',
    recommended: true,
    desc: 'Secure your authority, fix technical conflicts, and manage AI perception at scale.',
    cta: 'Scale with Pro',
    ctaStyle: 'primary',
    featuresHeader: 'Everything in Standard, plus:',
    features: [
      'Create and Optimize 30 Documents',
      'Track AI Visibility',
      'Track 50 AI Prompts, refreshed daily',
      'Integrations',
      '5 Brand Spaces',
      '1-click Internal Linking',
      'Content Ideas & Coverage Gap',
      'Templates & Custom Voices',
      'Cannibalization Report',
    ],
  },
  {
    name: 'Peace of Mind',
    price: '€359',
    desc: 'Dominate the market with uncapped optimization, API access, and VIP support.',
    cta: 'Get Peace of Mind',
    ctaStyle: 'gray',
    featuresHeader: 'Everything in Pro, plus:',
    features: [
      'Unlimited* Documents',
      'Track AI Visibility',
      'Track 100 AI Prompts, refreshed daily',
      'Integrations',
      'Unlimited* Brand Spaces',
      'Advanced SERP Analysis',
      'Personalized Onboarding',
      'Dedicated Customer Success Manager',
      'API Access',
    ],
  },
];

const DISCOVERY_FEATURES = [
  'Create and Optimize 10 Documents',
  'Audit & Monitor <10 Pages',
  'AI SEO Optimization Guidelines',
  'AI Writing Assistant (Surfy)',
];

// All 4 plan column headers for the comparison table
const TABLE_PLAN_HEADERS = [
  { name: 'Discovery', price: '€59', cta: 'Try Discovery', ctaStyle: 'ghost' as const, recommended: false },
  { name: 'Standard', price: '€119', cta: 'Start with Standard', ctaStyle: 'gray' as const, recommended: false },
  { name: 'Pro', price: '€219', cta: 'Scale with Pro', ctaStyle: 'primary' as const, recommended: true },
  { name: 'Peace of Mind', price: '€359', cta: 'Get Peace of Mind', ctaStyle: 'gray' as const, recommended: false },
];

interface TableSection {
  title: string;
  rows: { label: string; cells: CellValue[] }[];
}

const SECTIONS: TableSection[] = [
  {
    title: 'Why choose?',
    rows: [
      {
        label: '',
        cells: [
          'Cover the basics. Create the foundational content you need to get started with Surfer and establish a baseline presence.',
          'Stop flying blind. Finally see if your brand is the answer in ChatGPT, and optimize your content to win the citation.',
          'Master the semantic web. Identify cannibalization, manage multiple brands, and get daily updates on how AI models perceive your authority.',
          "Future-proof your scale. Unlimited optimization and API access give you the power to control your brand's narrative across the web.",
        ],
      },
    ],
  },
  {
    title: 'Create and Optimize Content',
    rows: [
      { label: 'AI SEO Optimization Guidelines', cells: [true, true, true, true] },
      { label: 'AI Writing Assistant (Surfy)', cells: [true, true, true, true] },
      { label: 'Content Score', cells: [true, true, true, true] },
      { label: 'AI Detector & Humanizer', cells: [true, true, true, true] },
      { label: 'Documents', cells: [{ deg: 90, text: '10 Documents' }, { deg: 180, text: '30 Documents' }, { deg: 180, text: '30 Documents' }, { deg: 360, text: 'Unlimited* Documents' }] },
      { label: 'Plagiarism Check', cells: [false, true, true, true] },
      { label: '1-click Content Optimization', cells: [false, true, true, true] },
      { label: '1-click Internal Linking', cells: [false, false, true, true] },
    ],
  },
  {
    title: 'Track and Optimize Your AI Visibility',
    rows: [
      { label: 'Track AI Visibility', cells: [false, 'ChatGPT', 'ChatGPT, Perplexity, AI Mode, AI Overviews, Gemini', 'ChatGPT, Perplexity, AI Mode, AI Overviews, Gemini'] },
      { label: 'AI Prompts', cells: ['Track 0 AI Prompts', 'Track 25 AI Prompts (ChatGPT)', 'Track 50 AI Prompts (all models)', 'Track 100 AI Prompts (all models)'] },
      { label: 'Prompt refresh', cells: ['No prompt refresh', 'Weekly prompt refresh', 'Daily prompt refresh', 'Daily prompt refresh'] },
      { label: 'Mention Gap and Brand Sentiments', cells: [false, false, true, true] },
    ],
  },
  {
    title: 'Customize AI Writing and Optimization',
    rows: [
      { label: 'Brand Knowledge', cells: [false, true, true, true] },
      { label: 'Custom Voices', cells: [false, false, true, true] },
      { label: 'Custom Templates', cells: [false, false, '10 Custom Templates', 'Unlimited* Custom Templates'] },
    ],
  },
  {
    title: 'Plan, Track & Manage Your Content',
    rows: [
      { label: 'Brand Workspaces', cells: [{ deg: 90, text: 'Manage 1 Brand Workspace' }, { deg: 90, text: 'Manage 1 Brand Workspace' }, { deg: 180, text: 'Manage 5 Brand Workspaces' }, { deg: 360, text: 'Unlimited* Brand Workspaces' }] },
      { label: 'Pages', cells: ['Track 10 Pages', 'Track 50 Pages', 'Track 200 Pages', 'Track 500 Pages'] },
      { label: 'Content Audit', cells: [true, true, true, true] },
      { label: 'Keyword Research', cells: [false, true, true, true] },
      { label: 'Rank Drop Alerts', cells: [false, true, true, true] },
      { label: 'Topical Map', cells: [false, false, true, true] },
      { label: 'Cannibalization Report', cells: [false, false, true, true] },
      { label: 'Audit', cells: [false, false, true, true] },
      { label: 'SERP Analyzer', cells: [false, false, false, true] },
    ],
  },
  {
    title: 'Collaborate and Scale Together',
    rows: [
      { label: 'Team Seats', cells: [{ deg: 90, text: '1 Team Seat' }, { deg: 180, text: '3 Team Seats' }, { deg: 270, text: '5 Team Seats' }, { deg: 360, text: '10 Team Seats' }] },
      { label: 'Content Version History', cells: ['1 Day', '1 Week', '1 Month', '6 Months'] },
      { label: 'Activity Log', cells: ['1 Week', '1 Month', '1 Year', '16 Months'] },
      { label: 'Live Collaboration', cells: [false, true, true, true] },
      { label: 'Comments', cells: [false, true, true, true] },
      { label: 'Folders', cells: [false, true, true, true] },
      { label: 'External Collaboration Links', cells: [false, true, true, true] },
    ],
  },
  {
    title: 'Work Seamlessly Across Platforms',
    rows: [
      { label: 'Integrations', cells: [false, 'WordPress, Google Docs', 'WordPress, Google Docs, Contentful', 'WordPress, Google Docs, Contentful, Zapier'] },
      { label: 'Data Export', cells: [false, false, true, true] },
      { label: 'API Access', cells: [false, false, false, true] },
    ],
  },
  {
    title: 'Support',
    rows: [
      { label: 'Google Sign-In', cells: [true, true, true, true] },
      { label: 'Knowledge Base', cells: [true, true, true, true] },
      { label: 'Customer Support (24h, Mon–Fri)', cells: [true, true, true, true] },
      { label: 'Surfer Academy', cells: [true, true, true, true] },
      { label: 'Content Optimization Masterclass', cells: [true, true, true, true] },
      { label: 'AI Search Optimization Masterclass', cells: [true, true, true, true] },
      { label: 'Personalized Onboarding', cells: [false, false, true, true] },
      { label: 'Dedicated Customer Success Manager', cells: [false, false, false, true] },
    ],
  },
];

const FAQ_ITEMS = [
  { q: 'How does the 7-day trial work?', a: 'You get full access to all features in the chosen plan for 7 days, no credit card required. Cancel anytime before the trial ends to avoid being charged.' },
  { q: 'What payment methods do you accept?', a: 'We accept all major credit and debit cards (Visa, Mastercard, Amex) as well as PayPal and bank transfers for annual plans.' },
  { q: 'Can I upgrade or downgrade my account after purchase?', a: 'Yes, you can change your plan at any time from the billing settings. Upgrades take effect immediately; downgrades apply at the next billing cycle.' },
  { q: 'How does Surfer work?', a: 'Surfer analyzes top-ranking pages for your target keywords and provides data-driven recommendations to help you create and optimize content that ranks.' },
  { q: 'What languages does Surfer support?', a: 'Surfer supports over 170 languages for content analysis and optimization, making it suitable for global SEO strategies.' },
  { q: 'What is NLP?', a: 'Natural Language Processing (NLP) is a branch of AI that helps computers understand human language. Surfer uses NLP to identify semantically relevant terms for your content.' },
  { q: 'Who uses Surfer?', a: 'Surfer is used by SEO specialists, content marketers, agencies, and businesses of all sizes — from solo bloggers to enterprise teams.' },
  { q: 'Will my unused credits be carried over to the next billing cycle?', a: 'Credits reset at the start of each billing cycle and do not carry over. We recommend using them throughout the month for best results.' },
  { q: 'What is your cancellation policy?', a: 'You can cancel your subscription at any time. Your access continues until the end of the current billing period, after which it will not renew.' },
  { q: 'If I choose the annual plan, do I have to pay upfront for the entire year?', a: 'Yes, annual plans are billed upfront for the full year, which is how we are able to offer the discounted rate compared to monthly billing.' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const Separator = () => (
  <div role="separator" style={{ minHeight: 1, minWidth: 1, alignSelf: 'stretch', background: '#F4F4F5' }} />
);

const CtaButton = ({ label, style: ctaStyle, fullWidth }: { label: string; style: 'primary' | 'gray' | 'ghost'; fullWidth?: boolean }) => {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: fullWidth ? '100%' : undefined,
    padding: '9px 18px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    fontFamily: 'var(--font-family-primary)',
    cursor: 'pointer',
    transition: 'background 150ms ease, opacity 150ms ease',
    border: 'none',
    whiteSpace: 'nowrap',
  };

  if (ctaStyle === 'primary') {
    return (
      <button
        type="button"
        onClick={() => toast.success(`${label} — coming soon!`)}
        style={{ ...base, background: '#783AFB', color: '#fff' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.1)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = ''; }}
      >
        {label}
      </button>
    );
  }
  if (ctaStyle === 'gray') {
    return (
      <button
        type="button"
        onClick={() => toast.success(`${label} — coming soon!`)}
        style={{ ...base, background: '#F4F4F5', color: '#18181B' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#E4E4E7'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#F4F4F5'; }}
      >
        {label}
      </button>
    );
  }
  // ghost
  return (
    <button
      type="button"
      onClick={() => toast.success(`${label} — coming soon!`)}
      style={{ ...base, background: 'transparent', color: '#18181B', boxShadow: 'inset 0 0 0 1px #E4E4E7' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#F4F4F5'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
    >
      {label}
    </button>
  );
};

/** Static toggle pill (always off, purely decorative) */
const TogglePill = () => (
  <div
    style={{
      width: 32,
      height: 16,
      borderRadius: 9999,
      background: '#E4E4E7',
      position: 'relative',
      flexShrink: 0,
      cursor: 'default',
    }}
  >
    <div
      style={{
        position: 'absolute',
        top: 2,
        left: 2,
        width: 12,
        height: 12,
        borderRadius: 9999,
        background: '#9F9FA9',
      }}
    />
  </div>
);

/** Renders a single table cell value */
const CellContent = ({ value }: { value: CellValue }) => {
  if (value === true) return <Check color="#18181B" />;
  if (value === false) return <Cross />;
  if (typeof value === 'string') {
    return <span style={{ fontSize: 13, color: '#52525C', fontFamily: 'var(--font-family-primary)', lineHeight: '1.4' }}>{value}</span>;
  }
  // { deg, text }
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <Dot deg={value.deg} />
      <span style={{ fontSize: 13, color: '#52525C', fontFamily: 'var(--font-family-primary)' }}>{value.text}</span>
    </span>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const PricingPlansSettings = () => {
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  const toggleFaq = (i: number) => setFaqOpen((prev) => (prev === i ? null : i));

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 1080,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 48,
        fontFamily: 'var(--font-family-primary)',
      }}
    >
      {/* ── A) Header ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 20, borderBottom: '1px solid #F4F4F5' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <span style={{ fontSize: 20, fontWeight: 600, color: '#18181B', display: 'block' }}>Pricing &amp; Plans</span>
            <span style={{ fontSize: 14, color: '#9F9FA9', display: 'block', marginTop: 2 }}>For every stage of your journey.</span>
          </div>
          <span style={{ fontSize: 14, color: '#52525C', whiteSpace: 'nowrap', paddingTop: 4, flexShrink: 0 }}>
            Need more?{' '}
            <a
              href="#"
              style={{ color: '#18181B', textDecoration: 'underline', fontWeight: 500 }}
              onClick={(e) => { e.preventDefault(); toast('Contact our sales team!'); }}
            >
              Contact Sales
            </a>
          </span>
        </div>
      </div>

      {/* ── B) Three plan cards ────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {PLAN_CARDS.map((plan) => (
          <div
            key={plan.name}
            style={{
              position: 'relative',
              border: plan.recommended ? '2px solid #783AFB' : '1px solid #E4E4E7',
              borderRadius: plan.recommended ? '0 0 12px 12px' : 12,
              padding: '24px',
              background: plan.recommended
                ? 'linear-gradient(160deg, #F5F3FF 0%, #fff 60%)'
                : '#fff',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {/* "Recommended" pill above (top strip) */}
            {plan.recommended && (
              <div
                style={{
                  position: 'absolute',
                  top: -28,
                  left: -2,
                  right: -2,
                  background: '#783AFB',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  textAlign: 'center',
                  padding: '4px 0',
                  borderRadius: '8px 8px 0 0',
                  letterSpacing: '0.04em',
                }}
              >
                Recommended
              </div>
            )}

            {/* Name + price */}
            <div>
              <span style={{ fontSize: 18, fontWeight: 600, color: '#18181B', display: 'block' }}>{plan.name}</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 500, color: '#18181B' }}>{plan.price}</span>
                <span style={{ fontSize: 13, color: '#9F9FA9' }}>per month</span>
              </div>
            </div>

            {/* Billed yearly toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TogglePill />
              <span style={{ fontSize: 13, color: '#9F9FA9' }}>Billed yearly</span>
            </div>

            {/* Description */}
            <p style={{ fontSize: 13, color: '#52525C', lineHeight: '1.55', minHeight: 72, margin: 0 }}>
              {plan.desc}
            </p>

            {/* CTA */}
            <CtaButton label={plan.cta} style={plan.ctaStyle} fullWidth />

            {/* Divider */}
            <Separator />

            {/* Features */}
            {plan.featuresHeader && (
              <span style={{ fontSize: 12, fontWeight: 600, color: '#9F9FA9', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {plan.featuresHeader}
              </span>
            )}
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {plan.features.map((f) => (
                <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ marginTop: 1, flexShrink: 0 }}>
                    <Check color={plan.recommended ? '#783AFB' : '#18181B'} />
                  </span>
                  <span style={{ fontSize: 13, color: '#3F3F47', lineHeight: '1.45' }}>{f}</span>
                </li>
              ))}
            </ul>

            {/* "Most teams choose Pro" chip */}
            {plan.recommended && (
              <div
                style={{
                  marginTop: 4,
                  padding: '5px 12px',
                  background: 'rgba(120,58,251,0.08)',
                  borderRadius: 9999,
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#783AFB',
                  textAlign: 'center',
                }}
              >
                Most teams choose Pro
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── C) Discovery card ─────────────────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: '#18181B' }}>Not sure yet?</span>
          <span style={{ fontSize: 15, color: '#9F9FA9' }}>Start smaller</span>
          <span style={{ marginLeft: 'auto', fontSize: 13, color: '#52525C', maxWidth: 360, textAlign: 'right' }}>
            Choose Discovery to test Surfer. Upgrade anytime as your needs grow.
          </span>
        </div>

        <div style={{ border: '1px solid #E4E4E7', borderRadius: 12, padding: '24px', background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 17, fontWeight: 600, color: '#18181B' }}>Discovery</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 500, color: '#18181B' }}>€59</span>
                <span style={{ fontSize: 13, color: '#9F9FA9' }}>per month</span>
              </div>
              <p style={{ fontSize: 13, color: '#52525C', lineHeight: '1.5', maxWidth: 380, margin: '6px 0 0 0' }}>
                Draft and optimize content to establish a baseline presence in Google and AI search results.
              </p>
            </div>
            <div style={{ paddingTop: 4, flexShrink: 0 }}>
              <CtaButton label="Try Discovery" style="ghost" />
            </div>
          </div>

          <Separator />

          <ul
            style={{
              listStyle: 'none',
              margin: '16px 0 0 0',
              padding: 0,
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '8px 24px',
            }}
          >
            {DISCOVERY_FEATURES.map((f) => (
              <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ marginTop: 1, flexShrink: 0 }}><Check /></span>
                <span style={{ fontSize: 13, color: '#3F3F47', lineHeight: '1.45' }}>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── D) Compare Plans table ─────────────────────────────────────── */}
      <div>
        {/* Section header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: '#18181B' }}>Compare Plans</span>
          <span style={{ fontSize: 14, color: '#52525C' }}>
            Need more?{' '}
            <a
              href="#"
              style={{ color: '#18181B', textDecoration: 'underline', fontWeight: 500 }}
              onClick={(e) => { e.preventDefault(); toast('Contact our sales team!'); }}
            >
              Contact Sales
            </a>
          </span>
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid #E4E4E7', borderRadius: 12, background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 640 }}>
            <colgroup>
              <col style={{ width: '28%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '18%' }} />
            </colgroup>

            {/* Sticky plan header row */}
            <thead>
              <tr style={{ borderBottom: '2px solid #E4E4E7', position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
                <th style={{ padding: '16px 16px', textAlign: 'left' }} />
                {TABLE_PLAN_HEADERS.map((p) => (
                  <th key={p.name} style={{ padding: '16px 12px', textAlign: 'center', verticalAlign: 'top' }}>
                    {p.recommended && (
                      <div
                        style={{
                          background: '#783AFB',
                          color: '#fff',
                          fontSize: 10,
                          fontWeight: 600,
                          borderRadius: 9999,
                          padding: '2px 8px',
                          marginBottom: 4,
                          display: 'inline-block',
                        }}
                      >
                        Recommended
                      </div>
                    )}
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#18181B', fontFamily: 'var(--font-family-primary)' }}>{p.name}</div>
                    <div style={{ fontSize: 13, color: '#9F9FA9', fontFamily: 'var(--font-family-primary)', marginBottom: 8 }}>{p.price}</div>
                    <CtaButton label={p.cta} style={p.ctaStyle} fullWidth />
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {SECTIONS.map((section) => (
                <React.Fragment key={section.title}>
                  {/* Section title row */}
                  <tr style={{ borderTop: '1px solid #E4E4E7', borderBottom: '1px solid #E4E4E7', background: '#F4F4F5' }}>
                    <td
                      colSpan={5}
                      style={{
                        padding: '10px 16px',
                        fontSize: 13,
                        fontWeight: 600,
                        color: '#3F3F47',
                        fontFamily: 'var(--font-family-primary)',
                      }}
                    >
                      {section.title}
                    </td>
                  </tr>

                  {/* Feature rows */}
                  {section.rows.map((row, ri) => (
                    <tr
                      key={ri}
                      style={{ borderBottom: '1px solid #F4F4F5' }}
                    >
                      <td
                        style={{
                          padding: '12px 16px',
                          fontSize: 13,
                          color: '#3F3F47',
                          fontFamily: 'var(--font-family-primary)',
                          verticalAlign: 'middle',
                        }}
                      >
                        {row.label}
                      </td>
                      {row.cells.map((cell, ci) => (
                        <td
                          key={ci}
                          style={{
                            padding: '12px 12px',
                            textAlign: 'center',
                            verticalAlign: 'middle',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CellContent value={cell} />
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <p style={{ marginTop: 12, fontSize: 12, color: '#9F9FA9', textAlign: 'center', fontFamily: 'var(--font-family-primary)' }}>
          * Fair usage policy applies
        </p>
      </div>

      {/* ── E) Rating + FAQ ───────────────────────────────────────────── */}

      {/* Rating row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', gap: 2 }}>
          {[0, 1, 2, 3, 4].map((i) => <StarFilled key={i} />)}
        </div>
        <span style={{ fontSize: 14, fontWeight: 500, color: '#18181B', fontFamily: 'var(--font-family-primary)' }}>
          Rated 4.7 / 5 stars
        </span>
        <div
          style={{
            marginLeft: 12,
            padding: '6px 14px',
            border: '1px solid #E4E4E7',
            borderRadius: 8,
            fontSize: 12,
            color: '#9F9FA9',
            fontFamily: 'var(--font-family-primary)',
          }}
        >
          G2 Badges — High Performer
        </div>
      </div>

      {/* FAQ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid #E4E4E7', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
        {FAQ_ITEMS.map((item, i) => {
          const open = faqOpen === i;
          return (
            <div
              key={i}
              style={{ borderBottom: i < FAQ_ITEMS.length - 1 ? '1px solid #F4F4F5' : 'none' }}
            >
              <button
                type="button"
                onClick={() => toggleFaq(i)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  gap: 12,
                  textAlign: 'left',
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: '#18181B',
                    fontFamily: 'var(--font-family-primary)',
                    lineHeight: '1.4',
                  }}
                >
                  {item.q}
                </span>
                <ChevronDown open={open} />
              </button>
              {open && (
                <div style={{ padding: '0 20px 16px 20px' }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: '#52525C',
                      lineHeight: '1.6',
                      fontFamily: 'var(--font-family-primary)',
                    }}
                  >
                    {item.a}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
};

export default PricingPlansSettings;
