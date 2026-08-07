// POST /api/articles/apply-readability  { articleId, content, suggestions[] }
// Applies the AI Readability suggestions to the article HTML via the sidecar (structure-only
// rewrite) and returns { content }. The client shows a diff/accept bar; persistence happens
// on Accept (separate save), so this route does NOT write to the DB.
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import { ensureArticlesTables } from '../../../lib/ensureArticlesTables';
import { getArticleIdSql } from '../../../lib/articleSql';
import { callSidecar } from '../../../lib/sidecar';
import { getCurrentUserId } from '../../../utils/getUser';
import { assertArticleAccess } from '../../../lib/tenancy';
import { getErrorMessage } from '../../../lib/errors';
import { queryOne } from '../../../lib/db/query';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';

async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   await ensureArticlesTables();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

   const { articleId, content, suggestions } = req.body;
   if (!articleId) return res.status(400).json({ error: 'articleId is required' });
   if (!content || !Array.isArray(suggestions) || suggestions.length === 0) {
      return res.status(400).json({ error: 'content and suggestions are required' });
   }

   const userId = await getCurrentUserId(req, res);
   if (!(await assertArticleAccess(userId, Number(articleId)))) {
      return res.status(403).json({ error: 'Access denied.' });
   }

   try {
      const articleIdSql = await getArticleIdSql();
      const article = await queryOne<{ target_keyword: string | null; title: string | null }>(
         `SELECT target_keyword, title FROM articles WHERE ${articleIdSql} = ? LIMIT 1`,
         [articleId],
      );
      if (!article) return res.status(404).json({ error: 'Article not found' });

      const data = await callSidecar('/apply-ai-readability', {
         content,
         suggestions,
         keyword: article.target_keyword || article.title || '',
      });

      return res.status(200).json(data);
   } catch (error) {
      return res.status(500).json({ error: getErrorMessage(error) || 'Apply readability failed' });
   }
}

export default withOrgPaymentAccess(handler);
