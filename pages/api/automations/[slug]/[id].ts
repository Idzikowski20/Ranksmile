// DELETE /api/automations/:slug/:id
import type { NextApiRequest, NextApiResponse } from 'next';
import { ensureAutomationTables } from '@/src/infrastructure/persistence/schema/ensureAutomationTables';
import { withOrgPaymentAccess } from '@/src/infrastructure/billing/requireOrgPaymentAccess';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';

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
    'SELECT id, article_id, status FROM automation_events WHERE id = ? AND domain_id = ? LIMIT 1',
    { replacements: [id, ownership.ID] },
  );
  const event = (existing as Array<{ id: number; article_id: number | null; status: string }>)[0];
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  // Remove the draft the scheduler created along with the event, so cancelling a scheduled
  // piece never leaves an orphaned article. A `published` event's article is live on
  // WordPress and stays; a scheduled event has no article yet.
  await db.transaction(async (tx) => {
    await db.query('DELETE FROM automation_events WHERE id = ? AND domain_id = ?', {
      replacements: [id, ownership.ID],
      transaction: tx,
    });
    if (event.article_id != null && event.status !== 'published') {
      const { getArticleIdSql } = await import('@/src/infrastructure/articles/articleSql');
      const articleIdSql = await getArticleIdSql();
      await db.query(
        `DELETE FROM articles WHERE ${articleIdSql} = ? AND domain_id = ? AND status <> 'published'`,
        { replacements: [event.article_id, ownership.ID], transaction: tx },
      );
    }
  });

  return res.status(200).json({ deleted: true });
}

export default withOrgPaymentAccess(handler);
