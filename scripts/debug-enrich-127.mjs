import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const keyword = 'detektyw warszawa';

const { isDataForSeoConfigured } = await import('../lib/dataforseo.ts');
const { enrichTerms } = await import('../lib/seo/keywordData.ts');
const axios = (await import('axios')).default;

console.log('DFS configured:', isDataForSeoConfigured());

const enriched = await enrichTerms({
  keyword,
  country: 'PL',
  languageCode: 'pl',
  competitorDomains: ['detektyw24.pl', 'detective.pl', 'agencjawp.pl'],
  limit: 80,
});
console.log('enrichTerms count:', enriched.terms.length);
console.log('enrichTerms sample:', enriched.terms.slice(0, 15).map((t) => t.term));

const sidecarUrl = (process.env.PYTHON_SIDECAR_URL || 'http://127.0.0.1:8001').replace('localhost', '127.0.0.1');
try {
  const serp = await axios.post(
    `${sidecarUrl}/analyze-serp`,
    { keyword, language: 'pl' },
    { timeout: 120000, headers: { 'x-internal-token': process.env.INTERNAL_PIPELINE_TOKEN || '' } },
  );
  console.log('analyze-serp terms:', serp.data?.terms?.length);
  console.log('analyze-serp sample:', serp.data?.terms?.slice(0, 15).map((t) => t.term));
} catch (e) {
  console.error('analyze-serp failed:', e.message);
}
