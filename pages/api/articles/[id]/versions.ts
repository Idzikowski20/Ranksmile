// GET  /api/articles/[id]/versions  — list versions
// POST /api/articles/[id]/versions  — save current state as version, then restore a version
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { ensureArticlesTables } from '../../../../lib/ensureArticlesTables';
import { getArticleIdSql } from '../../../../lib/articleSql';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   await ensureArticlesTables();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });

   const { id } = req.query;
   if (!id || Array.isArray(id)) return res.status(400).json({ error: 'Valid id required' });

   if (req.method === 'GET') return getVersions(id, res);
   if (req.method === 'POST') return restoreVersion(id, req, res);
   return res.status(405).json({ error: 'Method not allowed' });
}

async function getVersions(id: string, res: NextApiResponse) {
   try {
      const [rows] = await db.query(
         `SELECT id, article_id, version_type, created_at,
                 LENGTH(content) AS content_length
          FROM article_versions
          WHERE article_id = ?
          ORDER BY created_at DESC`,
         { replacements: [id] },
      );
      return res.status(200).json({ versions: rows });
   } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'DB error' });
   }
}

async function restoreVersion(id: string, req: NextApiRequest, res: NextApiResponse) {
   const { versionId, currentContent, currentScoreData } = req.body;

   try {
      // 1. Save current state as a version first (so restore is undoable)
      if (currentContent !== undefined) {
         await db.query(
            `INSERT INTO article_versions (article_id, version_type, content, score_data, created_at)
             VALUES (?, 'pre_restore', ?, ?, CURRENT_TIMESTAMP)`,
            { replacements: [id, currentContent ?? '', currentScoreData ? JSON.stringify(currentScoreData) : null] },
         );
      }

      // 2. Fetch the version to restore
      const [rows] = await db.query(
         `SELECT content, score_data FROM article_versions WHERE id = ? AND article_id = ? LIMIT 1`,
         { replacements: [versionId, id] },
      );
      const version = (rows as any[])[0];
      if (!version) return res.status(404).json({ error: 'Version not found' });

      // 3. Update article with restored content
      const articleIdSql = await getArticleIdSql();
      await db.query(
         `UPDATE articles
          SET content = COALESCE(?, content),
              score_data = COALESCE(?, score_data),
              updated_at = CURRENT_TIMESTAMP
          WHERE ${articleIdSql} = ?`,
         { replacements: [version.content, version.score_data, id] },
      );

      return res.status(200).json({
         restored: true,
         content: version.content,
         score_data: version.score_data,
      });
   } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'DB error' });
   }
}
