// POST /api/articles/accept
// Zmienia status artykułu z 'draft' na 'accepted'
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import { ensureArticlesTables } from '../../../lib/ensureArticlesTables';

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

   const newStatus = action === 'reject' ? 'rejected' : 'accepted';

   try {
      await db.query(
         `UPDATE articles SET status = ?, updated_at = datetime('now') WHERE id = ?`,
         { replacements: [newStatus, articleId] },
      );
      return res.status(200).json({ status: newStatus });
   } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'DB error' });
   }
}
