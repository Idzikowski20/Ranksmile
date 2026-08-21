/**
 * Landing copy + structured data in one place so the page, JSON-LD, llms.txt and
 * sitemap never drift apart. Pricing is read from the billing source of truth.
 *
 * Layout follows the Figma reference (cn7zCRglwVkmcbCdT01bgI · 2:80) 1:1; copy is
 * Ranksmile's own — no borrowed customer logos, testimonials or review scores.
 */
import { PLAN_DEFINITIONS, PLAN_HIERARCHY } from '../../lib/pricing/planDefinition';
import { LEGAL_COMPANY } from '../../lib/legal/company';

export const SITE_NAME = 'Ranksmile';
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || LEGAL_COMPANY.website).replace(/\/$/, '');
export const SUPPORT_EMAIL = LEGAL_COMPANY.supportEmail;

export const META = {
  title: 'Ranksmile — Be the answer in Google and every AI engine',
  description:
    'Ranksmile scores your content, tracks where ChatGPT, Claude, Gemini, Perplexity and Google AI Overviews '
    + 'cite your brand, and turns every gap into a prioritized task. 7-day free trial.',
  ogImage: `${SITE_URL}/icon-512x512.png`,
} as const;

/** Engines the product tracks (lib/providers/dataforseoLlm — five LLM engines + Google). */
export const ENGINES = ['Google', 'ChatGPT', 'Claude', 'Gemini', 'Perplexity', 'AI Overviews'] as const;

export const SIGN_IN_HREF = '/auth/sign-in';
export const SIGN_UP_HREF = '/auth/sign-up';
export const PRICING_HREF = '/plans';

export type NavMenu = { label: string; items?: { label: string; href: string; hint?: string }[]; href?: string };

export const NAV: NavMenu[] = [
  {
    label: 'Platform',
    items: [
      { label: 'Content Score', href: '#platform', hint: 'Live on-page optimization score' },
      { label: 'AI Visibility', href: '#demo', hint: 'Who the engines cite — and why' },
      { label: 'Rank Tracking', href: '#workflow', hint: 'Daily positions per country and device' },
      { label: 'Coverage & Keyword Gap', href: '#workflow', hint: 'Queries competitors own' },
    ],
  },
  {
    label: 'Solutions',
    items: [
      { label: 'In-house SEO teams', href: '#solution' },
      { label: 'Agencies', href: '#solution' },
      { label: 'Content managers & writers', href: '#workflow' },
    ],
  },
  {
    label: 'Resources',
    items: [
      { label: 'WordPress plugin', href: '/downloads/ranksmile-plugin.zip' },
      { label: 'llms.txt', href: '/llms.txt' },
      { label: 'pricing.md', href: '/pricing.md' },
      { label: 'Legal hub', href: '/legal' },
    ],
  },
  { label: 'Pricing', href: PRICING_HREF },
  {
    label: 'About Ranksmile',
    items: [
      { label: 'Contact', href: `mailto:${SUPPORT_EMAIL}` },
      { label: 'Terms of Service', href: '/legal/terms' },
      { label: 'Privacy Policy', href: '/legal/privacy' },
    ],
  },
];

export const ANNOUNCEMENT = {
  strong: 'Ranksmile tracks five AI engines',
  rest: ' — one workflow to rank in Google and get cited in AI answers',
  cta: 'See how it works',
  href: '#demo',
} as const;

/** Avatar stack under the hero — services Ranksmile reads from or publishes to. */
export const HERO_AVATARS: { label: string; icon?: 'google' | 'openai' | 'github'; letter?: string; dot?: boolean }[] = [
  { label: 'Google', icon: 'google' },
  { label: 'ChatGPT', icon: 'openai', dot: true },
  { label: 'Claude', letter: 'C' },
  { label: 'Gemini', letter: 'G', dot: true },
  { label: 'Perplexity', letter: 'P' },
  { label: 'AI Overviews', letter: 'A', dot: true },
  { label: 'WordPress', letter: 'W' },
  { label: 'Search Console', letter: 'S', dot: true },
  { label: 'Bing', letter: 'B' },
  { label: 'GitHub', icon: 'github' },
  { label: 'Copilot', letter: 'M', dot: true },
  { label: 'Your site', letter: 'Y' },
];

