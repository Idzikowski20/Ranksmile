// POST /api/articles/analyze-batch
// Triggers deep-analysis for all unscored articles in a domain.
// Fire-and-forget — returns immediately, analyses run in background.
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

// Vercel: LLM/sidecar calls can take up to ~minutes; raise from the ~10s default.
export const config = { maxDuration: 60 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });

   await db.sync();
   await ensureArticlesTables();
   const userId = await getCurrentUserId(req, res);
   const { domainId } = req.body;
   if (!domainId) return res.status(400).json({ error: 'domainId is required' });

   // Ownership + budget: this fans out one full deep-analysis pipeline per article.
   const owns = await verifyDomainOwnershipById(Number(domainId), userId ? String(userId) : null);
   if (owns === null) return res.status(404).json({ error: 'Domain not found' });
   if (owns === false) return res.status(403).json({ error: 'Access denied.' });
   const orgId = await resolveOrgId(req, res);
   const over = await orgBudgetBlocked(orgId);
   if (over) return res.status(429).json(over);

   try {
      const articleIdSql = await getArticleIdSql();

      // Find unscored draft articles for this domain. Capped so one request can't fan out an
      // unbounded number of concurrent sidecar+LLM pipelines.
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
         return res.status(200).json({ queued: 0, message: 'No pending articles to analyze' });
      }

      // Self-call base URL from configured app URL (NOT the spoofable x-forwarded-host header).
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;

      // Fire-and-forget: trigger deep-analysis for each article in background
      let queued = 0;
      for (const article of queue) {
         const url = article.meta_url || article.title || '';
         if (!url) continue;

         // Fire off deep-analysis asynchronously — don't await
         fetch(`${baseUrl}/api/articles/deep-analysis`, {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json',
               Cookie: req.headers.cookie || '', // forward auth cookie
            },
            body: JSON.stringify({
               url,
               articleId: article.id,
               domainId,
            }),
         }).catch((err) => {
            console.error(`[analyze-batch] Failed to trigger analysis for article ${article.id}:`, err.message);
         });

         queued += 1;
      }

      return res.status(200).json({ queued, message: `${queued} analyses started in background` });
   } catch (error) {
      return res.status(500).json({ error: getErrorMessage(error) || 'Batch analysis error' });
   }
}
