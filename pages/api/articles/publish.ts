// POST /api/articles/publish
// Publikuje artykuł do WordPress lub własnego Next.js i auto-dodaje keyword do Ranksmile
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import { ensureArticlesTables } from '../../../lib/ensureArticlesTables';
import { publishToWordPress, publishToNextJs } from '../../../lib/wordpressPublish';
import { getArticleIdSql } from '../../../lib/articleSql';
import { getCurrentUserId } from '../../../utils/getUser';
import { assertArticleAccess } from '../../../lib/tenancy';
import { getErrorMessage } from '../../../lib/errors';
import { queryOne, queryRows, ArticleRow } from '../../../lib/db/query';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   await ensureArticlesTables();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') {
      return res.status(401).json({ error: authorized });
   }

   if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

   const { articleId, target } = req.body; // target: 'wordpress' | 'nextjs'

   if (!articleId || !target) {
      return res.status(400).json({ error: 'articleId and target are required' });
   }

   const userId = await getCurrentUserId(req, res);
   if (!(await assertArticleAccess(userId, Number(articleId)))) {
      return res.status(403).json({ error: 'Access denied.' });
   }

   try {
      const articleIdSql = await getArticleIdSql();
      // Pobierz artykuł
      const article = await queryOne<ArticleRow>(
         `SELECT *, ${articleIdSql} AS id FROM articles WHERE ${articleIdSql} = ? LIMIT 1`,
         [articleId],
      );
      if (!article) return res.status(404).json({ error: 'Article not found' });

      // Pobierz publish target konfigurację
      const publishTarget = await queryOne<{ url: string; api_key: string }>(
         `SELECT * FROM publish_targets WHERE domain_id = ? AND type = ? LIMIT 1`,
         [article.domain_id, target],
      );
      if (!publishTarget) {
         return res.status(400).json({ error: `No publish target configured for ${target}. Configure it in Settings.` });
      }

      let publishedUrl = '';

      if (target === 'wordpress') {
         const result = await publishToWordPress({
            wpUrl: publishTarget.url,
            apiKey: publishTarget.api_key,
            title: article.meta_title || article.title || '',
            content: article.content || '',
            slug: article.meta_url ?? undefined,
            excerpt: article.meta_description ?? undefined,
            status: 'publish',
            schemaJson: article.schema_json ? JSON.parse(article.schema_json) : undefined,
         });
         publishedUrl = result.link;
      } else if (target === 'nextjs') {
         const result = await publishToNextJs({
            endpointUrl: publishTarget.url,
            apiKey: publishTarget.api_key,
            title: article.meta_title || article.title || '',
            content: article.content || '',
            slug: article.meta_url ?? undefined,
            description: article.meta_description ?? undefined,
            schema: article.schema_json ? JSON.parse(article.schema_json) : undefined,
         });
         publishedUrl = result.url;
      } else {
         return res.status(400).json({ error: `Unknown target: ${target}` });
      }

      // Zaktualizuj status artykułu
      await db.query(
         `UPDATE articles
          SET status = 'published', publish_target = ?, publish_url = ?,
              published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE ${articleIdSql} = ?`,
         { replacements: [target, publishedUrl, articleId] },
      );

      // Auto-dodaj keyword do Ranksmile rank trackera (jeśli jeszcze nie istnieje)
      if (article.target_keyword) {
         try {
            const existing = await queryRows<{ ID: number }>(
               `SELECT "ID" FROM keyword WHERE domain = ? AND keyword = ? LIMIT 1`,
               [article.domain_id?.toString() || '', article.target_keyword],
            );
            if (existing.length === 0) {
               await db.query(
                  `INSERT INTO keyword (keyword, domain, device, country, position, history, added, lastUpdated)
                   VALUES (?, ?, 'desktop', 'pl', 0, '[]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                  { replacements: [article.target_keyword, article.domain_id?.toString() || ''] },
               );
            }
         } catch (kwErr) {
            console.warn('Could not auto-add keyword:', kwErr);
         }
      }

      return res.status(200).json({ url: publishedUrl, published: true });
   } catch (error) {
      console.error('publish error:', error);
      return res.status(500).json({ error: getErrorMessage(error) || 'Publish failed' });
   }
}
