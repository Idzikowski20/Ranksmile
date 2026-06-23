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
  priceMonthly: number;
  priceYearly: number;
  save: number;
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
    priceMonthly: 119,
    priceYearly: 99,
    save: 240,
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
    priceMonthly: 219,
    priceYearly: 182,
    save: 444,
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
    priceMonthly: 359,
    priceYearly: 299,
    save: 720,
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
  { name: 'Discovery', priceMonthly: 59, priceYearly: 49, cta: 'Try Discovery', ctaStyle: 'ghost' as const, recommended: false },
  { name: 'Standard', priceMonthly: 119, priceYearly: 99, cta: 'Start with Standard', ctaStyle: 'gray' as const, recommended: false },
  { name: 'Pro', priceMonthly: 219, priceYearly: 182, cta: 'Scale with Pro', ctaStyle: 'primary' as const, recommended: true },
  { name: 'Peace of Mind', priceMonthly: 359, priceYearly: 299, cta: 'Get Peace of Mind', ctaStyle: 'gray' as const, recommended: false },
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

// ─── Section icons (inline SVG, 20px, stroke) ─────────────────────────────────

const IconStar = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const IconFeather = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
    <line x1="16" y1="8" x2="2" y2="22" />
    <line x1="17.5" y1="15" x2="9" y2="15" />
  </svg>
);

const IconRadio = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="2" />
    <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
  </svg>
);

const IconSliders = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="4" y1="21" x2="4" y2="14" />
    <line x1="4" y1="10" x2="4" y2="3" />
    <line x1="12" y1="21" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12" y2="3" />
    <line x1="20" y1="21" x2="20" y2="16" />
    <line x1="20" y1="12" x2="20" y2="3" />
    <line x1="1" y1="14" x2="7" y2="14" />
    <line x1="9" y1="8" x2="15" y2="8" />
    <line x1="17" y1="16" x2="23" y2="16" />
  </svg>
);

const IconClipboard = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
  </svg>
);

const IconUsers = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const IconLink = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const IconHeadphones = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
  </svg>
);

/** Map section title → icon component */
const SECTION_ICONS: Record<string, React.ReactNode> = {
  'Why choose?': <IconStar />,
  'Create and Optimize Content': <IconFeather />,
  'Track and Optimize Your AI Visibility': <IconRadio />,
  'Customize AI Writing and Optimization': <IconSliders />,
  'Plan, Track & Manage Your Content': <IconClipboard />,
  'Collaborate and Scale Together': <IconUsers />,
  'Work Seamlessly Across Platforms': <IconLink />,
  'Support': <IconHeadphones />,
};

// ─── AI Model logos (inline SVG, 18px, bordered circle) ───────────────────────

const ModelIcon = ({ name }: { name: string }) => {
  // Simple distinct glyphs per model inside a tiny circle
  const glyphs: Record<string, React.ReactNode> = {
    ChatGPT: (
      <svg viewBox="0 0 10 10" fill="none" width="10" height="10">
        <circle cx="5" cy="5" r="3.5" stroke="#18181B" strokeWidth="1" />
        <path d="M3 5h4M5 3v4" stroke="#18181B" strokeWidth="0.9" strokeLinecap="round" />
      </svg>
    ),
    Perplexity: (
      <svg viewBox="0 0 10 10" fill="none" width="10" height="10">
        <path d="M5 1.5L8.5 5 5 8.5 1.5 5Z" stroke="#18181B" strokeWidth="0.9" strokeLinejoin="round" />
      </svg>
    ),
    'AI Mode': (
      <svg viewBox="0 0 10 10" fill="none" width="10" height="10">
        <rect x="2" y="2" width="6" height="6" rx="1" stroke="#18181B" strokeWidth="0.9" />
        <circle cx="5" cy="5" r="1.2" fill="#18181B" />
      </svg>
    ),
    'AI Overviews': (
      <svg viewBox="0 0 10 10" fill="none" width="10" height="10">
        <path d="M5 1.5 C2.5 1.5 1.5 3 1.5 5 C1.5 7 2.5 8.5 5 8.5 C7.5 8.5 8.5 7 8.5 5 C8.5 3 7.5 1.5 5 1.5Z" stroke="#18181B" strokeWidth="0.9" />
        <path d="M3 5 L5 3 L7 5" stroke="#18181B" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    Gemini: (
      <svg viewBox="0 0 10 10" fill="none" width="10" height="10">
        <path d="M5 1L5 9M1 5L9 5" stroke="#18181B" strokeWidth="0.9" strokeLinecap="round" />
        <path d="M2.5 2.5L7.5 7.5M7.5 2.5L2.5 7.5" stroke="#18181B" strokeWidth="0.6" strokeLinecap="round" />
      </svg>
    ),
  };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 18,
        height: 18,
        borderRadius: 9999,
        border: '0.5px solid #E4E4E7',
        flexShrink: 0,
        background: '#fff',
      }}
    >
      {glyphs[name] ?? (
        <svg viewBox="0 0 10 10" fill="none" width="10" height="10">
          <circle cx="5" cy="5" r="3" stroke="#18181B" strokeWidth="0.9" />
        </svg>
      )}
    </span>
  );
};

