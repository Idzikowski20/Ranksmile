// POST /api/articles/analyze-batch
// Triggers deep-analysis for all unscored articles in a domain.
// Fire-and-forget — returns immediately, analyses run in background with capped concurrency.
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import { getCurrentUserId } from '../../../utils/getUser';
import { verifyDomainOwnershipById } from '../../../utils/verifyDomainOwnership';
import { resolveOrgId, orgBudgetBlocked } from '../../../lib/aiBudget';
import { getArticleIdSql } from '../../../lib/articleSql';
import { ensureArticlesTables } from '../../../lib/ensureArticlesTables';
import { getErrorMessage } from '../../../lib/errors';
import { queryRows } from '../../../lib/db/query';
import { mapPool } from '../../../lib/mapPool';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';

export const config = { maxDuration: 60 };

const ANALYZE_BATCH_CONCURRENCY = 3;

async function handler(req: NextApiRequest, res: NextApiResponse) {
   if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });

   await db.sync();
   await ensureArticlesTables();
   const userId = await getCurrentUserId(req, res);
   const { domainId } = req.body;
   if (!domainId) return res.status(400).json({ error: 'domainId is required' });

   const owns = await verifyDomainOwnershipById(Number(domainId), userId ? String(userId) : null);
   if (owns === null) return res.status(404).json({ error: 'Domain not found' });
   if (owns === false) return res.status(403).json({ error: 'Access denied.' });
   const orgId = await resolveOrgId(req, res);
   const over = await orgBudgetBlocked(orgId);
   if (over) return res.status(429).json(over);

   try {
      const articleIdSql = await getArticleIdSql();

      const queue = await queryRows<{ id: number; meta_url: string | null; title: string | null }>(
         `SELECT ${articleIdSql} AS id, meta_url, title
          FROM articles
          WHERE domain_id = ?
            AND content_score = 0
            AND status = 'draft'
            AND meta_url IS NOT NULL
          ORDER BY created_at ASC
          LIMIT 25`,
         [domainId],
      );

      if (queue.length === 0) {
         return res.status(200).json({
            queued: 0,
            concurrency: ANALYZE_BATCH_CONCURRENCY,
            message: 'No pending articles to analyze',
         });
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;
      const cookie = req.headers.cookie || '';

      const work = queue.filter((a) => !!(a.meta_url || a.title));

      // Return immediately; run capped pool in background so the request doesn't block.
      void mapPool(work, ANALYZE_BATCH_CONCURRENCY, async (article) => {
         const url = article.meta_url || article.title || '';
         try {
            await fetch(`${baseUrl}/api/articles/deep-analysis`, {
               method: 'POST',
               headers: {
                  'Content-Type': 'application/json',
                  Cookie: cookie,
               },
               body: JSON.stringify({
                  url,
                  articleId: article.id,
                  domainId,
               }),
            });
         } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[analyze-batch] Failed to trigger analysis for article ${article.id}:`, message);
         }
      });

      return res.status(200).json({
         queued: work.length,
         concurrency: ANALYZE_BATCH_CONCURRENCY,
         message: `${work.length} analyses queued (max ${ANALYZE_BATCH_CONCURRENCY} in flight)`,
      });
   } catch (error) {
      return res.status(500).json({ error: getErrorMessage(error) || 'Batch analysis error' });
   }
}

export default withOrgPaymentAccess(handler);
