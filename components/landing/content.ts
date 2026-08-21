/**
 * Landing copy + structured data in one place so the page, JSON-LD, llms.txt and
 * sitemap never drift apart. Pricing is read from the billing source of truth.
 */
import { PLAN_DEFINITIONS, PLAN_HIERARCHY } from '../../lib/pricing/planDefinition';
import { LEGAL_COMPANY } from '../../lib/legal/company';

export const SITE_NAME = 'Ranksmile';
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || LEGAL_COMPANY.website).replace(/\/$/, '');
export const SUPPORT_EMAIL = LEGAL_COMPANY.supportEmail;

export const META = {
  title: 'Ranksmile — SEO + AI visibility workspace. Rank in Google, get cited by AI.',
  description:
    'Ranksmile scores your content, tracks where ChatGPT, Claude, Gemini, Perplexity and Google AI Overviews '
    + 'cite your brand, and turns every gap into a prioritized task. 7-day free trial.',
  ogImage: `${SITE_URL}/icon-512x512.png`,
} as const;

/** Engines the product tracks (lib/providers/dataforseoLlm — five LLM engines + Google). */
export const ENGINES = ['Google', 'ChatGPT', 'Claude', 'Gemini', 'Perplexity', 'AI Overviews'] as const;

export const NAV = [
  { label: 'Platform', href: '#platform' },
  { label: 'Workflow', href: '#workflow' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
] as const;

export const SIGN_IN_HREF = '/auth/sign-in';
export const SIGN_UP_HREF = '/auth/sign-up';

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
    title: 'Score-driven.',
    body: 'Content Score is computed from what already ranks and gets cited for your query — structure, depth, entities, '
      + 'and freshness — so you stop guessing what the algorithm wants.',
  },
  {
    title: 'Engine-aware.',
    body: 'Google and the five LLM engines weigh sources differently. Ranksmile measures each one separately and tells you '
      + 'where your brand is named, where a competitor is, and why.',
  },
  {
    title: 'Always-on.',
    body: 'Daily visibility checks, rank tracking and coverage gaps feed one inbox. When a citation is lost, the fix '
      + 'is already queued with the brief attached.',
  },
] as const;

export type WorkflowStep = {
  id: string;
  index: '01' | '02' | '03';
  label: string;
  heading: string;
  sub: string;
  tone: 'brand' | 'green' | 'blue';
  items: { title: string; body: string }[];
};

export const WORKFLOW: WorkflowStep[] = [
  {
    id: 'diagnose',
    index: '01',
    label: 'Diagnose',
    heading: 'See where you win — and where you fall short.',
    sub: 'Across Google, AI Overviews and every LLM that names brands.',
    tone: 'brand',
    items: [
      {
        title: 'Analyze AI visibility',
        body: 'See exactly what top AI engines say about your topics, spot the answers that name competitors, and get a clear action plan to fix it.',
      },
      {
        title: 'Audit existing content',
        body: 'Every published page is scored against the sources the engines actually cite. Thin, stale or off-topic pages surface first.',
      },
      {
        title: 'Find competitive gaps',
        body: 'Competitor keyword gap and coverage gap show the queries your rivals own and you do not cover at all.',
      },
    ],
  },
  {
    id: 'fix',
    index: '02',
    label: 'Fix the gaps',
    heading: 'Turn insights into content built to rank and be cited.',
    sub: 'One task list. One closed-loop content workflow.',
    tone: 'green',
    items: [
      {
        title: 'Get a prioritized action list',
        body: 'Every gap, drop and opportunity becomes a task sorted by what moves visibility fastest. '
          + 'The "what should we work on next?" debate ends here.',
      },
      {
        title: 'Write and optimize with live guidelines',
        body: 'The editor scores as you type: terms, headings, length and entities update live against the current SERP and AI answers.',
      },
      {
        title: 'Publish to WordPress in one click',
        body: 'The Ranksmile WordPress plugin pushes the optimized draft straight to your site — no copy-paste, no lost formatting.',
      },
    ],
  },
  {
    id: 'monitor',
    index: '03',
    label: 'Stay optimized, 24/7',
    heading: 'Hold visibility while you sleep.',
    sub: 'Ranksmile flags every drop and ships the fix that brings the mention back.',
    tone: 'blue',
    items: [
      {
        title: 'Turn on re-optimization alerts',
        body: 'Get alerted the moment a page slips or an AI answer swaps you out for a competitor. '
          + 'You will stop discovering drops a quarter too late.',
      },
      {
        title: 'Track rankings daily',
        body: 'Keyword positions are checked every day per country and device, with history you can actually read.',
      },
      {
        title: 'Share with the team',
        body: 'Workspaces, roles and invites keep writers, SEOs and clients on the same board without extra seats for viewers.',
      },
    ],
  },
];

export const USE_CASES = [
  {
    eyebrow: 'In-house teams',
    title: 'One scoreboard for SEO and AI visibility',
    body: 'Replace the spreadsheet of rank checks, GSC exports and "did ChatGPT mention us?" screenshots with a single '
      + 'daily view your whole content team reads.',
  },
  {
    eyebrow: 'Agencies',
    title: 'Every client brand in its own space',
    body: 'Brand spaces, white-label reporting and API access on Agency plans let you run many clients without juggling '
      + 'logins — and prove the lift in citations, not just rankings.',
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
    q: 'How does Content Score work?',
    a: 'Content Score compares your draft with the pages and sources the engines already trust for the query: terms, '
      + 'headings, entities, length and structure. The score updates live in the editor as you write.',
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

export const FOOTER_COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Platform', href: '#platform' },
      { label: 'Workflow', href: '#workflow' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'FAQ', href: '#faq' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'WordPress plugin', href: '/downloads/ranksmile-plugin.zip' },
      { label: 'Machine-readable pricing', href: '/pricing.md' },
      { label: 'llms.txt', href: '/llms.txt' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Contact', href: `mailto:${SUPPORT_EMAIL}` },
      { label: 'Sign in', href: SIGN_IN_HREF },
      { label: 'Start for free', href: SIGN_UP_HREF },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms of Service', href: '/legal/terms' },
      { label: 'Privacy Policy', href: '/legal/privacy' },
      { label: 'Cookie Policy', href: '/legal/cookies' },
      { label: 'Data Processing Addendum', href: '/legal/dpa' },
    ],
  },
] as const;

/** Public, indexable URLs — sitemap + llms.txt read from here. */
export const PUBLIC_ROUTES = ['/', '/legal', '/legal/terms', '/legal/privacy', '/legal/cookies', '/legal/dpa'] as const;

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
      url: `${SITE_URL}/#pricing`,
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
  const faq = {
    '@type': 'FAQPage',
    '@id': `${SITE_URL}/#faq`,
    mainEntity: FAQ.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
  return [organization, website, software, faq].map((node) => ({ '@context': 'https://schema.org', ...node }));
}
