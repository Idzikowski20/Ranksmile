/**
 * Content Editor marketing page — copy + structured data.
 * Layout follows Figma cn7zCRglwVkmcbCdT01bgI · 5:2626 1:1 (dark → Koala light), assets in
 * public/content-editor/. Copy adapted to Ranksmile; no borrowed testimonials or logos.
 */
import { LEGAL_COMPANY } from '../../lib/legal/company';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || LEGAL_COMPANY.website).replace(/\/$/, '');
export const SUPPORT_EMAIL = LEGAL_COMPANY.supportEmail;
export const SIGN_UP_HREF = '/auth/sign-up';
export const PATH = '/seo-content-editor';
export const A = '/content-editor';

export const META = {
  title: 'SEO Content Editor — write content that ranks and gets cited | Ranksmile',
  description:
    'Ranksmile Content Editor scores your draft live against what ranks and gets cited: terms, headings, '
    + 'structure, NLP entities. Auto-Optimize, internal links, Humanizer, plagiarism check and 1-click WordPress publishing.',
  ogImage: `${SITE_URL}/icon-512x512.png`,
} as const;

export const HERO = {
  eyebrow: 'Content Editor',
  titleLines: ['Get confident', 'about your Content'],
  subLines: [
    'Creating content that reads well and ranks high is easy with Ranksmile’s Content',
    'Editor no matter the industry, language or location.',
  ],
  explainer: 'Watch Explainer',
  cta: 'Get started now',
  write: {
    pill: 'Write',
    kicker: 'A North Star for on-page Optimization',
    titleLines: ['Content Score is a real-time', 'responsive metric that shows you', 'if you’re on track for optimization!'],
  },
} as const;

export const FEATURES = {
  factors: {
    title: ['500+ ranking', 'factors analyzed'],
    items: ['Keyword optimization', 'Entity extraction', 'Link equity', 'Content relevance', 'Topic coverage', 'Topical authority'],
  },
  integrations: {
    title: 'Powerful integrations',
    lead: 'Whether it’s ',
    links: ['Google Docs', 'ChatGPT', 'WordPress', 'Contentful'],
    muted: 'Ranksmile works where you work! Less friction, more ease, better results.',
  },
  briefs: {
    title: ['Briefs with catchy', 'headlines in seconds'],
    body: 'Use the built-in Outline Builder to structure your content into a detailed outline, complete with unique '
      + 'potential headings and questions.',
  },
  languages: {
    title: 'Write and optimize content in any language',
    body: 'Write and optimize simultaneously with real-time metrics for structure, word count, NLP-ready keywords and '
      + 'images, and rank high anywhere in the world, no matter the niche or industry.',
    flags: [
      { code: 'gb', label: 'English' }, { code: 'es', label: 'Español' }, { code: 'fr', label: 'Français' },
      { code: 'de', label: 'Deutsch' }, { code: 'nl', label: 'Nederlands' }, { code: 'se', label: 'Svenska' },
    ],
  },
  smily: {
    eyebrow: 'AI writing assistant',
    title: 'Write, Edit, and Rephrase—Now in Your Own Voice',
    paras: [
      [
        { t: 'Smily + Content Editor = a dream team. Smily is your personal writing assistant, helping you ' },
        { t: 'edit, rephrase, and refine', s: true },
        { t: ' any article in real-time. Now, with ' },
        { t: 'Custom Voice,', s: true },
        { t: ' you can write in your ' },
        { t: 'unique tone and style', s: true },
        { t: ' while keeping your content ' },
        { t: 'SEO-friendly and polished.', s: true },
      ],
      [
        { t: 'Say goodbye to ' },
        { t: 'writer’s block', s: true },
        { t: ' and time-consuming edits—' },
        { t: 'Smily’s got you. 🚀', s: true },
      ],
    ],
    cta: 'See Smily in action ->',
    prompts: [
      'Explain in 5 sentences how to be a digital nomad',
      'Add a real-world example to illustrate the point.',
      'Back up these sentences with a statistic and link to the source',
      'Expand on what Google says about this',
      'Provide an example to support this',
      'Rewrite this in an active voice',
      'Add more emojis to this paragraph',
    ],
  },
  topics: {
    eyebrow: 'topical gap support',
    title: 'Boost Your Content’s Depth with Topics',
    lead: 'To rank higher, you need to cover every angle—not just keywords.',
    muted: ' Topics maps out the most relevant ideas and gaps, straight from top competitors, so your content stands '
      + 'out as the go-to authority for readers and search engines alike.',
  },
} as const;