/** Returns true if a string value should be treated as "negative/zero" */
const isNegativeString = (s: string) =>
  s.startsWith('Track 0') || s.startsWith('No ') || s === '';

// ─── Per-column cell renderer ─────────────────────────────────────────────────

const AI_MODELS_STANDARD = ['ChatGPT'];
const AI_MODELS_FULL = ['ChatGPT', 'Perplexity', 'AI Mode', 'AI Overviews', 'Gemini'];

interface FeatureCellProps {
  value: CellValue;
  label: string;
  isAiVisibilityRow?: boolean;
}

const FeatureCell = ({ value, label, isAiVisibilityRow }: FeatureCellProps) => {
  const font: React.CSSProperties = { fontFamily: 'var(--font-family-primary)', fontSize: 13, lineHeight: '1.45' };

  // Special case: Track AI Visibility row
  if (isAiVisibilityRow) {
    if (value === false) {
      return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <span style={{ flexShrink: 0, marginTop: 1 }}><Cross /></span>
          <span style={{ ...font, color: '#9F9FA9' }}>{label}</span>
        </div>
      );
    }
    // value is a string like 'ChatGPT' or 'ChatGPT, Perplexity, ...'
    const models = typeof value === 'string'
      ? (value === 'ChatGPT' ? AI_MODELS_STANDARD : AI_MODELS_FULL)
      : AI_MODELS_FULL;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <span style={{ flexShrink: 0, marginTop: 1 }}><Check color="#18181B" /></span>
          <span style={{ ...font, color: '#18181B' }}>{label}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 24 }}>
          {models.map((m) => (
            <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ModelIcon name={m} />
              <span style={{ ...font, color: '#52525C' }}>{m}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // boolean true
  if (value === true) {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <span style={{ flexShrink: 0, marginTop: 1 }}><Check color="#18181B" /></span>
        <span style={{ ...font, color: '#18181B' }}>{label}</span>
      </div>
    );
  }

  // boolean false
  if (value === false) {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <span style={{ flexShrink: 0, marginTop: 1 }}><Cross /></span>
        <span style={{ ...font, color: '#9F9FA9' }}>{label}</span>
      </div>
    );
  }

  // string value
  if (typeof value === 'string') {
    const neg = isNegativeString(value);
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <span style={{ flexShrink: 0, marginTop: 1 }}>
          {neg ? <Cross /> : <Check color="#18181B" />}
        </span>
        <span style={{ ...font, color: neg ? '#9F9FA9' : '#18181B' }}>{value}</span>
      </div>
    );
  }

  // { deg, text }
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
      <span style={{ flexShrink: 0, marginTop: 2 }}><Dot deg={value.deg} /></span>
      <span style={{ ...font, color: '#52525C' }}>{value.text}</span>
    </div>
  );
};

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

/** Billing-period toggle pill */
const TogglePill = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={on}
    style={{
      width: 32,
      height: 16,
      borderRadius: 9999,
      background: on ? '#783AFB' : '#E4E4E7',
      position: 'relative',
      flexShrink: 0,
      cursor: 'pointer',
      border: 'none',
      padding: 0,
      transition: 'background 150ms ease',
    }}
  >
    <div
      style={{
        position: 'absolute',
        top: 2,
        left: on ? 18 : 2,
        width: 12,
        height: 12,
        borderRadius: 9999,
        background: '#fff',
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        transition: 'left 150ms ease',
      }}
    />
  </button>
);

// ─── Main component ───────────────────────────────────────────────────────────

