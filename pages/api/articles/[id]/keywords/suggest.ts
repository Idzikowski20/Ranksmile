import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../../database/database';
import verifyUser from '../../../../../utils/verifyUser';
import { ensureArticlesTables } from '../../../../../lib/ensureArticlesTables';
import { getAdwordsCredentials, getAdwordsKeywordIdeas } from '../../../../../utils/adwords';
import { computeRelevanceScore } from '../../../../../lib/keywordEnrichment';
import { getCurrentUserId } from '../../../../../utils/getUser';
import { assertArticleAccess } from '../../../../../lib/tenancy';
import { queryRows, queryOne } from '../../../../../lib/db/query';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await db.sync();
  await ensureArticlesTables();
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await getCurrentUserId(req, res);
  const articleId = parseInt(req.query.id as string, 10);
  if (!(await assertArticleAccess(userId, articleId))) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  const { id } = req.query;
  const { targetKeyword, country = 'US' } = req.body;

  // Get article + domain info
  const art = await queryOne<{ target_keyword: string | null; title: string | null; domain_id: number | null; domain: string | null; slug: string | null; search_console: string | null }>(
    `SELECT a.target_keyword, a.title, a.domain_id, d.domain, d.slug, d.search_console
     FROM articles a LEFT JOIN domain d ON d."ID" = a.domain_id WHERE a.id = ?`,
    [id],
  );
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
  const existing = await queryRows<{ keyword: string | null }>(
    `SELECT keyword FROM article_keywords WHERE article_id = ?`,
    [id],
  );
  const existingSet = new Set(existing.map((r) => r.keyword?.toLowerCase()));

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