export const STATS = [
  {
    value: 84,
    suffix: '%',
    from: '24%',
    lead: "That's ",
    strong: 'how much AI usage for vendor discovery exploded',
    tail: ' in just 12 months.',
    source: { label: 'Wynter', href: 'https://wynter.com' },
    shape: 'area' as const,
  },
  {
    value: 43,
    suffix: '%',
    lead: "That's ",
    strong: 'how many consumers trust AI answers',
    tail: ' despite AI hallucinations.',
    source: { label: 'Attest 2025 AI Report', href: 'https://www.askattest.com' },
    shape: 'bar' as const,
  },
  {
    value: 2.5,
    suffix: ' B',
    decimals: 1,
    lead: "That's ",
    strong: 'how many prompts ChatGPT handles per day',
    tail: ' — already more than Bing.',
    source: { label: 'Superlines', href: 'https://www.superlines.io' },
    shape: 'grid' as const,
  },
] as const;

export const PILLARS = [
  {
    title: 'Pre-set:',
    strong: 'Stop guessing what the algorithm wants.',
    body: ' Our system is trained on what actually drives visibility in Google and AI search and engineered to '
      + 'self-improve with every algorithm update.',
  },
  {
    title: 'Pre-trained:',
    strong: 'Never sound like a robot.',
    body: " We embed your brand's unique positioning, differentiators, and tone of voice directly into every "
      + 'workflow, so every output is unmistakably yours — with minimal effort on your side.',
  },
  {
    title: 'Pro-action:',
    strong: 'Get an always-on visibility teammate',
    body: ' that provides expert-level direction for every team member — from CMO to a marketing junior, helping '
      + 'you improve the entire content cycle, continuously.',
  },
] as const;

export const USE_CASES = [
  {
    tag: 'In-house teams',
    muted: 'One scoreboard for rankings and AI citations. ',
    strong: 'Replace the spreadsheet of rank checks, GSC exports and "did ChatGPT mention us?" screenshots',
    tail: ' with a single daily view the whole content team reads.',
    name: 'Built for SEO and content teams',
    role: 'Workspaces, roles and invites — no extra seats for viewers',
  },
  {
    tag: 'Agencies',
    muted: 'Every client brand in its own space. ',
    strong: 'White-label reporting and API access on Agency plans',
    tail: ' let you run many clients without juggling logins — and prove the lift in citations, not just rankings.',
    name: 'Built for agencies',
    role: 'Brand spaces · white-label · API',
    link: { label: 'See plans', href: PRICING_HREF },
  },
] as const;

export type WorkflowStep = {
  id: string;
  index: string;
  label: string;
  headingStrong: string;
  headingMuted: string;
  tone: 'brand' | 'green' | 'blue';
  items: { title: string; body?: string }[];
};

