import type { GetServerSideProps } from 'next';
import { PLANS, SITE_NAME, SITE_URL, SUPPORT_EMAIL } from '../components/landing/content';

/** Machine-readable pricing for AI agents — generated from the billing source of truth. */
export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const text = [
    `# Pricing — ${SITE_NAME}`,
    '',
    'All prices in EUR, VAT excluded. Monthly or yearly billing. Cancel anytime.',
    '',
    ...PLANS.flatMap((plan) => [
      `## ${plan.name}${plan.recommended ? ' (recommended)' : ''}`,
      '',
      `- Price: €${plan.priceMonthly}/month (billed monthly) | €${plan.priceYearly}/month (billed yearly, save ${plan.yearlySavePct}%)`,
      `- Summary: ${plan.desc}`,
      '- Includes:',
      ...plan.cardBenefits
        .filter((b) => b.state !== 'excluded')
        .map((b) => `  - ${b.label}${b.value ? `: ${b.value}` : ''}`),
      ...(plan.cardBenefits.some((b) => b.state === 'excluded')
        ? ['- Not included:', ...plan.cardBenefits.filter((b) => b.state === 'excluded').map((b) => `  - ${b.label}`)]
        : []),
      ...(plan.footerHints?.length ? [`- Notes: ${plan.footerHints.join('; ')}`] : []),
      '',
    ]),
    `Sign up: ${SITE_URL}/auth/sign-up`,
    `Questions: ${SUPPORT_EMAIL}`,
    '',
  ].join('\n');
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  res.write(text);
  res.end();
  return { props: {} };
};

export default function PricingMd() {
  return null;
}
