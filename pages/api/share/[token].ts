// GET /api/share/[token] — public read-only article lookup for the shared preview.
// No auth: possession of the opaque token grants view+comment access.
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import { ensureArticlesTables } from '../../../lib/ensureArticlesTables';
import { getArticleIdSql } from '../../../lib/articleSql';
import { sanitizeArticleHtml } from '../../../lib/sanitizeHtml';
import { queryOne, ArticleRow } from '../../../lib/db/query';
import { getErrorMessage } from '../../../lib/errors';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   await ensureArticlesTables();
   if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

   const { token } = req.query;
   if (!token || typeof token !== 'string') return res.status(400).json({ error: 'token is required' });

   try {
      const articleIdSql = await getArticleIdSql();
      const article = await queryOne<ArticleRow & { ai_visibility_summary?: unknown }>(
         `SELECT ${articleIdSql} AS id, title, content, target_keyword, status,
                 meta_title, meta_description, score_data, content_score,
                 language, created_at, updated_at
          FROM articles WHERE share_token = ? LIMIT 1`,
         [token],
      );
      if (!article) return res.status(404).json({ error: 'Not found' });
      // This body is rendered on the PUBLIC, unauthenticated share page via dangerouslySetInnerHTML.
      // The stored HTML comes from raw model/scraped/imported sources, so sanitize at the render
      // boundary — strips <script>/<iframe>/on*=/javascript: (stored-XSS via AI/import).
      article.content = sanitizeArticleHtml(article.content || '');

      const latest = await queryOne<{ summary_json: string | null; score: number | null }>(
         `SELECT summary_json, score FROM ai_visibility_runs WHERE article_id = ? ORDER BY created_at DESC, id DESC LIMIT 1`,
         [article.id],
      );
      if (latest?.summary_json) {
         try { article.ai_visibility_summary = { ...JSON.parse(latest.summary_json), score: latest.score }; } catch { article.ai_visibility_summary = null; }
      }

      return res.status(200).json({ article });
   } catch (error) {
      return res.status(500).json({ error: getErrorMessage(error) || 'DB error' });
   }
}