const PricingPlansSettings = () => {
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('yearly');

  const toggleFaq = (i: number) => setFaqOpen((prev) => (prev === i ? null : i));
  const toggleBilling = () => setBilling((prev) => (prev === 'yearly' ? 'monthly' : 'yearly'));

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
                <span style={{ fontSize: 15, fontWeight: 500, color: '#18181B' }}>€{billing === 'yearly' ? plan.priceYearly : plan.priceMonthly}</span>
                <span style={{ fontSize: 13, color: '#9F9FA9' }}>per month</span>
              </div>
            </div>

            {/* Billed yearly toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <TogglePill on={billing === 'yearly'} onClick={toggleBilling} />
              <span style={{ fontSize: 13, color: '#52525C' }}>Billed yearly</span>
              {billing === 'yearly' && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#1AB25E',
                    background: 'rgba(26,178,94,0.1)',
                    padding: '2px 8px',
                    borderRadius: 9999,
                  }}
                >
                  Save €{plan.save}
                </span>
              )}
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
                <span style={{ fontSize: 15, fontWeight: 500, color: '#18181B' }}>€{billing === 'yearly' ? 49 : 59}</span>
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

        {/* Table wrapper — must be a real scrollable container for sticky to work */}
        <div style={{ overflowX: 'auto', border: '1px solid #E4E4E7', borderRadius: 12, background: '#fff', position: 'relative' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 640 }}>
            <colgroup>
              <col style={{ width: '25%' }} />
              <col style={{ width: '25%' }} />
              <col style={{ width: '25%' }} />
              <col style={{ width: '25%' }} />
            </colgroup>

            {/* Sticky plan-header row — position:sticky top:0 z-index:30 */}
            <thead>
              <tr style={{ borderBottom: '2px solid #E4E4E7' }}>
                {TABLE_PLAN_HEADERS.map((p) => (
                  <th
                    key={p.name}
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 30,
                      background: p.recommended
                        ? 'linear-gradient(160deg,#F5F3FF 0%,#fff 70%)'
                        : '#fff',
                      padding: '0',
                      textAlign: 'left',
                      verticalAlign: 'top',
                      borderBottom: '2px solid #E4E4E7',
                    }}
                  >
                    {/* "Recommended" violet pill above the Pro column */}
                    {p.recommended && (
                      <div
                        style={{
                          background: '#783AFB',
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 600,
                          textAlign: 'center',
                          padding: '4px 0',
                          letterSpacing: '0.04em',
                        }}
                      >
                        Recommended
                      </div>
                    )}
                    <div style={{ padding: '16px 20px 20px 20px' }}>
                      <div
                        style={{
                          fontSize: 17,
                          fontWeight: 600,
                          color: '#18181B',
                          fontFamily: 'var(--font-family-primary)',
                          marginBottom: 4,
                        }}
                      >
                        {p.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 14 }}>
                        <span style={{ fontSize: 15, fontWeight: 500, color: '#18181B', fontFamily: 'var(--font-family-primary)' }}>
                          €{billing === 'yearly' ? p.priceYearly : p.priceMonthly}
                        </span>
                        <span style={{ fontSize: 13, color: '#9F9FA9', fontFamily: 'var(--font-family-primary)' }}>
                          per month
                        </span>
                      </div>
                      <CtaButton label={p.cta} style={p.ctaStyle} fullWidth />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {SECTIONS.map((section) => {
                const isWhyChoose = section.title === 'Why choose?';
                const isAiVisibility = section.title === 'Track and Optimize Your AI Visibility';
                return (
                  <React.Fragment key={section.title}>
                    {/* Sticky section-title row — top: 184px (plan header height), z-index: 20 */}
                    <tr>
                      <td
                        colSpan={4}
                        style={{
                          position: 'sticky',
                          top: 184,
                          zIndex: 20,
                          background: '#fff',
                          padding: '12px 20px',
                          borderTop: '1px solid #F4F4F5',
                          borderBottom: '1px solid #F4F4F5',
                          fontSize: 14,
                          fontWeight: 500,
                          color: '#3F3F47',
                          fontFamily: 'var(--font-family-primary)',
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#3F3F47' }}>
                          {SECTION_ICONS[section.title] ?? <IconStar />}
                          {section.title}
                        </span>
                      </td>
                    </tr>

                    {/* Feature rows — 4 cells each, no separate label column */}
                    {section.rows.map((row, ri) => (
                      <tr key={ri} style={{ borderBottom: '1px solid #F4F4F5' }}>
                        {row.cells.map((cell, ci) => {
                          const isAiVis = isAiVisibility && row.label === 'Track AI Visibility';
                          return (
                            <td
                              key={ci}
                              style={{
                                padding: isWhyChoose ? '16px 20px' : '12px 20px',
                                verticalAlign: isWhyChoose ? 'top' : 'middle',
                                fontSize: 13,
                                color: '#52525C',
                                fontFamily: 'var(--font-family-primary)',
                                lineHeight: '1.5',
                              }}
                            >
                              {isWhyChoose ? (
                                /* "Why choose?" cells: plain paragraph */
                                <p style={{ margin: 0, fontSize: 13, color: '#52525C', fontFamily: 'var(--font-family-primary)', lineHeight: '1.55' }}>
                                  {typeof cell === 'string' ? cell : ''}
                                </p>
                              ) : (
                                <FeatureCell value={cell} label={row.label} isAiVisibilityRow={isAiVis} />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
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
        <div style={{ marginLeft: 12, display: 'flex', alignItems: 'center' }}>
          {[
            { i: 'JK', c: '#F4A4B0' },
            { i: 'MR', c: '#F6C177' },
            { i: 'AL', c: '#A4C8F0' },
            { i: 'SP', c: '#B7E2C0' },
            { i: 'TD', c: '#D4B7F0' },
          ].map((a, idx) => (
            <span
              key={a.i}
              style={{
                width: 28,
                height: 28,
                borderRadius: 9999,
                background: a.c,
                color: '#fff',
                fontSize: 11,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #fff',
                marginLeft: idx === 0 ? 0 : -8,
                fontFamily: 'var(--font-family-primary)',
              }}
            >
              {a.i}
            </span>
          ))}
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