export const WORKFLOW: WorkflowStep[] = [
  {
    id: 'diagnose',
    index: '01',
    label: 'Diagnose',
    headingStrong: 'See where you win — and where you fall short.',
    headingMuted: ' Across Google, AI Overviews, and every LLM that names brands.',
    tone: 'brand',
    items: [
      {
        title: 'Analyze AI Visibility',
        body: 'See exactly what top AI models say about you to real users, spot answers that prioritize competitors '
          + 'over you, and get a clear action plan to fix it.',
      },
      {
        title: 'Audit Existing Content',
        body: 'Every published page is scored against the sources the engines actually cite. Thin, stale or '
          + 'off-topic pages surface first.',
      },
      {
        title: 'Find Competitive Gaps',
        body: 'Competitor keyword gap and coverage gap show the queries your rivals own and you do not cover at all.',
      },
    ],
  },
  {
    id: 'fix',
    index: '02',
    label: 'Fix the gaps',
    headingStrong: 'Turn insights into content built to rank & be cited.',
    headingMuted: ' One task list. One closed-loop content workflow.',
    tone: 'green',
    items: [
      {
        title: 'Get a Prioritized Action List',
        body: 'Every gap, drop, and opportunity becomes an actionable task — sorted by what will lift visibility '
          + 'fastest. The “what should we work on next?” debate ends here.',
      },
      {
        title: 'Write & Optimize with Live Guidelines',
        body: 'The editor scores as you type: terms, headings, length and entities update live against the current '
          + 'SERP and AI answers.',
      },
      {
        title: 'Publish to WordPress in One Click',
        body: 'The Ranksmile WordPress plugin pushes the optimized draft straight to your site — no copy-paste, no '
          + 'lost formatting.',
      },
    ],
  },
  {
    id: 'monitor',
    index: '03',
    label: 'Stay optimized, 24/7',
    headingStrong: 'Hold visibility while you sleep.',
    headingMuted: ' Ranksmile flags every drop and ships the fix that brings the mention back.',
    tone: 'blue',
    items: [
      {
        title: 'Turn ON the Re-optimization Loop',
        body: 'Get alerted the moment a page slips and instantly spot when a competitor takes a query or an AI answer '
          + 'swaps who it mentions. With always-on monitoring you will finally stop discovering drops a quarter too late.',
      },
      {
        title: 'Daily Rank Tracking',
        body: 'Keyword positions are checked every day per country and device, with history you can actually read.',
      },
      {
        title: 'Smily Assistant',
        body: 'Ask Smily what changed, why a citation was lost and what to publish next — straight from the inbox.',
      },
    ],
  },
];

/** Quote bands between workflow steps — product facts, attributed to the docs, not invented customers. */
export const WORKFLOW_QUOTES = [
  {
    text: '„Content Score compares your draft with the pages and sources the engines already trust for the query — '
      + 'terms, headings, entities, length and structure — and updates live as you write.“',
    author: '— How Content Score works',
    org: 'Ranksmile docs',
  },
  {
    text: '„Your AI Visibility score is the share of tracked prompts where your brand is named, reported per engine. '
      + 'Every lost citation becomes a task with the brief attached.“',
    author: '— How AI Visibility is measured',
    org: 'Ranksmile docs',
  },
] as const;

export const UPDATES = [
  { tag: 'Feature', title: 'AI Visibility: five engines, one score per prompt' },
  { tag: 'Beta', title: 'Smily Assistant: ask what changed and what to publish next' },
  { tag: 'Feature', title: 'Coverage gap now includes competitor keyword gap' },
  { tag: 'Improvement', title: 'WordPress plugin keeps headings, links and images intact' },
] as const;

export const TIMELINE = [
  {
    year: '2018',
    title: 'Rankings were the whole game.',
    body: 'Ten blue links decided who got the click; content optimization meant matching what already ranked.',
  },
  {
    year: '2022',
    title: 'ChatGPT changed the question.',
    body: 'Buyers started asking instead of searching. Brands missing from citations disappeared from the answer.',
  },
  {
    year: '2026',
    title: 'Be the answer everywhere.',
    body: 'Ranksmile tracks rankings AND AI citations in one closed-loop workflow, so the fix ships before the drop costs you.',
  },
] as const;

