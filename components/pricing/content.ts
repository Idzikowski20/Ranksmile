/**
 * Pricing page — copy + structured data. Figma cn7zCRglwVkmcbCdT01bgI · 5:9646 1:1 (dark → light).
 * Marketing tiers mirror the reference (Discovery / Standard / Pro / Peace of Mind / Enterprise);
 * CTAs go to sign-up. Icons reused from /ai-tracking + /content-editor.
 */
import { LEGAL_COMPANY } from '@/src/core/domain/legal/company';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || LEGAL_COMPANY.website).replace(/\/$/, '');
export const SUPPORT_EMAIL = LEGAL_COMPANY.supportEmail;
export const SIGN_UP_HREF = '/auth/sign-up';
export const PATH = '/pricing';
export const EXPERT_HREF = `mailto:${LEGAL_COMPANY.supportEmail}?subject=Ranksmile%20Enterprise`;

export const META = {
  title: 'Pricing & Plans — win AI search, not guess it | Ranksmile',
  description:
    'Ranksmile pricing: Discovery, Standard, Pro and Peace of Mind plans plus a standalone AI Search Analytics '
    + 'tier. Content Score, AI visibility tracking across ChatGPT, Claude, Gemini and Perplexity, and 1-click publishing.',
  ogImage: `${SITE_URL}/icon-512x512.png`,
} as const;

export const HEAD = {
  titleStrong: 'Pricing & Plans ',
  titleMuted: ['for teams that want ', 'to win AI search — not guess it'],
  tabs: ['Full AI SEO', 'AI Search Analytics'] as const,
  needMore: 'Need more?',
  expert: 'Talk to a Ranksmile Expert',
} as const;

export type Plan = {
  slug: string;
  name: string;
  price: number;
  yearlySaving: number;
  desc: string;
  recommended?: boolean;
  everything?: string;
  features: string[];
  footer: string;
};

/* The three hero plans (Figma 5:2667). Prices are the reference's marketing figures. */
export const PLANS: Plan[] = [
  {
    slug: 'standard',
    name: 'Standard',
    price: 99,
    yearlySaving: 240,
    desc: 'Align your team with a unified workflow and start growing your visibility in AI search.',
    features: [
      'Create or Optimize 360 Documents', 'Track AI Visibility', 'Track 25 AI Prompts, refreshed weekly',
      'Integrations', 'Brand Knowledge', '1-click Content Optimization', 'Team Collaboration',
      'Plagiarism Checker', 'Rank Drop Detection',
    ],
    footer: 'Best for growing content teams',
  },
  {
    slug: 'pro',
    name: 'Pro',
    price: 182,
    yearlySaving: 444,
    recommended: true,
    desc: 'Secure your authority, fix technical conflicts, and manage AI perception at scale.',
    everything: 'Everything in Standard, plus:',
    features: [
      'Create or Optimize 360 Documents', 'Track AI Visibility', 'Track 50 AI Prompts, refreshed daily',
      'Integrations', '5 Brand Workspaces', '1-click Internal Linking', 'Content Ideas & Coverage Gap',
      'Templates & Custom Voices', 'Cannibalization Report',
    ],
    footer: 'Most teams choose Pro',
  },
  {
    slug: 'peace',
    name: 'Peace of Mind',
    price: 299,
    yearlySaving: 720,
    desc: 'Dominate the market with uncapped optimization, API access, and VIP support.',
    everything: 'Everything in Pro, plus:',
    features: [
      'Create or Optimize Unlimited* Documents', 'Track AI Visibility', 'Track 100 AI Prompts, refreshed daily',
      'Integrations', 'Unlimited Brand Workspaces', 'Advanced SERP Analysis', 'Personalized Onboarding',
      'Dedicated Success Manager', 'API Access',
    ],
    footer: 'For agencies and large teams',
  },
];

export const SMALLER = {
  head: { strong: 'Not sure yet?', muted: ' Start smaller — or go bigger.' },
  sub: 'Choose Discovery to test Ranksmile, or Enterprise if you need custom scale and security',
  discovery: {
    name: 'Discovery',
    price: 49,
    yearlySaving: 120,
    desc: 'Draft and optimize content to establish a baseline presence in Google and AI search results.',
    cta: 'Start for Free',
    features: [
      'Create or Optimize 120 Documents', 'Track 10 Pages', 'AI SEO Optimization Guidelines',
      'Surfy (AI SEO Assistant) & Humanizer',
    ],
    footer: 'Upgrade anytime as your needs grow',
  },
  enterprise: {
    name: 'Enterprise',
    price: 999,
    desc: 'Lead your category with advisory-led strategy, automation, and enterprise-grade controls.',
    tag: 'Tailored packages',
    cta1: 'Talk to a Ranksmile Expert',
    cta2: 'Learn more',
    features: [
      'SSO & Enterprise-grade Security', 'Comprehensive Advisory Program', 'Legal Onboarding Assistance',
      'Early access to new features', 'Custom Limits', 'Tailored Team Onboarding', 'White-label', 'Priority Support',
    ],
    footer: 'Custom solutions for complex needs.',
  },
} as const;

