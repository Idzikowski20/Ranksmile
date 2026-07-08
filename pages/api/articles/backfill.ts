// POST /api/articles/backfill  — backfill content_score from score_data + GSC keywords
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import { getCurrentUserId } from '../../../utils/getUser';
import { getArticleIdSql } from '../../../lib/articleSql';
import { readLocalSCData } from '../../../utils/searchConsole';
import { kwScore, normalizeUrlForMatch } from '../../../utils/gsc';
import Domain from '../../../database/models/domain';
import { getErrorMessage } from '../../../lib/errors';
import { queryRows } from '../../../lib/db/query';
import { queryAffected } from '../../../lib/types/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });

   const userId = await getCurrentUserId(req, res);
   const { domainId } = req.body;
   if (!domainId) return res.status(400).json({ error: 'domainId is required' });

   try {
      const articleIdSql = await getArticleIdSql();

      // ── 1. Backfill content_score from score_data._computed_score ──
      const [scoreResult] = await db.query(
         `UPDATE articles
          SET content_score = (score_data::jsonb->>'_computed_score')::int,
              updated_at = CURRENT_TIMESTAMP
          WHERE domain_id = ?
            AND content_score = 0
            AND score_data IS NOT NULL
            AND (score_data::jsonb->>'_computed_score')::int > 0`,
         { replacements: [domainId] },
      );
      const scoreUpdated = queryAffected(scoreResult);

      // ── 2. Fetch GSC data for keyword assignment ──
      const domain = await Domain.findByPk(domainId, { attributes: ['domain'] });
      const domainName = domain?.get({ plain: true })?.domain as string || '';
      let keywordAssigned = 0;

      if (domainName) {
         const scData = await readLocalSCData(domainName);
         const thirtyDays: SearchAnalyticsItem[] = (scData && scData.thirtyDays) || [];

         // Build URL → best keyword map
         const urlKeywordMap = new Map<string, { keyword: string; clicks: number; impressions: number; position: number }>();
         thirtyDays.forEach((kw) => {
            if (!kw.page || !kw.keyword) return;
            const urlKey = normalizeUrlForMatch(kw.page);
            const ex = urlKeywordMap.get(urlKey);
            const candidate = { keyword: kw.keyword, clicks: kw.clicks ?? 0, impressions: kw.impressions ?? 0, position: kw.position ?? 0 };
            if (!ex || kwScore(candidate) > kwScore(ex)) {
               urlKeywordMap.set(urlKey, candidate);
            }
         });

         // Find articles missing a proper target_keyword (null, empty, or fallback to title)
         const articles = await queryRows<{ id: number; publish_url: string | null; meta_url: string | null; target_keyword: string | null; title: string | null }>(
            `SELECT ${articleIdSql} AS id, publish_url, meta_url, target_keyword, title
             FROM articles
             WHERE domain_id = ?
               AND (target_keyword IS NULL OR target_keyword = '' OR target_keyword = title)
               AND status != 'analyzing'`,
            [domainId],
         );

         for (const article of articles) {
            const urlsToTry = [article.publish_url, article.meta_url].filter((u): u is string => Boolean(u));
            let matched: { keyword: string } | undefined;
            for (const url of urlsToTry) {
               const urlKey = normalizeUrlForMatch(url);
               matched = urlKeywordMap.get(urlKey);
               if (matched) break;
            }
            if (matched) {
               await db.query(
                  `UPDATE articles SET target_keyword = ?, updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
                  { replacements: [matched.keyword, article.id] },
               );
               keywordAssigned += 1;
            }
         }
         }

      // ── 3. Fix missing meta_url ──
      // Case 1: articles that already have a valid publish_url — batch update
      const [urlFixResult] = await db.query(
         `UPDATE articles
          SET meta_url = publish_url, updated_at = CURRENT_TIMESTAMP
          WHERE domain_id = ?
            AND (meta_url IS NULL OR meta_url = '')
            AND (publish_url LIKE 'http://%' OR publish_url LIKE 'https://%')`,
         { replacements: [domainId] },
      );
      let metaUrlFixed = queryAffected(urlFixResult);

      // Case 2: try to match remaining article titles to site_context URLs by slug
      const noMetaArticles = await queryRows<{ id: number; title: string | null }>(
         `SELECT ${articleIdSql} AS id, title
          FROM articles
          WHERE domain_id = ?
            AND (meta_url IS NULL OR meta_url = '')
            AND (publish_url IS NULL OR publish_url = '' OR (publish_url NOT LIKE 'http://%' AND publish_url NOT LIKE 'https://%'))`,
         [domainId],
      );

      const scRows = await queryRows<{ url: string | null }>(
         `SELECT url FROM site_context WHERE domain_id = ?`,
         [domainId],
      );
      const scUrls: string[] = scRows.map((r) => r.url).filter((u): u is string => Boolean(u));

      for (const article of noMetaArticles) {
         const titleSlug = (article.title || '')
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-');

         let bestScUrl = '';
         for (const scUrl of scUrls) {
            try {
               const pathname = new URL(scUrl).pathname.toLowerCase().replace(/\/+$/, '') || '/';
               const lastSegment = pathname.split('/').pop() || '';
               if (lastSegment && titleSlug) {
                  const urlWords = lastSegment.split('-').filter((w: string) => w.length > 2);
                  const titleWords = titleSlug.split('-').filter((w: string) => w.length > 2);
                  const overlap = urlWords.filter((w: string) => titleWords.includes(w)).length;
                  if (overlap >= 1 && urlWords.length > 0 && overlap / urlWords.length >= 0.4) {
                     bestScUrl = scUrl;
                     break;
                  }
               }
            } catch {}
         }

         if (bestScUrl) {
            await db.query(
               `UPDATE articles SET meta_url = ?, updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
               { replacements: [bestScUrl, article.id] },
            );
            metaUrlFixed += 1;
         }
      }

      // ── 4. Clean up duplicate site_context entries ──
      let siteContextCleaned = 0;
      try {
         const [dupResult] = await db.query(
            `DELETE FROM site_context
             WHERE domain_id = ?
               AND EXISTS (
                 SELECT 1 FROM articles a
                 WHERE a.domain_id = site_context.domain_id
                   AND (a.meta_url = site_context.url OR a.publish_url = site_context.url)
               )`,
            { replacements: [domainId] },
         );
         siteContextCleaned = queryAffected(dupResult);
      } catch { /* site_context may not exist */ }

      return res.status(200).json({
         scoreUpdated,
         keywordAssigned,
         metaUrlFixed,
         siteContextCleaned,
      });
   } catch (error) {
      return res.status(500).json({ error: getErrorMessage(error) || 'Backfill error' });
   }
}
