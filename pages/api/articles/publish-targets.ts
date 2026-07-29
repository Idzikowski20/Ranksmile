// GET  /api/articles/publish-targets?domainId=X
// POST /api/articles/publish-targets  — dodaj publish target
// DELETE /api/articles/publish-targets?id=X
import type { NextApiRequest, NextApiResponse } from 'next';
import { QueryTypes } from 'sequelize';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';

import { ensureArticlesTables } from '../../../lib/ensureArticlesTables';
import { queryOne } from '../../../lib/db/query';
import { getCurrentUserId } from '../../../utils/getUser';
import { verifyDomainOwnershipById } from '../../../utils/verifyDomainOwnership';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';

async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   await ensureArticlesTables();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') {
      return res.status(401).json({ error: authorized });
   }

   const userId = await getCurrentUserId(req, res);

   if (req.method === 'GET') {
      const { domainId } = req.query;
      const owns = await verifyDomainOwnershipById(Number(domainId), userId);
      if (!owns) return res.status(403).json({ error: 'Access denied.' });

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
      const owns = await verifyDomainOwnershipById(Number(domain_id), userId);
      if (!owns) return res.status(403).json({ error: 'Access denied.' });

      // Upsert — nadpisz jeśli istnieje
      await db.query(
         `DELETE FROM publish_targets WHERE domain_id = ? AND type = ?`,
         { replacements: [domain_id, type] },
      );
      const [insertId] = await db.query(
         `INSERT INTO publish_targets (domain_id, type, url, api_key, created_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
         { replacements: [domain_id, type, url, api_key || ''], type: QueryTypes.INSERT },
      );
      return res.status(200).json({ id: insertId });
   }

   if (req.method === 'DELETE') {
      const { id } = req.query;
      const target = await queryOne<{ domain_id: number }>(
         `SELECT domain_id FROM publish_targets WHERE id = ? LIMIT 1`,
         [id],
      );
      if (!target) return res.status(404).json({ error: 'Publish target not found' });
      const owns = await verifyDomainOwnershipById(Number(target.domain_id), userId);
      if (!owns) return res.status(403).json({ error: 'Access denied.' });

      await db.query(`DELETE FROM publish_targets WHERE id = ?`, { replacements: [id] });
      return res.status(200).json({ deleted: true });
   }

   return res.status(405).json({ error: 'Method not allowed' });
}

export default withOrgPaymentAccess(handler);