/* AI Search Analytics tab (Figma 5:3223) — standalone add-on with a daily-prompt slider. */
export const ANALYTICS = {
  eyebrow: 'Focus on AI Visibility',
  sub: 'Get AI Search Analytics on its own, upgrade anytime.',
  title: 'AI Search Analytics',
  desc: "Track & improve your brand's position in AI answers.",
  price: 158,
  yearlySaving: 324,
  question: 'How many prompts do you want to track daily?',
  stops: ['50', '100', '200', '∞'],
  hint: { strong: 'Most brands start here ', muted: '— covers your brand and competitors.' },
  ctaMuted: ' — cancel or switch plan anytime.',
  includes: 'Includes:',
  items: [
    'Track 100 AI Prompts, refreshed daily', 'Key LLM models', '5 Brand Workspaces',
    'Mention Gap and Brand Sentiment', 'Visibility Score & Share of Voice', 'Export Reports (CSV)',
  ],
  learnMore: 'Learn more',
} as const;

/* Compare table (Figma 5:7750) — columns Discovery/Standard/Pro/Peace of Mind. */
export const COMPARE_COLS = [
  { name: 'Discovery', price: 49 },
  { name: 'Standard', price: 99 },
  { name: 'Pro', price: 182 },
  { name: 'Peace of Mind', price: 299 },
] as const;

const Y = true;
const N = false;
type Cell = boolean | string;
type CmpRow = { label: string; cells: [Cell, Cell, Cell, Cell] };

export const COMPARE: { title: string; note?: string; rows: CmpRow[] }[] = [
  {
    title: 'Create and Optimize Content',
    rows: [
      { label: 'AI SEO Optimization', cells: [Y, Y, Y, Y] },
      { label: 'AI Writing Assistant (Surfy)', cells: [Y, Y, Y, Y] },
      { label: 'Content Score', cells: [Y, Y, Y, Y] },
      { label: 'AI Detector & Humanizer', cells: [Y, Y, Y, Y] },
      { label: 'Documents', cells: ['120', '360', '360', 'Unlimited*'] },
      { label: 'Plagiarism Check', cells: [Y, Y, Y, Y] },
      { label: '1-click content optimization', cells: [Y, Y, Y, Y] },
      { label: '1-click Internal Linking', cells: [N, N, Y, Y] },
    ],
  },
  {
    title: 'Track and Optimize Your AI Visibility',
    rows: [
      { label: 'Track AI Visibility', cells: ['ChatGPT', 'ChatGPT', 'All 5 engines', 'All 5 engines'] },
      { label: 'AI Prompts', cells: ['—', '25 · weekly', '50 · daily', '100 · daily'] },
      { label: 'Mention Gap and Brand Sentiment', cells: [N, Y, Y, Y] },
    ],
  },
  {
    title: 'Customize AI Writing and Optimization',
    rows: [
      { label: 'Brand Knowledge', cells: [N, Y, Y, Y] },
      { label: 'Custom Voices', cells: [N, N, Y, Y] },
      { label: 'Custom Templates', cells: [N, N, '10', 'Unlimited*'] },
      { label: 'Brand Workspaces', cells: ['1', '1', '5', 'Unlimited*'] },
    ],
  },
  {
    title: 'Plan, Track & Manage Your Content',
    rows: [
      { label: 'Track Pages', cells: ['10', '50', '200', '500'] },
      { label: 'Content Audit', cells: [Y, Y, Y, Y] },
      { label: 'Ranking Drop Alerts', cells: [N, Y, Y, Y] },
      { label: 'Keyword Research', cells: [N, Y, Y, Y] },
      { label: 'Topical Map', cells: [N, Y, Y, Y] },
      { label: 'Cannibalization Report', cells: [N, N, Y, Y] },
      { label: 'Audit', cells: [N, Y, Y, Y] },
      { label: 'SERP Analyzer', cells: [N, N, Y, Y] },
    ],
  },
  {
    title: 'Collaborate and Scale Together',
    rows: [
      { label: 'Team Seats', cells: ['1', '3', '5', '10'] },
      { label: 'Content version history', cells: ['1 day', '1 week', '1 month', '6 months'] },
      { label: 'Activity Log', cells: [N, '1 week', '1 month', '12 months'] },
      { label: 'Live Collaboration', cells: [Y, Y, Y, Y] },
      { label: 'Comments', cells: [Y, Y, Y, Y] },
      { label: 'Folders', cells: [N, Y, Y, Y] },
      { label: 'External Collaboration Links', cells: [N, Y, Y, Y] },
    ],
  },
  {
    title: 'Work Seamlessly Across Platforms',
    rows: [
      { label: 'Integrations', cells: ['—', 'WordPress · Docs', 'WordPress · Docs · Contentful', 'All + Zapier'] },
      { label: 'Data Export', cells: [N, Y, Y, Y] },
      { label: 'API Access', cells: [N, N, N, Y] },
    ],
  },
  {
    title: 'Support',
    rows: [
      { label: 'Google Sign-In', cells: [Y, Y, Y, Y] },
      { label: 'Knowledge Base', cells: [Y, Y, Y, Y] },
      { label: 'Customer Support (24h, Mon–Fri)', cells: [Y, Y, Y, Y] },
      { label: 'Ranksmile Academy', cells: [Y, Y, Y, Y] },
      { label: 'Content Optimization Masterclass', cells: [Y, Y, Y, Y] },
      { label: 'AI Search Optimization Masterclass', cells: [Y, Y, Y, Y] },
      { label: 'Personalized Onboarding', cells: [N, N, Y, Y] },
      { label: 'Dedicated Customer Success Manager', cells: [N, N, N, Y] },
    ],
  },
];

