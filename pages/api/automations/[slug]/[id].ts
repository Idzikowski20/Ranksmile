// DELETE /api/automations/:slug/:id
import type { NextApiRequest, NextApiResponse } from 'next';
import { QueryTypes } from 'sequelize';
import { ensureAutomationTables } from '@/src/infrastructure/persistence/schema/ensureAutomationTables';
import { withOrgPaymentAccess } from '@/src/infrastructure/billing/requireOrgPaymentAccess';
import { getArticleIdSql } from '@/src/infrastructure/articles/articleSql';
import { affectedRows } from '@/src/infrastructure/cron/queueRunner';
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
  const domainId = ownership.ID;

  const { getOrgIdForDomain, ensureOrgQuotaBalances, adjustActiveUsage } = await import('@/src/infrastructure/quota/index');
  const orgId = await getOrgIdForDomain(domainId);
  const articleIdSql = await getArticleIdSql();
  const lock = process.env.DATABASE_URL ? ' FOR UPDATE' : '';

  let outcome: 'deleted' | 'publishing' | 'missing' = 'missing';
  await db.transaction(async (tx) => {
    // Lock the event (Postgres) so the automations cron can't link a draft to it or claim its
    // publish while it is being removed; its conditional updates then find no row and back off.
    const found = await db.query<{ article_id: number | null; status: string }>(
      `SELECT article_id, status FROM automation_events WHERE id = ? AND domain_id = ?${lock}`,
      { replacements: [id, domainId], type: QueryTypes.SELECT, transaction: tx },
    );
    const event = found[0];
    if (!event) return;
    // A WordPress post is being created right now — removing the event would lose track of it.
    if (event.status === 'publishing') {
      outcome = 'publishing';
      return;
    }
    await db.query('DELETE FROM automation_events WHERE id = ? AND domain_id = ?', {
      replacements: [id, domainId],
      transaction: tx,
    });
    outcome = 'deleted';

    // Cancel the draft the scheduler made, and return its document — like a manual article
    // delete (same idempotency key, so a later delete of the article can't refund twice).
    // A published article is live on WordPress and stays; a scheduled event has no article.
    if (event.article_id == null || event.status === 'published') return;
    const removed = affectedRows(await db.query(
      `DELETE FROM articles WHERE ${articleIdSql} = ? AND domain_id = ? AND status <> 'published'`,
      { replacements: [event.article_id, domainId], transaction: tx },
    ));
    if (removed > 0 && orgId) {
      await ensureOrgQuotaBalances(orgId, { transaction: tx });
      await adjustActiveUsage(
        {
          orgId,
          meter: 'documents',
          delta: -1,
          idempotencyKey: `doc-delete:${event.article_id}`,
          ref: { type: 'article', id: String(event.article_id) },
          userId,
        },
        { transaction: tx },
      );
    }
  });

  if (outcome === 'missing') return res.status(404).json({ error: 'Event not found' });
  if (outcome === 'publishing') {
    return res.status(409).json({
      error: 'publishing',
      message: 'This article is being published to WordPress right now. Try again in a moment.',
    });
  }
  return res.status(200).json({ deleted: true });
}

export default withOrgPaymentAccess(handler);
