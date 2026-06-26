import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../../database/database';
import verifyUser from '../../../../../utils/verifyUser';
import { ensureArticlesTables } from '../../../../../lib/ensureArticlesTables';
import { getAdwordsCredentials, getKeywordsVolume } from '../../../../../utils/adwords';
import { computeRelevanceScore, checkCoverage } from '../../../../../lib/keywordEnrichment';
import { getCurrentUserId } from '../../../../../utils/getUser';
import { assertArticleAccess } from '../../../../../lib/tenancy';

const isPostgres = !!process.env.DATABASE_URL;

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
  const { keywords, targetKeyword, plainText, country = 'US' } = req.body;

  if (!keywords?.length) {
    return res.status(400).json({ error: 'keywords array required' });
  }

  // Get article target keyword for relevance scoring
  const [articles] = await db.query(
    `SELECT a.target_keyword, a.domain_id FROM articles a WHERE a.id = ?`,
    { replacements: [id] },
  );
  const art = (articles as any[])[0];
  const tk = targetKeyword || art?.target_keyword || '';

  // Resolve country from domain search_console if not explicitly provided
  let resolvedCountry = country;
  if (art?.domain_id && !req.body.country) {
    try {
      const [domains] = await db.query(`SELECT search_console FROM domain WHERE "ID" = ?`, { replacements: [art.domain_id] });
      const dom = (domains as any[])?.[0];
      if (dom?.search_console) {
        const sc = typeof dom.search_console === 'string' ? JSON.parse(dom.search_console) : dom.search_console;
        // Country from GSC: stored as alpha-2 code like 'PL', 'US'
        if (sc.country) resolvedCountry = sc.country;
      }
    } catch { /* keep default */ }
  }

  // Try Ads volume enrichment (fails gracefully if Ads not configured)
  let volumeData: Record<string, number> = {};
  try {
    const creds = await getAdwordsCredentials();
    if (creds) {
      const kwObjs = keywords.map((kw: string, i: number) => ({
        ID: i, keyword: kw, country: resolvedCountry,
      } as KeywordType));
      const result = await getKeywordsVolume(kwObjs);
      if (result.volumes && typeof result.volumes === 'object') {
        for (const [kwId, vol] of Object.entries(result.volumes)) {
          const idx = parseInt(kwId);
          if (idx < keywords.length) volumeData[keywords[idx]] = vol as number;
        }
      }
    }
  } catch (e) { /* Ads not configured — ok */ }

  // Upsert into article_keywords
  const enriched: any[] = [];
  for (const kw of keywords) {
    const uid = `${id}:${kw}`;
    const relevance = computeRelevanceScore(kw, tk);
    const covered = checkCoverage(kw, plainText || '');

    if (isPostgres) {
      await db.query(
        `INSERT INTO article_keywords (article_id, keyword, relevance_score, is_covered, ads_monthly_volume, uid, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT (uid) DO UPDATE SET
           relevance_score = EXCLUDED.relevance_score,
           is_covered = EXCLUDED.is_covered,
           ads_monthly_volume = COALESCE(EXCLUDED.ads_monthly_volume, article_keywords.ads_monthly_volume),
           updated_at = CURRENT_TIMESTAMP`,
        { replacements: [id, kw, relevance, covered ? 1 : 0, volumeData[kw] || null, uid] },
      );
    } else {
      // SQLite fallback
      await db.query(
        `INSERT OR REPLACE INTO article_keywords (id, article_id, keyword, relevance_score, is_covered, ads_monthly_volume, uid, updated_at)
         VALUES (
           (SELECT id FROM article_keywords WHERE uid = ?),
           ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
         )`,
        { replacements: [uid, id, kw, relevance, covered ? 1 : 0, volumeData[kw] || null, uid] },
      );
    }

    enriched.push({ keyword: kw, relevance_score: relevance, is_covered: covered, ads_monthly_volume: volumeData[kw] || null });
  }

  return res.status(200).json({ keywords: enriched });
}
