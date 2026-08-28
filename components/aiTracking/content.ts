/**
 * AI-visibility-tracking marketing page — copy + structured data.
 *
 * Layout follows the Figma reference (cn7zCRglwVkmcbCdT01bgI · 3:10096) 1:1, adapted to
 * Ranksmile: full light theme, Koala tokens, no borrowed logos / review scores / customer
 * quotes. Shares the landing's header, footer, primitives, motion and dashboard mock.
 */
import { PLAN_DEFINITIONS, PLAN_HIERARCHY } from '@/src/core/domain/pricing/planDefinition';
import { LEGAL_COMPANY } from '@/src/core/domain/legal/company';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || LEGAL_COMPANY.website).replace(/\/$/, '');
export const SUPPORT_EMAIL = LEGAL_COMPANY.supportEmail;
export const SIGN_UP_HREF = '/auth/sign-up';
export const PRICING_HREF = '/plans';
export const PATH = '/ai-visibility-tracking';

export const META = {
  title: 'AI Visibility Tracking — see where ChatGPT, Claude, Gemini & Perplexity cite you',
  description:
    'Ranksmile AI Tracker monitors how ChatGPT, Claude, Gemini, Perplexity and Google AI Overviews talk about '
    + 'your brand across buyer-intent prompts — Visibility Score, Share of Voice, mention gaps and the fixes to win them.',
  ogImage: `${SITE_URL}/icon-512x512.png`,
} as const;

export const ENGINES = ['ChatGPT', 'Claude', 'Gemini', 'Perplexity', 'AI Overviews'] as const;

export const HERO = {
  eyebrow: 'AI Tracker',
  titleLines: ['Monitor, Analyze, and', 'Grow Your Brand’s', 'AI Search Visibility'],
  subLines: [
    'See exactly how ChatGPT, Claude, Gemini, Google AI Overviews',
    'and Perplexity talk about your brand — and use the insights',
    'to win buyer trust, demand, and AI citations at scale.',
  ],
  cta: 'Start Growing AI Search Visibility',
  ratingStrong: '5 AI engines',
  ratingMuted: 'Join teams already tracking & improving AI Search visibility with Ranksmile',
  chips: ['Track AI Visibility & Sentiment', 'Spy on Competitors', 'Find & Fix Mention Gaps', 'Strategize & Report'],
  enginesLabel: 'Built for every AI Search Engine:',
  /** Radar pills — each cycles inside [min, max] as the scanner sweeps past. */
  stats: [
    { id: 'visibility', label: 'Visibility Score', value: 17, min: 14, max: 23, decimals: 0, suffix: '', delta: -19, deltaSuffix: '' },
    { id: 'mention', label: 'Mention Rate', value: 26, min: 22, max: 31, decimals: 0, suffix: '%', delta: -24, deltaSuffix: '%' },
    { id: 'position', label: 'Average Position', value: 2.3, min: 1.9, max: 2.8, decimals: 1, suffix: '', delta: 0.6, deltaSuffix: '' },
  ],
  topSources: ['G', 'W', 'R', 'Y', 'L'],
  trustedTitle: 'Built for the Engines Buyers Actually Ask',
  trusted: ['Google', 'ChatGPT', 'Claude', 'Gemini', 'Perplexity', 'AI Overviews', 'WordPress', 'Search Console'],
} as const;

/** The "AI is the new Front Page" stat cards — same figures the landing uses. */
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

export const FRONTPAGE = {
  eyebrow: "Search isn't just Google anymore",
  titleLines: ['AI is the new', 'Front Page'],
  sub: 'AI answers shape what people learn, trust, and buy — instantly and without links. If you’re not being '
    + 'mentioned there, ',
  subMuted: 'you’re invisible.',
  promptChip: { muted: 'What is the best app for ', strong: 'marketing', rest: ' in 2025?' },
  quote: {
    lead: '“Before this, we had no way to measure how our brand showed up in AI tools. ',
    highlight: 'Now we can spot gaps, monitor growth, and adjust our strategy in real time.”',
    name: 'Content & AEO teams',
    role: 'Ranksmile AI Tracker',
  },
} as const;

/** Section 3 — three solution cards (image caption). */
export const SOLUTION = {
  eyebrow: 'Solution',
  titleLines: ['Grow Your Visibility—', "Don't Just Watch It"],
  sub: 'Ranksmile reveals when, where, and how top AI tools mention your brand across buyer-intent prompts — and '
    + 'gives you the tools to improve that presence fast.',
  cards: [
    {
      art: 'share' as const,
      strong: 'See Real AI Share of Voice.',
      body: ' Benchmark competitors to see which models skip your brand in their favor. No more blind spots; know '
        + "exactly where you win — and where you're invisible.",
    },
    {
      art: 'narrative' as const,
      strong: 'Control the Narrative.',
      body: ' Fix misquotes, silence, or off-brand framing. Understand how your brand is positioned in AI answers — '
        + 'and take the mic back from the LLM.',
    },
    {
      art: 'action' as const,
      strong: 'Turn Insights Into Action.',
      body: ' Use daily reports to fuel outreach, PR, and content strategy that actually moves the needle.',
    },
  ],
} as const;

