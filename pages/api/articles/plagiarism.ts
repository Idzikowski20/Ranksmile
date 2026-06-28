import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import { ensureArticlesTables } from '../../../lib/ensureArticlesTables';
import { getArticleIdSql } from '../../../lib/articleSql';
import { callSidecar } from '../../../lib/sidecar';

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

   try {
      const articleIdSql = await getArticleIdSql();
      const [articleRows] = await db.query(
         `SELECT a.content, a.language, d.domain
          FROM articles a
          LEFT JOIN domain d ON d."ID" = a.domain_id
          WHERE a.${articleIdSql} = ?
          LIMIT 1`,
         { replacements: [articleId] },
      );
      const article = (articleRows as any[])[0];
      if (!article) return res.status(404).json({ error: 'Article not found' });

      const text = (article.content || '').toString();
      if (!text.trim()) return res.status(200).json({ available: true, checked: 0, matched: 0, uniqueness: 100, matches: [] });

      const data = await callSidecar('/plagiarism', {
         text,
         domain: article.domain || '',
         language: article.language || 'pl',
      }, 90000);
      // Persist so the panel can restore it on reload without re-scanning.
      try {
         await db.query(
            `UPDATE articles SET plagiarism_json = ?, updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
            { replacements: [JSON.stringify(data), articleId] },
         );
      } catch { /* non-fatal */ }
      return res.status(200).json(data);
   } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Plagiarism scan failed' });
   }
}
