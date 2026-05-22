import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../../database/database';
import verifyUser from '../../../../../utils/verifyUser';
import { ensureArticlesTables } from '../../../../../lib/ensureArticlesTables';
import { getAdwordsCredentials, getAdwordsKeywordIdeas } from '../../../../../utils/adwords';
import { computeRelevanceScore } from '../../../../../lib/keywordEnrichment';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await db.sync();
  await ensureArticlesTables();
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  const { targetKeyword, country = 'US' } = req.body;

  // Get article + domain info
  const [articles] = await db.query(
    `SELECT a.target_keyword, a.title, a.domain_id, d.domain, d.slug, d.search_console
     FROM articles a LEFT JOIN domain d ON d."ID" = a.domain_id WHERE a.id = ?`,
    { replacements: [id] },
  );
  const art = (articles as any[])[0];
  if (!art) return res.status(404).json({ error: 'Article not found' });
  const tk = targetKeyword || art.target_keyword || art.title || '';

  // Resolve country from domain search_console if not explicitly provided
  let resolvedCountry = country;
  if (!req.body.country && art.search_console) {
    try {
      const sc = typeof art.search_console === 'string' ? JSON.parse(art.search_console) : art.search_console;
      if (sc.country) resolvedCountry = sc.country;
    } catch { /* keep default */ }
  }

  // Get existing keywords to deduplicate
  const [existing] = await db.query(
    `SELECT keyword FROM article_keywords WHERE article_id = ?`,
    { replacements: [id] },
  );
  const existingSet = new Set((existing as any[]).map((r: any) => r.keyword?.toLowerCase()));

  // Fetch keyword ideas from Ads
  const creds = await getAdwordsCredentials();
  if (!creds) {
    return res.status(200).json({ suggestions: [], error: 'Google Ads not configured' });
  }

  const ideas = await getAdwordsKeywordIdeas(creds, {
    keywords: [tk],
    seedType: 'custom',
    country: resolvedCountry,
  }, false);

  if (!ideas || !Array.isArray(ideas)) {
    return res.status(200).json({ suggestions: [] });
  }

  // Deduplicate, score, return top 15
  const suggestions = ideas
    .filter((kw: any) => !existingSet.has(kw.keyword?.toLowerCase()))
    .map((kw: any) => ({
      keyword: kw.keyword,
      avgMonthlySearches: kw.avgMonthlySearches || 0,
      competition: kw.competition || 'MEDIUM',
      competitionIndex: kw.competitionIndex || 50,
      relevance_score: computeRelevanceScore(kw.keyword, tk),
    }))
    .sort((a: any, b: any) => b.relevance_score - a.relevance_score)
    .slice(0, 15);

  return res.status(200).json({ suggestions });
}
