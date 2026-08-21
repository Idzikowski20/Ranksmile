import type { GetServerSideProps } from 'next';
import { SITE_URL } from '../components/landing/content';

/**
 * Search + AI crawlers are welcome on the public pages; the app itself is behind auth
 * and explicitly disallowed so crawlers don't burn budget on redirects.
 */
const AI_BOTS = ['GPTBot', 'ChatGPT-User', 'OAI-SearchBot', 'PerplexityBot', 'ClaudeBot', 'anthropic-ai', 'Google-Extended', 'Bingbot'];

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const lines = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /workspace/',
    'Disallow: /settings/',
    'Disallow: /articles/',
    'Disallow: /sites/',
    'Disallow: /dashboard/',
    'Disallow: /onboarding',
    'Disallow: /setup',
    'Disallow: /plans',
    '',
    ...AI_BOTS.flatMap((bot) => [`User-agent: ${bot}`, 'Allow: /', '']),
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    '',
  ];
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  res.write(lines.join('\n'));
  res.end();
  return { props: {} };
};

export default function Robots() {
  return null;
}
