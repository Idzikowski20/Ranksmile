// POST /api/articles/accept
// Zmienia status artykułu z 'draft' na 'accepted'
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import { ensureArticlesTables } from '../../../lib/ensureArticlesTables';
import { getArticleIdSql } from '../../../lib/articleSql';
import { getCurrentUserId } from '../../../utils/getUser';
import { assertArticleAccess } from '../../../lib/tenancy';
import { getErrorMessage } from '../../../lib/errors';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   await ensureArticlesTables();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') {
      return res.status(401).json({ error: authorized });
   }

   if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

   const { articleId, action } = req.body; // action: 'accept' | 'reject'
   if (!articleId) return res.status(400).json({ error: 'articleId is required' });

   const userId = await getCurrentUserId(req, res);
   if (!(await assertArticleAccess(userId, Number(articleId)))) {
      return res.status(403).json({ error: 'Access denied.' });
   }

   const newStatus = action === 'reject' ? 'rejected' : 'accepted';

   try {
      const articleIdSql = await getArticleIdSql();
      await db.query(
         `UPDATE articles SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
         { replacements: [newStatus, articleId] },
      );
      return res.status(200).json({ status: newStatus });
   } catch (error) {
      return res.status(500).json({ error: getErrorMessage(error) || 'DB error' });
   }
}
