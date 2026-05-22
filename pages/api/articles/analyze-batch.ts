// POST /api/articles/analyze-batch
// Triggers deep-analysis for all unscored articles in a domain.
// Fire-and-forget — returns immediately, analyses run in background.
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import { getCurrentUserId } from '../../../utils/getUser';
import { getArticleIdSql } from '../../../lib/articleSql';
import { ensureArticlesTables } from '../../../lib/ensureArticlesTables';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });

   await db.sync();
   await ensureArticlesTables();
   const userId = await getCurrentUserId(req, res);
   const { domainId } = req.body;
   if (!domainId) return res.status(400).json({ error: 'domainId is required' });

   try {
      const articleIdSql = await getArticleIdSql();

      // Find all unscored draft articles for this domain
      const [articles] = await db.query(
         `SELECT ${articleIdSql} AS id, meta_url, title
          FROM articles
          WHERE domain_id = ?
            AND content_score = 0
            AND status = 'draft'
            AND meta_url IS NOT NULL
          ORDER BY created_at ASC`,
         { replacements: [domainId] },
      );

      const queue = articles as any[];
      if (queue.length === 0) {
         return res.status(200).json({ queued: 0, message: 'No pending articles to analyze' });
      }

      // Build base URL from request
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
      const baseUrl = `${protocol}://${host}`;

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
   } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Batch analysis error' });
   }
}