export const OPTIMIZE = {
  eyebrow: 'Optimize',
  titleLines: ['Optimize with ease and climb the', 'Google SERP ladder like never before.'],
  auto: {
    title: ['Boost your Content Score and', 'Topical Coverage with a Click'],
    body: 'Auto-Optimize analyzes your content against your competitors to find opportunities for boosting your '
      + 'Content Score by adding relevant terms and missing sections, all while maintaining a human tone of voice. '
      + 'Yes—even if it means adding, rewriting or expanding sections in order to make it all flow!',
  },
  links: {
    title: 'Insert Internal Links Automatically',
    body: 'Internal Linking scans your domain, finds the most optimal anchor, and inserts internal links automatically. '
      + 'What used to take hours now takes minutes with Ranksmile!',
  },
  humanizer: {
    title: 'Humanizer',
    more: 'Learn more ->',
    body: 'If your client, manager or team are worried about AI-generated content being penalized, Humanizer is a '
      + 'feature they’ll love! It was trained before the age of AI-written texts, so it can spot patterns and unnatural '
      + 'language to avoid AI detection and improve the natural tone of your article!',
  },
} as const;

export const PUBLISH = {
  eyebrow: 'Publish',
  titleLines: ['Add final touches and publish', 'your content with confidence.'],
  confidence: {
    title: 'Create with confidence',
    body: 'Avoid Google penalties or upset clients with Ranksmile’s Plagiarism Checker feature! This crucial '
      + 'pre-publish step helps teams, writers, and experts alike!',
  },
  collab: {
    title: ['Easy Collaboration for', 'Teams + Freelancers'],
    body: 'Delegate edits through mentions, check the version history and leave comments to avoid bottlenecks and '
      + 'publish better content, faster! Ideal for teams and freelancers!',
  },
  wordpress: {
    title: ['WordPress Users?', 'This one is for you!'],
    body: 'Get real-time guidelines, 1-click export, and include all images into your library with Ranksmile’s free '
      + 'WordPress Plugin for Content Editor!',
  },
  share: {
    title: ['Share your work,', 'not your password!'],
    body: 'Working with external writers? Easily share the editable Content Editor without having to give access to '
      + 'your Ranksmile account or password! Great for agencies who outsource!',
  },
} as const;

export const TOOLKIT = {
  eyebrow: 'our toolkit',
  titleLines: ['95% of pages get no traffic from Google.', 'Be in the 5%. Use Ranksmile.'],
  subLines: [
    'Ranksmile makes getting to the top 5% easy. How? With powerful features, like Auto-Optimize, Humanizer,',
    'Plagiarism Checker, and Content Score, which takes your content from invisible to front and center.',
  ],
  quoteLines: [
    '“Content Score compares your draft with the pages the',
    'engines already trust — terms, headings, entities, length —',
    'and updates live as you write. No guessing, no rewrites.”',
  ],
  name: 'How Content Score works',
  role: 'Ranksmile Content Editor',
} as const;

export const AI = {
  eyebrow: 'scale with Smily AI',
  titleLines: ['Want to fast-forward and publish', 'ready-to-rank content '],
  titleTail: 'in minutes?',
  main: {
    title: ['Generate ready to', 'rank article in minutes'],
    body: 'Smily AI doesn’t just generate articles, it generates traffic. Streamline your content creation process with '
      + 'Smily AI and let it do the researching, writing, and optimizing for you. You just review the final product and '
      + 'publish with confidence.',
  },
  eeat: {
    t1: 'Boost E-E-A-T with',
    accent: 'Custom Knowledge',
    t2: 'and Writing Points',
    body: 'Turn your brand facts into engaging content – crafted with precision, ensuring every detail you provide '
      + 'shines through and boosts your E-E-A-T score.',
  },
  templates: {
    t1: 'Utilize ',
    accent: 'Templates',
    t2: ['for your commercial', 'content needs!'],
    body: 'Regular blog articles are not enough? Craft commercial content with ease: generate top-quality product '
      + 'reviews and roundups in a fraction of the time.',
  },
} as const;