export type HowStep = {
  index: string;
  label: string;
  titleLines: string[];
  paras: string[];
  bullets?: { label: string; body: string }[];
  art: 'track' | 'evaluate' | 'bridge' | 'strategize';
  imageSide: 'left' | 'right';
};

export const HOW = {
  eyebrow: 'How it works',
  titleLines: ['Turn AI Chats Into', 'Your Top Salespeople'],
  cta: 'Start Growing AI Search Visibility',
  steps: [
    {
      index: '01',
      label: 'Track',
      titleLines: ['Add the Prompts', 'That Matter'],
      paras: [
        'Monitor product, brand, and buyer-intent questions your buyers ask.',
        'Track mentions across the “Big 5” models and stay a step ahead of the competition.',
      ],
      art: 'track',
      imageSide: 'left',
    },
    {
      index: '02',
      label: 'Evaluate',
      titleLines: ['Analyze', 'Performance and', 'Gaps in Real-Time'],
      paras: [
        'Get visual insights at a glance: Share of Voice trends, missing mentions, which sources LLMs are pulling '
          + 'from, what your brand sentiment is, and which channel and content types perform best in AI answers.',
        'Stop flying blind and start managing your AI reputation like a pro.',
      ],
      art: 'evaluate',
      imageSide: 'right',
    },
    {
      index: '03',
      label: 'Bridge the gaps',
      titleLines: ['Fix What AI Gets', 'Wrong — Fast'],
      paras: [
        'Identify the exact sources LLMs trust. Build your outreach list and target the right sites to earn or buy '
          + 'new mentions, and fix brand sentiment before it hurts your sales.',
      ],
      art: 'bridge',
      imageSide: 'left',
    },
    {
      index: '04',
      label: 'Strategize',
      titleLines: ['Become The', 'Source AIs Trust'],
      paras: ["Ranksmile AI Tracker doesn't live in a silo — it plugs into the full Ranksmile suite:"],
      bullets: [
        { label: 'Plan:', body: ' Use Topical Map and coverage-gap insights to outperform competitor content.' },
        { label: 'Optimize:', body: ' Write or generate missing AI-ready articles with the Content Editor.' },
        { label: 'Maintain:', body: ' Use Content Audit to keep your content fresh and “citation-worthy” over time.' },
      ],
      art: 'strategize',
      imageSide: 'right',
    },
  ] as HowStep[],
} as const;

export const ADVANTAGE = {
  eyebrow: 'The Ranksmile advantage',
  titleLines: ['5x the Data. 1x the Price.', '100% Reality.'],
  subLines: ['Most tools use "sanitized" APIs and force', 'you to pick a model to track. Ranksmile doesn’t.'],
  cards: [
    {
      italic: 'Real, ',
      strong: 'unfiltered data',
      lead: 'We scrape the real-world interfaces your customers actually see',
      muted: '—capturing the citations, links, and live browsing data that APIs miss.',
      image: '/ai-tracking/advantage-data.png',
      imageFirst: false,
    },
    {
      italic: 'Everywhere ',
      strong: 'at once',
      lead: 'One prompt tracks your brand across all 5 major models simultaneously. ',
      muted: 'You get 5x the insights for the same credit—because "visibility" isn’t a choice between ChatGPT, '
        + 'Perplexity, or Google. It’s all of them.',
      image: '/ai-tracking/advantage-prompts.png',
      imageFirst: true,
    },
  ],
  body1strong: 'Ranksmile’s engineering team constantly analyzes',
  body1: ' how AI models rank, cite, and surface brands — refining our detection in real time as the landscape shifts.',
  body2: 'Because when AI changes the rules, we don’t react. ',
  body2accent: 'We adapt first.',
  cta: 'Start Growing AI Search Visibility',
} as const;

export const CAPABILITIES = {
  eyebrow: 'Shape what AI says about you',
  title: 'What You Can Do With Ranksmile',
  cards: [
    { icon: 'target', strong: 'Win More Mentions:', body: " Find gaps in high-intent prompts and create content that AI can't help but cite." },
    { icon: 'megaphone', strong: 'Control Your Brand Narrative:', body: ' See how AI describes you today — and reshape how it talks tomorrow.' },
    { icon: 'chart', strong: 'Show ROI:', body: ' Tie SEO and PR efforts directly to AI visibility gains your C-suite actually cares about.' },
    { icon: 'crosshair', strong: 'Focus on Impact:', body: ' Use prompt-level data to prioritize updates that yield the biggest visibility jumps.' },
  ],
} as const;

export const AUDIENCE = {
  eyebrow: "Who it's for",
  titleLines: ['Made for Marketers Who Want to', 'Be the Source—Not the Bystander'],
  body: 'AI Tracker is for teams tired of "tracking links" and ready to shape answers.',
  groups: [
    { label: 'PR & Brand teams:', body: ' Own your narrative in the AI age. Stay ahead of the competition.' },
    { label: 'Content & AEO teams:', body: ' Write and optimize for the generative era at scale.' },
    { label: 'CMOs & VPs:', body: ' Get hard metrics, not gut feelings.' },
  ],
} as const;

