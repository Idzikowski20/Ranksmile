// DELETE /api/site-context/[id] — remove a GSC/imported page that lives in
// site_context (these rows show up in Recommendations as un-analyzed pages and
// carry an `sc_<id>` id on the client, so they can't be deleted via /api/articles).
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import { getCurrentUserId } from '../../../utils/getUser';
import { getUserDomainIds } from '../articles/index';
import { queryOne } from '../../../lib/db/query';
import { getErrorMessage } from '../../../lib/errors';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';

async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'DELETE') {
      res.setHeader('Allow', 'DELETE');
      return res.status(405).json({ error: 'Method not allowed' });
   }

   const id = parseInt(req.query.id as string, 10);
   if (!Number.isFinite(id)) return res.status(400).json({ error: 'Valid id required' });

   try {
      const userId = await getCurrentUserId(req, res);
      const row = await queryOne<{ domain_id: number }>('SELECT domain_id FROM site_context WHERE id = ? LIMIT 1', [id]);
      if (!row) return res.status(404).json({ error: 'Page not found' });

      const allowedIds = await getUserDomainIds(userId);
      if (!allowedIds.includes(row.domain_id)) return res.status(403).json({ error: 'Access denied.' });

      await db.query('DELETE FROM site_context WHERE id = ?', { replacements: [id] });
      return res.status(200).json({ deleted: true });
   } catch (error) {
      return res.status(500).json({ error: getErrorMessage(error) || 'DB error' });
   }
}

export default withOrgPaymentAccess(handler);