export const DATA_CARDS = {
  big: { topLeft: 'AI VISIBILITY', topRight: 'ENGINES →', value: '5', caption: 'AI engines tracked for every prompt — plus Google' },
  side: [
    { value: '24h', label: 'Rank check cadence', link: 'DAILY →' },
    { value: '7d', label: 'Free trial on Growth', link: 'TRIAL →' },
  ],
  note: { muted: 'Every plan includes ', strong: 'Content Score, rank tracking and AI visibility', tail: '.' },
  noteLink: { label: 'See pricing', href: PRICING_HREF },
  quotes: [
    {
      muted: '"Rankings and citations in one score — ',
      strong: 'not two dashboards and a spreadsheet."',
      name: 'Content Score + AI Visibility',
      role: 'Included in every plan',
    },
    {
      muted: '"Built for agencies: ',
      strong: 'brand spaces, white-label and API access."',
      name: 'Agency plan',
      role: 'Unlimited documents and brand spaces*',
    },
  ],
  footer: {
    muted: 'Every day, ',
    strong: 'SEO teams, agencies and content writers',
    tail: ' grow with Ranksmile — from first site to full client roster.',
  },
  footerLink: { label: 'Start for free', href: SIGN_UP_HREF },
} as const;

export const RESOURCES_TOP = [
  {
    tag: 'WordPress',
    tone: 'brand' as const,
    title: 'Ranksmile for WordPress',
    body: 'Publish optimized drafts straight to your site. Headings, links and images arrive intact — no copy-paste.',
    href: '/downloads/ranksmile-plugin.zip',
    art: 'stack' as const,
  },
  {
    tag: 'llms.txt',
    tone: 'blue' as const,
    title: 'Readable by every AI agent',
    body: 'A plain-text brief of what Ranksmile does, who it is for and what it costs — so assistants describe us accurately.',
    href: '/llms.txt',
    art: 'image' as const,
  },
  {
    tag: 'pricing.md',
    tone: 'photo' as const,
    title: '',
    body: 'Machine-readable pricing generated from the billing source of truth. Limits, tiers and notes — nothing hidden behind "contact sales".',
    href: '/pricing.md',
    art: 'photo' as const,
  },
];

export const RESOURCES_BOTTOM = [
  { tag: 'Pricing', title: 'Plans & limits', body: 'Growth, Scale and Agency — EUR, VAT excluded, cancel anytime.', href: PRICING_HREF, gap: 99 },
  { tag: 'Legal', title: 'Terms, privacy, DPA', body: 'Everything a procurement team asks for, in plain English.', href: '/legal', gap: 72 },
  {
    tag: 'API',
    title: 'Ranksmile API access',
    href: PRICING_HREF,
    gap: 45,
    body: 'Available on Scale and Agency plans for reporting and automation.',
  },
  {
    tag: 'Contact',
    title: 'Talk to a human',
    href: `mailto:${SUPPORT_EMAIL}`,
    gap: 45,
    body: `Questions, migrations or a walkthrough — write to ${SUPPORT_EMAIL}.`,
  },
] as const;

export const FAQ = [
  {
    q: 'What is Ranksmile?',
    a: 'Ranksmile is an SEO and AI visibility workspace. It scores your content against what ranks in Google, tracks '
      + 'whether ChatGPT, Claude, Gemini, Perplexity and Google AI Overviews cite your brand, and turns every gap into a '
      + 'prioritized task with a brief attached.',
  },
  {
    q: 'How is AI visibility measured?',
    a: 'Ranksmile sends your tracked prompts to each engine on a schedule, records which brands and URLs the answer names, '
      + 'and stores the result. Your AI Visibility score is the share of prompts where your brand is cited, reported per engine.',
  },
  {
    q: 'Which AI engines are tracked?',
    a: 'Five LLM engines — ChatGPT, Claude, Gemini, Perplexity and Google AI Overviews — plus classic Google rankings. '
      + 'Growth plans include four engines; Scale and Agency include all five.',
  },
  {
    q: 'Does Ranksmile work with WordPress?',
    a: 'Yes. The Ranksmile WordPress plugin publishes optimized drafts directly to your site and keeps headings, links and '
      + 'images intact.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Yes. Growth comes with a 7-day free trial, no long-term contract. You can cancel any time from the billing settings.',
  },
] as const;

export const PLANS = PLAN_HIERARCHY.map((slug) => PLAN_DEFINITIONS[slug]);

