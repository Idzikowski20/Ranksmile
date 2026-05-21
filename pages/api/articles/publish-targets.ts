// GET  /api/articles/publish-targets?domainId=X
// POST /api/articles/publish-targets  — dodaj publish target
// DELETE /api/articles/publish-targets?id=X
import type { NextApiRequest, NextApiResponse } from 'next';
import { QueryTypes } from 'sequelize';
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

   if (req.method === 'GET') {
      const { domainId } = req.query;
      const [rows] = await db.query(
         `SELECT id, domain_id, type, url, created_at FROM publish_targets WHERE domain_id = ?`,
         { replacements: [domainId] },
      );
      return res.status(200).json({ targets: rows });
   }

   if (req.method === 'POST') {
      const { domain_id, type, url, api_key } = req.body;
      if (!domain_id || !type || !url) {
         return res.status(400).json({ error: 'domain_id, type and url are required' });
      }
      // Upsert — nadpisz jeśli istnieje
      await db.query(
         `DELETE FROM publish_targets WHERE domain_id = ? AND type = ?`,
         { replacements: [domain_id, type] },
      );
      const [insertId] = await db.query(
         `INSERT INTO publish_targets (domain_id, type, url, api_key, created_at)
          VALUES (?, ?, ?, ?, datetime('now'))`,
         { replacements: [domain_id, type, url, api_key || ''], type: QueryTypes.INSERT },
      );
      return res.status(200).json({ id: insertId });
   }

   if (req.method === 'DELETE') {
      const { id } = req.query;
      await db.query(`DELETE FROM publish_targets WHERE id = ?`, { replacements: [id] });
      return res.status(200).json({ deleted: true });
   }

   return res.status(405).json({ error: 'Method not allowed' });
}
