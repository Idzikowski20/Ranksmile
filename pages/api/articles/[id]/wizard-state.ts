// POST /api/articles/[id]/wizard-state
// Persists New-Content wizard progress so an unfinished draft can be resumed.
//   body { patch: {...} } → shallow-merge into the stored wizard_state JSON
//   body { clear: true }  → null it out (wizard finished / generation started)
import type { NextApiRequest, NextApiResponse } from 'next';
import { QueryTypes } from 'sequelize';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { ensureArticlesTables } from '../../../../lib/ensureArticlesTables';
import { getArticleIdSql } from '../../../../lib/articleSql';
import { getCurrentUserId } from '../../../../utils/getUser';
import { assertArticleAccess } from '../../../../lib/tenancy';
import { getErrorMessage } from '../../../../lib/errors';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await ensureArticlesTables();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method not allowed' });
   }

   const { id } = req.query;
   const { patch, clear } = req.body || {};

   const userId = await getCurrentUserId(req, res);
   const articleId = parseInt((req.query.id ?? req.query.articleId) as string, 10);
   if (!(await assertArticleAccess(userId, articleId))) {
      return res.status(403).json({ error: 'Access denied.' });
   }
   const articleIdSql = await getArticleIdSql();

   try {
      if (clear) {
         await db.query(
            `UPDATE articles SET wizard_state = NULL, updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
            { replacements: [id] },
         );
         return res.status(200).json({ ok: true });
      }

      const rows = await db.query<{ wizard_state: string | null }>(
         `SELECT wizard_state FROM articles WHERE ${articleIdSql} = ? LIMIT 1`,
         { replacements: [id], type: QueryTypes.SELECT },
      );
      let existing: Record<string, any> = {};
      try { existing = rows[0]?.wizard_state ? JSON.parse(rows[0].wizard_state) : {}; } catch { existing = {}; }
      const merged = { ...existing, ...(patch || {}) };

      await db.query(
         `UPDATE articles SET wizard_state = ?, updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
         { replacements: [JSON.stringify(merged), id] },
      );
      return res.status(200).json({ ok: true, wizard_state: merged });
   } catch (error) {
      return res.status(500).json({ error: getErrorMessage(error) || 'DB error' });
   }
}