export const COMPARE_HEAD = { title: 'Compare Full AI SEO Plans', fair: '* fair usage policy applies' } as const;

export const FAQ_LEFT = [
  {
    q: 'Which plan is right for me?',
    a: 'Start with Discovery to test Ranksmile, Standard to align a team, Pro to manage AI perception at scale, or '
      + 'Peace of Mind for uncapped optimization and API access. You can switch or cancel anytime.',
  },
  {
    q: 'Can I change plans later?',
    a: 'Yes. Upgrade or downgrade whenever your needs change — the difference is prorated and takes effect immediately.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Every plan starts free. Growth-level plans include a 7-day trial with no long-term contract.',
  },
  {
    q: 'What does "billed yearly" mean?',
    a: 'Yearly billing charges 12 months up front at a lower per-month rate — the saving is shown on each plan. '
      + 'Monthly billing is also available.',
  },
] as const;

export const FAQ_RIGHT = [
  {
    q: 'What counts as a tracked AI prompt?',
    a: 'One buyer-intent question Ranksmile sends to every supported engine on your schedule and records the answer for.',
  },
  {
    q: 'Which AI engines are included?',
    a: 'ChatGPT on Standard; ChatGPT, Claude, Gemini, Perplexity and Google AI Overviews on Pro and above.',
  },
  {
    q: 'Do you offer an Enterprise plan?',
    a: 'Yes — Enterprise adds SSO, white-label, custom limits, legal onboarding and a dedicated success manager. '
      + 'Talk to a Ranksmile Expert for a tailored package.',
  },
  {
    q: 'Can I buy AI Search Analytics on its own?',
    a: 'Yes. The AI Search Analytics tier tracks your brand across the LLMs without the full SEO suite, and you can '
      + 'upgrade to a full plan anytime.',
  },
] as const;

export const CTA = {
  titleLines: ['Your Brand Deserves to', 'Be Seen—Everywhere'],
  subLines: ['AI is shaping decisions. If you’re not in the answers,', 'you’re not even considered. Win the next wave of search.'],
  cta: 'Start for Free',
  note: 'Real connections start with being found',
} as const;

export function buildJsonLd(): Record<string, unknown>[] {
  const faq = [...FAQ_LEFT, ...FAQ_RIGHT];
  const offers = [...COMPARE_COLS, { name: ANALYTICS.title, price: ANALYTICS.price }].map((c) => ({
    '@type': 'Offer',
    name: c.name,
    price: c.price,
    priceCurrency: 'USD',
    url: `${SITE_URL}${PATH}`,
    priceSpecification: { '@type': 'UnitPriceSpecification', price: c.price, priceCurrency: 'USD', billingDuration: 'P1M' },
  }));
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      '@id': `${SITE_URL}${PATH}#product`,
      name: 'Ranksmile',
      description: META.description,
      offers,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      '@id': `${SITE_URL}${PATH}#faq`,
      mainEntity: faq.map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })),
    },
  ];
}
