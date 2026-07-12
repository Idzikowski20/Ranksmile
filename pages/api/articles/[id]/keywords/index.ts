import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../../database/database';
import verifyUser from '../../../../../utils/verifyUser';
import { ensureArticlesTables } from '../../../../../lib/ensureArticlesTables';
import { getCurrentUserId } from '../../../../../utils/getUser';
import { assertArticleAccess } from '../../../../../lib/tenancy';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await db.sync();
  await ensureArticlesTables();
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });

  const userId = await getCurrentUserId(req, res);
  const articleId = parseInt(req.query.id as string, 10);
  if (!(await assertArticleAccess(userId, articleId))) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  const { id } = req.query;

  if (req.method === 'GET') {
    const [rows] = await db.query(
      `SELECT * FROM article_keywords WHERE article_id = ? ORDER BY ads_monthly_volume DESC NULLS LAST, relevance_score DESC NULLS LAST`,
      { replacements: [id] },
    );
    return res.status(200).json({ keywords: rows });
  }

  if (req.method === 'PUT') {
    const { keywordId, is_covered, relevance_score } = req.body;
    await db.query(
      `UPDATE article_keywords SET is_covered = ?, relevance_score = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND article_id = ?`,
      { replacements: [is_covered ? 1 : 0, relevance_score, keywordId, articleId] },
    );
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
