// GET    /api/articles/[id]  — pobierz artykuł
// PUT    /api/articles/[id]  — zaktualizuj artykuł (zapis edytora)
// DELETE /api/articles/[id]  — usuń artykuł
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { ensureArticlesTables } from '../../../../lib/ensureArticlesTables';
import { getArticleIdSql } from '../../../../lib/articleSql';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   await ensureArticlesTables();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') {
      return res.status(401).json({ error: authorized });
   }

   const { id } = req.query;
   if (!id || Array.isArray(id)) return res.status(400).json({ error: 'Valid id required' });

   if (req.method === 'GET') return getArticle(id, res);
   if (req.method === 'PUT') return updateArticle(id, req, res);
   if (req.method === 'DELETE') return deleteArticle(id, res);
   return res.status(405).json({ error: 'Method not allowed' });
}

async function getArticle(id: string, res: NextApiResponse) {
   try {
      const articleIdSql = await getArticleIdSql();
      const [rows] = await db.query(`SELECT *, ${articleIdSql} AS id FROM articles WHERE ${articleIdSql} = ? LIMIT 1`, {
         replacements: [id],
      });
      const article = (rows as any[])[0];
      if (!article) return res.status(404).json({ error: 'Article not found' });
      const [visibilityRows] = await db.query(
         `SELECT summary_json, score
          FROM ai_visibility_runs
          WHERE article_id = ?
          ORDER BY created_at DESC, id DESC
          LIMIT 1`,
         { replacements: [id] },
      );
      const latestVisibility = (visibilityRows as any[])[0];
      if (latestVisibility?.summary_json) {
         try {
            article.ai_visibility_summary = {
               ...JSON.parse(latestVisibility.summary_json),
               score: latestVisibility.score,
            };
         } catch {
            article.ai_visibility_summary = null;
         }
      }
      return res.status(200).json({ article });
   } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'DB error' });
   }
}

async function updateArticle(id: string, req: NextApiRequest, res: NextApiResponse) {
   const { title, content, status, target_keyword, meta_title, meta_description, meta_url, word_count, score_data, featured_image, internal_links_cache, version_type } = req.body;

   // Extract content score from score_data
   let contentScore = 0;
   try {
     if (score_data) {
       const sd = typeof score_data === 'string' ? JSON.parse(score_data) : score_data;
       contentScore = sd._computed_score ?? 0;
     }
   } catch { contentScore = 0; }

   try {
      const articleIdSql = await getArticleIdSql();
      if (version_type && content !== undefined) {
         await db.query(
            `INSERT INTO article_versions (article_id, version_type, content, score_data, created_at)
             VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            {
               replacements: [
                  id,
                  version_type,
                  content ?? '',
                  score_data ? JSON.stringify(score_data) : null,
               ],
            },
         );
      }
      await db.query(
         `UPDATE articles
          SET title = COALESCE(?, title),
              content = COALESCE(?, content),
              status = COALESCE(?, status),
              target_keyword = COALESCE(?, target_keyword),
              meta_title = COALESCE(?, meta_title),
              meta_description = COALESCE(?, meta_description),
              meta_url = COALESCE(?, meta_url),
              word_count = COALESCE(?, word_count),
              score_data = COALESCE(?, score_data),
              content_score = ?,
              featured_image = CASE WHEN ? IS NOT NULL THEN ? ELSE featured_image END,
              internal_links_cache = CASE WHEN ? IS NOT NULL THEN ? ELSE internal_links_cache END,
              updated_at = CURRENT_TIMESTAMP
          WHERE ${articleIdSql} = ?`,
         {
            replacements: [
               title ?? null,
               content ?? null,
               status ?? null,
               target_keyword ?? null,
               meta_title ?? null,
               meta_description ?? null,
               meta_url ?? null,
               word_count ?? null,
               score_data ? JSON.stringify(score_data) : null,
               score_data ? contentScore : 0,
               featured_image !== undefined ? featured_image : null,
               featured_image !== undefined ? featured_image : null,
               internal_links_cache !== undefined ? JSON.stringify(internal_links_cache) : null,
               internal_links_cache !== undefined ? JSON.stringify(internal_links_cache) : null,
               id,
            ],
         },
      );
      return res.status(200).json({ updated: true });
   } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'DB error' });
   }
}

async function deleteArticle(id: string, res: NextApiResponse) {
   try {
      const articleIdSql = await getArticleIdSql();
      await db.query(`DELETE FROM articles WHERE ${articleIdSql} = ?`, { replacements: [id] });
      return res.status(200).json({ deleted: true });
   } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'DB error' });
   }
}