export const FOOTER_BADGES = [
  { strong: 'GDPR', muted: 'DPA included', href: '/legal/dpa' },
  { strong: '7-day', muted: 'free trial', href: SIGN_UP_HREF },
  { strong: 'Cancel', muted: 'anytime', href: PRICING_HREF },
] as const;

export const FOOTER_COLUMNS = [
  {
    title: 'Platform',
    links: [
      { label: 'Content Score', href: '#platform' },
      { label: 'AI Visibility', href: '#demo' },
      { label: 'Rank Tracking', href: '#workflow' },
      { label: 'Keyword Research', href: '#workflow' },
      { label: 'Coverage & Keyword Gap', href: '#workflow' },
      { label: 'WordPress Plugin', href: '/downloads/ranksmile-plugin.zip' },
    ],
  },
  {
    title: 'Solutions',
    links: [
      { label: 'Marketing Managers', href: '#solution' },
      { label: 'SEO Specialists', href: '#solution' },
      { label: 'Content Managers & Writers', href: '#workflow' },
      { label: 'Agencies', href: '#solution' },
      { label: 'In-house Teams', href: '#solution' },
      { label: 'Enterprise', href: `mailto:${SUPPORT_EMAIL}` },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Pricing', href: PRICING_HREF },
      { label: 'llms.txt', href: '/llms.txt', external: true },
      { label: 'pricing.md', href: '/pricing.md', external: true },
      { label: 'WordPress plugin', href: '/downloads/ranksmile-plugin.zip', external: true },
      { label: 'Legal hub', href: '/legal' },
      { label: 'Sign in', href: SIGN_IN_HREF },
      { label: 'Start for free', href: SIGN_UP_HREF },
    ],
  },
  {
    title: 'Engines',
    links: ENGINES.map((engine) => ({ label: engine, href: '#demo' })),
  },
] as const;

export const FOOTER_LEGAL = [
  { label: 'Cookie Policy', href: '/legal/cookies' },
  { label: 'Privacy Policy', href: '/legal/privacy' },
  { label: 'Terms of Service', href: '/legal/terms' },
  { label: 'Data Processing Addendum', href: '/legal/dpa' },
  { label: 'Legal', href: '/legal' },
] as const;

/** Public, indexable URLs — sitemap + llms.txt read from here. */
export const PUBLIC_ROUTES = ['/', '/ai-visibility-tracking', '/seo-content-editor', '/legal', '/legal/terms', '/legal/privacy', '/legal/cookies', '/legal/dpa'] as const;

export function buildJsonLd(): Record<string, unknown>[] {
  const organization = {
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: META.ogImage,
    email: SUPPORT_EMAIL,
    contactPoint: [{ '@type': 'ContactPoint', contactType: 'customer support', email: SUPPORT_EMAIL }],
  };
  const website = {
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: SITE_NAME,
    publisher: { '@id': `${SITE_URL}/#organization` },
    inLanguage: 'en',
  };
  const software = {
    '@type': 'SoftwareApplication',
    '@id': `${SITE_URL}/#software`,
    name: SITE_NAME,
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'SEO and AI search visibility',
    operatingSystem: 'Web',
    url: SITE_URL,
    description: META.description,
    featureList: [
      'Content Score (live on-page optimization)',
      'AI visibility tracking across ChatGPT, Claude, Gemini, Perplexity and Google AI Overviews',
      'Daily keyword rank tracking',
      'Competitor keyword gap and coverage gap',
      'Prioritized action list',
      'WordPress publishing plugin',
    ],
    offers: PLANS.map((plan) => ({
      '@type': 'Offer',
      name: `${plan.name} plan`,
      price: plan.priceMonthly,
      priceCurrency: 'EUR',
      url: `${SITE_URL}${PRICING_HREF}`,
      category: 'subscription',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: plan.priceMonthly,
        priceCurrency: 'EUR',
        billingDuration: 'P1M',
      },
    })),
    publisher: { '@id': `${SITE_URL}/#organization` },
  };
  return [organization, website, software].map((node) => ({ '@context': 'https://schema.org', ...node }));
}
