import type { GetServerSideProps } from 'next';
import { PUBLIC_ROUTES, SITE_URL } from '../components/landing/content';
import { LEGAL_COMPANY } from '@/src/core/domain/legal/company';

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const urls = PUBLIC_ROUTES.map((route) => {
    const isLegal = route.startsWith('/legal');
    return [
      '  <url>',
      `    <loc>${SITE_URL}${route === '/' ? '/' : route}</loc>`,
      `    <lastmod>${isLegal ? LEGAL_COMPANY.lastUpdatedIso : new Date().toISOString().slice(0, 10)}</lastmod>`,
      `    <changefreq>${route === '/' ? 'weekly' : 'yearly'}</changefreq>`,
      `    <priority>${route === '/' ? '1.0' : '0.3'}</priority>`,
      '  </url>',
    ].join('\n');
  });
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  res.write(xml);
  res.end();
  return { props: {} };
};

export default function Sitemap() {
  return null;
}