export const PRICING = {
  eyebrow: 'Pricing',
  titleLines: ['AI visibility tracking', 'without hidden fees'],
  top: {
    title: 'AI Search Analytics',
    sub: 'Track & improve your brand’s position in AI answers.',
    question: 'How many prompts do you want to track daily?',
    hint: { strong: 'Most brands start here ', muted: '— covers your brand and competitors.' },
    ctaMuted: ' — cancel or switch plan anytime.',
    includes: 'Includes:',
  },
  footer: { strong: 'Not sure yet?', muted: ' Start smaller — or go bigger.', link: 'Compare all plans' },
  proTagline: 'Most teams choose Scale',
  peaceTagline: 'Upgrade anytime as your needs grow',
} as const;

export const CTA = {
  eyebrow: 'The earlier you start, the faster you win',
  titleLines: ['Your Brand Deserves to', 'Be Seen—Everywhere'],
  sub: "AI is shaping decisions. If you're not in the answers, you're not even considered. ",
  subStrong: 'Win the next wave of search →',
  cta: 'Start Growing AI Search Visibility Today',
} as const;

export const FAQ_LEFT = [
  {
    q: 'Can Ranksmile help me with AI visibility?',
    a: 'Of course! Ranksmile is a complete platform for AI Search Optimization and visibility.',
    bullets: [
      { strong: 'AI Tracker',
        rest: ' helps you track, measure, and improve your AI visibility with clear insights on your Visibility '
          + 'Score, mention gaps, competitor share of voice, and more.' },
      { strong: 'Topical Map',
        rest: ' helps you research and plan new content clusters designed to increase your topical authority and '
          + 'position you as an expert in your niche, thereby enhancing your chances of being cited and '
          + 'mentioned.' },
      { strong: 'Content Audit',
        rest: ' helps you monitor your content’s performance, notifies you about ranking drops so you can act fast, '
          + 'and suggests articles with the best quick-win potential to refresh (the fresher your content, the '
          + 'higher its chances of being mentioned and cited).' },
      { strong: 'Content Editor’s',
        rest: ' live guidelines help you write new and refresh existing content in a way that is rewarded both in '
          + 'SERPs and AI chats.' },
    ],
  },
  {
    q: 'How does Ranksmile work?',
    a: 'Ranksmile sends your tracked prompts to each engine on a schedule, records which brands and URLs the answer '
      + 'names, and turns every gap into a prioritized task with the brief attached.',
  },
  {
    q: 'Who uses Ranksmile?',
    a: 'In-house SEO and content teams, agencies running many client brands, PR and brand teams, and CMOs who want '
      + 'hard metrics instead of gut feelings.',
  },
  {
    q: 'What languages does Ranksmile support?',
    a: 'Ranksmile tracks prompts and scores content across the major languages the supported engines answer in; the '
      + 'workspace UI is in English.',
  },
] as const;

export const FAQ_RIGHT = [
  {
    q: 'How often does AI Tracker refresh its data?',
    a: 'Tracked prompts are re-run daily, so your Visibility Score, mention rate and Share of Voice reflect the last '
      + '24 hours.',
  },
  {
    q: 'How accurate are the results?',
    a: 'Ranksmile queries each engine directly rather than a sanitized API, and records the exact brands and URLs '
      + 'named — so the numbers mirror what a real buyer sees.',
  },
  {
    q: 'How is this different from rank tracking?',
    a: 'Rank tracking tells you where a page sits in ten blue links. AI Tracker tells you whether an AI answer names '
      + 'your brand at all, in what sentiment, and against which competitors.',
  },
  {
    q: 'What do I need to start using AI Tracker?',
    a: 'A brand space and a few buyer-intent prompts. Ranksmile extracts your competitors and starts scoring from the '
      + 'first run.',
  },
  {
    q: 'Which AI models are supported?',
    a: 'ChatGPT, Claude, Gemini, Perplexity and Google AI Overviews, plus classic Google rankings.',
  },
  {
    q: 'Is Ranksmile using an API to get AI results?',
    a: 'Ranksmile queries the engines the way a buyer would and records the visible answer, so tracking reflects real, '
      + 'un-sanitized responses.',
  },
] as const;

export const PLANS = PLAN_HIERARCHY.map((slug) => PLAN_DEFINITIONS[slug]);

export function buildJsonLd(): Record<string, unknown>[] {
  const faqAll = [...FAQ_LEFT, ...FAQ_RIGHT];
  const webpage = {
    '@type': 'WebPage',
    '@id': `${SITE_URL}${PATH}#webpage`,
    url: `${SITE_URL}${PATH}`,
    name: META.title,
    description: META.description,
    inLanguage: 'en',
    primaryImageOfPage: META.ogImage,
    about: { '@type': 'Thing', name: 'AI search visibility tracking' },
  };
  const faq = {
    '@type': 'FAQPage',
    '@id': `${SITE_URL}${PATH}#faq`,
    mainEntity: faqAll.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
  return [webpage, faq].map((node) => ({ '@context': 'https://schema.org', ...node }));
}
