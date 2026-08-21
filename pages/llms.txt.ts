import type { GetServerSideProps } from 'next';
import { ENGINES, FAQ, META, PLANS, SITE_NAME, SITE_URL, SUPPORT_EMAIL } from '../components/landing/content';

/** llms.txt (llmstxt.org) — a plain-text brief so AI agents can describe Ranksmile accurately. */
export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const text = [
    `# ${SITE_NAME}`,
    '',
    `> ${META.description}`,
    '',
    '## What it does',
    '',
    '- Content Score: live on-page optimization score computed from the pages and sources that already rank / get cited for a query.',
    `- AI visibility tracking: records which brands and URLs ${ENGINES.slice(1).join(', ')} name for your tracked prompts; reported per engine.`,
    '- Daily keyword rank tracking per country and device.',
    '- Competitor keyword gap and coverage gap (queries competitors own that you do not cover).',
    '- Prioritized action list: every gap, drop and opportunity becomes a task sorted by visibility impact.',
    '- WordPress plugin: publishes optimized drafts straight to your site.',
    '',
    '## Pricing (EUR, VAT excluded, cancel anytime)',
    '',
    ...PLANS.map((p) => `- ${p.name}: €${p.priceMonthly}/month, or €${p.priceYearly}/month billed yearly. ${p.desc}`),
    '- Growth includes a 7-day free trial.',
    '',
    '## FAQ',
    '',
    ...FAQ.flatMap((item) => [`### ${item.q}`, '', item.a, '']),
    '## Links',
    '',
    `- Home: ${SITE_URL}/`,
    `- Pricing (machine-readable): ${SITE_URL}/pricing.md`,
    `- Terms: ${SITE_URL}/legal/terms`,
    `- Privacy: ${SITE_URL}/legal/privacy`,
    `- Contact: ${SUPPORT_EMAIL}`,
    '',
  ].join('\n');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  res.write(text);
  res.end();
  return { props: {} };
};

export default function LlmsTxt() {
  return null;
}
