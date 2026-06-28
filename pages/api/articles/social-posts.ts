// POST /api/articles/social-posts  { articleId }
// Generates 3 social-media promo post variants from the article via the sidecar.
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import { ensureArticlesTables } from '../../../lib/ensureArticlesTables';
import { getArticleIdSql } from '../../../lib/articleSql';
import { callSidecar } from '../../../lib/sidecar';
import { getCurrentUserId } from '../../../utils/getUser';
import { assertArticleAccess } from '../../../lib/tenancy';

// Vercel: the LLM call can take ~minutes; raise from the ~10s default.
export const config = { maxDuration: 60 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   await ensureArticlesTables();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

   const { articleId } = req.body;
   if (!articleId) return res.status(400).json({ error: 'articleId is required' });

   const userId = await getCurrentUserId(req, res);
   if (!(await assertArticleAccess(userId, Number(articleId)))) {
      return res.status(403).json({ error: 'Access denied.' });
   }

   try {
      const articleIdSql = await getArticleIdSql();
      const [rows] = await db.query(
         `SELECT content, target_keyword, title FROM articles WHERE ${articleIdSql} = ? LIMIT 1`,
         { replacements: [articleId] },
      );
      const article = (rows as any[])[0];
      if (!article) return res.status(404).json({ error: 'Article not found' });
      if (!article.content) return res.status(400).json({ error: 'Article has no content yet.' });

      const data = await callSidecar('/social-posts', {
         article_content: article.content,
         keyword: article.target_keyword || article.title || '',
      });
      return res.status(200).json(data);
   } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Could not generate social posts' });
   }
}
