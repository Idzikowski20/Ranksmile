// GET /api/share/[token] — public read-only article lookup for the shared preview.
// No auth: possession of the opaque token grants view+comment access.
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import { ensureArticlesTables } from '../../../lib/ensureArticlesTables';
import { getArticleIdSql } from '../../../lib/articleSql';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   await ensureArticlesTables();
   if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

   const { token } = req.query;
   if (!token || typeof token !== 'string') return res.status(400).json({ error: 'token is required' });

   try {
      const articleIdSql = await getArticleIdSql();
      const [rows] = await db.query(
         `SELECT ${articleIdSql} AS id, title, content, target_keyword, status,
                 meta_title, meta_description, score_data, content_score,
                 language, created_at, updated_at
          FROM articles WHERE share_token = ? LIMIT 1`,
         { replacements: [token] },
      );
      const article = (rows as any[])[0];
      if (!article) return res.status(404).json({ error: 'Not found' });

      const [visRows] = await db.query(
         `SELECT summary_json, score FROM ai_visibility_runs WHERE article_id = ? ORDER BY created_at DESC, id DESC LIMIT 1`,
         { replacements: [article.id] },
      );
      const latest = (visRows as any[])[0];
      if (latest?.summary_json) {
         try { article.ai_visibility_summary = { ...JSON.parse(latest.summary_json), score: latest.score }; } catch { article.ai_visibility_summary = null; }
      }

      return res.status(200).json({ article });
   } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'DB error' });
   }
}
