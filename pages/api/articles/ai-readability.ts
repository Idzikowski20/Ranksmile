// POST /api/articles/ai-readability  { articleId }
// Runs the LLM "AI Readability" rubric (10 criteria) on the article via the sidecar,
// persists the result, and returns { score, criteria }.
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import { ensureArticlesTables } from '../../../lib/ensureArticlesTables';
import { getArticleIdSql } from '../../../lib/articleSql';
import { callSidecar } from '../../../lib/sidecar';
import { getCurrentUserId } from '../../../utils/getUser';
import { assertArticleAccess } from '../../../lib/tenancy';
import { getErrorMessage } from '../../../lib/errors';
import { queryOne, ArticleRow } from '../../../lib/db/query';

// Vercel: LLM/sidecar calls can take up to ~minutes; raise from the ~10s default.
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
      const article = await queryOne<Pick<ArticleRow, 'content' | 'meta_title' | 'meta_description' | 'target_keyword' | 'title'>>(
         `SELECT content, meta_title, meta_description, target_keyword, title FROM articles WHERE ${articleIdSql} = ? LIMIT 1`,
         [articleId],
      );
      if (!article) return res.status(404).json({ error: 'Article not found' });

      const articleContent = `${article.meta_title || ''}\n${article.meta_description || ''}\n${article.content || ''}`;
      const data = await callSidecar('/ai-readability', { article_content: articleContent, keyword: article.target_keyword || article.title || '' });
      try {
         await db.query(
            `UPDATE articles SET ai_readability_json = ?, updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
            { replacements: [JSON.stringify(data), articleId] },
         );
      } catch { /* non-fatal */ }

      return res.status(200).json(data);
   } catch (error) {
      return res.status(500).json({ error: getErrorMessage(error) || 'AI readability failed' });
   }
}
