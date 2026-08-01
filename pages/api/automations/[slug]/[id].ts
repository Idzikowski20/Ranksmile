// DELETE /api/automations/:slug/:id
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';
import { ensureAutomationTables } from '../../../../lib/ensureAutomationTables';
import { withOrgPaymentAccess } from '../../../../lib/requireOrgPaymentAccess';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  await ensureAutomationTables();
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });

  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const slug = typeof req.query.slug === 'string' ? req.query.slug : '';
  const id = Number(req.query.id);
  if (!slug || !id) return res.status(400).json({ error: 'slug and id are required' });

  const userId = await getCurrentUserId(req, res);
  const ownership = await verifyDomainOwnershipBySlug(slug, userId);
  if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
  if (ownership === null) return res.status(404).json({ error: 'Domain not found' });

  const [existing] = await db.query(
    'SELECT id FROM automation_events WHERE id = ? AND domain_id = ? LIMIT 1',
    { replacements: [id, ownership.ID] },
  );
  if (!(existing as Array<{ id: number }>)[0]) {
    return res.status(404).json({ error: 'Event not found' });
  }

  await db.query('DELETE FROM automation_events WHERE id = ? AND domain_id = ?', {
    replacements: [id, ownership.ID],
  });

  return res.status(200).json({ deleted: true });
}

export default withOrgPaymentAccess(handler);
