// POST /api/articles/publish
// Publikuje artykuł do WordPress lub własnego Next.js i auto-dodaje keyword do SerpBear
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import { ensureArticlesTables } from '../../../lib/ensureArticlesTables';
import { publishToWordPress, publishToNextJs } from '../../../lib/wordpressPublish';
import { getArticleIdSql } from '../../../lib/articleSql';

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

   try {
      const articleIdSql = await getArticleIdSql();
      // Pobierz artykuł
      const [articleRows] = await db.query(
         `SELECT *, ${articleIdSql} AS id FROM articles WHERE ${articleIdSql} = ? LIMIT 1`,
         { replacements: [articleId] },
      );
      const article = (articleRows as any[])[0];
      if (!article) return res.status(404).json({ error: 'Article not found' });

      // Pobierz publish target konfigurację
      const [targetRows] = await db.query(
         `SELECT * FROM publish_targets WHERE domain_id = ? AND type = ? LIMIT 1`,
         { replacements: [article.domain_id, target] },
      );
      const publishTarget = (targetRows as any[])[0];
      if (!publishTarget) {
         return res.status(400).json({ error: `No publish target configured for ${target}. Configure it in Settings.` });
      }

      let publishedUrl = '';

      if (target === 'wordpress') {
         const result = await publishToWordPress({
            wpUrl: publishTarget.url,
            apiKey: publishTarget.api_key,
            title: article.meta_title || article.title,
            content: article.content,
            slug: article.meta_url,
            excerpt: article.meta_description,
            status: 'publish',
            schemaJson: article.schema_json ? JSON.parse(article.schema_json) : undefined,
         });
         publishedUrl = result.link;
      } else if (target === 'nextjs') {
         const result = await publishToNextJs({
            endpointUrl: publishTarget.url,
            apiKey: publishTarget.api_key,
            title: article.meta_title || article.title,
            content: article.content,
            slug: article.meta_url,
            description: article.meta_description,
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

      // Auto-dodaj keyword do SerpBear rank trackera (jeśli jeszcze nie istnieje)
      if (article.target_keyword) {
         try {
            const [existing] = await db.query(
               `SELECT "ID" FROM keyword WHERE domain = ? AND keyword = ? LIMIT 1`,
               { replacements: [article.domain_id?.toString() || '', article.target_keyword] },
            );
            if ((existing as any[]).length === 0) {
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
   } catch (error: any) {
      console.error('publish error:', error);
      return res.status(500).json({ error: error?.message || 'Publish failed' });
   }
}