export const WORKFLOW = {
  eyebrow: 'Perfect workflow',
  titleLines: ['Content Editor fits perfectly', 'into your content creation workflow'],
  discover: {
    title: 'Discover & Explore',
    items: [
      'Start with Sites to seamlessly integrate Topical Map into your content creation workflow, from discovery to optimization',
      'Easily populate your website, venture into a new niche, or gain topical authority!',
    ],
    cta: 'Topical Map',
  },
  create: {
    title: 'Create & Optimize',
    items: [
      'Write top-notch articles to close those content gaps using Content Editor!',
      'You can automate this with Smily AI or speed it up with Auto-Optimize and Auto Internal Links.',
    ],
    cta: 'Content Editor',
  },
  audit: {
    title: 'Audit & Monitor',
    items: [
      'Lastly, audit, monitor, and continuously optimize your content. (Google loves fresh articles!)',
      'Content Audit will track your position on the SERPs and notify you about any changes and the best SEO opportunities!',
    ],
    cta: 'Content Audit',
  },
  badge: { muted: 'the best-performing content is', strong: 'made with Ranksmile' },
} as const;

export const FAQ_LEFT = [
  {
    q: 'Can Ranksmile help me with AI visibility?',
    a: 'Of course! Ranksmile is a complete platform for AI Search Optimization and visibility.',
    bullets: [
      {
        strong: 'AI Tracker',
        rest: ' helps you track, measure, and improve your AI visibility with clear insights on your Visibility '
          + 'Score, mention gaps, competitor share of voice, and more.',
      },
      {
        strong: 'Topical Map',
        rest: ' helps you research and plan new content clusters designed to increase your topical authority and '
          + 'position you as an expert in your niche, thereby enhancing your chances of being cited and mentioned.',
      },
      {
        strong: 'Content Audit',
        rest: " helps you monitor your content's performance, notifies you about ranking drops so you can act fast, "
          + 'and suggests articles with the best quick-win potential to refresh.',
      },
      {
        strong: "Content Editor's",
        rest: ' live guidelines help you write new and refresh existing content in a way that is rewarded both in '
          + 'SERPs and AI chats.',
      },
    ],
  },
  {
    q: 'How does Ranksmile work?',
    a: 'Ranksmile scores your content against the pages and sources the engines already trust, tracks rankings and '
      + 'AI citations daily, and turns every gap into a prioritized task with the brief attached.',
  },
  {
    q: 'Who uses Ranksmile?',
    a: 'In-house SEO and content teams, agencies running many client brands, freelance writers, and marketing leads '
      + 'who want one score for rankings and AI visibility.',
  },
  {
    q: 'What languages does Ranksmile support?',
    a: 'Content Editor guidelines and scoring work across the major languages the supported engines answer in; the '
      + 'workspace UI is in English.',
  },
] as const;

export const FAQ_RIGHT = [
  {
    q: 'Does Content Editor help me write content that gets cited by AIs?',
    a: 'Yes. Guidelines are built from the pages AI engines cite for your query, so structure, entities and depth '
      + 'match what gets referenced — not just what ranks.',
  },
  {
    q: 'Can I use Content Editor to optimize my existing content?',
    a: 'Yes. Import a live URL or paste the draft; Content Score, terms, headings and structure update live as you '
      + 'edit, and Auto-Optimize can apply the biggest gaps in one click.',
  },
  {
    q: 'Can I share a Content Editor with my team?',
    a: 'Yes. Share an editable link with writers or clients without giving them access to your Ranksmile account.',
  },
  {
    q: 'How are Content Editor’s guidelines generated?',
    a: 'From a live analysis of the top-ranking and most-cited pages for your keyword: NLP terms, headings, length, '
      + 'images and entities, refreshed on demand.',
  },
] as const;

export const CTA = {
  titleLines: ['Your Brand Deserves to', 'Be Seen—Everywhere'],
  subLines: ['AI is shaping decisions. If you’re not in the answers,', 'you’re not even considered. Win the next wave of search.'],
  cta: 'Get started now',
  note: 'Real connections start with being found',
} as const;

export function buildJsonLd(): Record<string, unknown>[] {
  const faq = [...FAQ_LEFT, ...FAQ_RIGHT];
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': `${SITE_URL}${PATH}#webpage`,
      url: `${SITE_URL}${PATH}`,
      name: META.title,
      description: META.description,
      inLanguage: 'en',
      primaryImageOfPage: META.ogImage,
      about: { '@type': 'Thing', name: 'SEO content editor' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      '@id': `${SITE_URL}${PATH}#faq`,
      mainEntity: faq.map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })),
    },
  ];
}
