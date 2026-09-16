// GET  /api/automations/:slug?from=YYYY-MM-DD&to=YYYY-MM-DD
// POST /api/automations/:slug  { scheduledDate, title, targetKeyword?, publishMode }
import type { NextApiRequest, NextApiResponse } from 'next';
import { QueryTypes } from 'sequelize';
import { ensureAutomationTables } from '@/src/infrastructure/persistence/schema/ensureAutomationTables';
import { getConnectionForWorkspace } from '@/src/infrastructure/wordpress/wpConnection';
import { withOrgPaymentAccess } from '@/src/infrastructure/billing/requireOrgPaymentAccess';
import { getErrorMessage } from '@/src/core/shared/errors';
import { mapAutomationEvent, type AutomationEventRow, type AutomationPublishMode } from '@/src/core/shared/types/automations';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';
import { getCurrentUserId } from '../../../../utils/getUser';
import verifyUser from '../../../../utils/verifyUser';
import db from '../../../../database/database';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parsePublishMode(raw: unknown): AutomationPublishMode | null {
  if (raw === 'draft' || raw === 'live') return raw;
  return null;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  await ensureAutomationTables();
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });

  const slug = typeof req.query.slug === 'string' ? req.query.slug : '';
  if (!slug) return res.status(400).json({ error: 'Domain slug is required' });

  const userId = await getCurrentUserId(req, res);
  const ownership = await verifyDomainOwnershipBySlug(slug, userId);
  if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
  if (ownership === null) return res.status(404).json({ error: 'Domain not found' });

  const domainId = ownership.ID;
  const workspaceId = ownership.workspace_id;
  if (!workspaceId) return res.status(400).json({ error: 'Domain has no workspace' });

  if (req.method === 'GET') return listEvents(req, res, domainId, workspaceId);
  if (req.method === 'POST') return createEvent(req, res, domainId, workspaceId, userId);
  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}

async function listEvents(
  req: NextApiRequest,
  res: NextApiResponse,
  domainId: number,
  workspaceId: number,
) {
  const from = typeof req.query.from === 'string' ? req.query.from : '';
  const to = typeof req.query.to === 'string' ? req.query.to : '';
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
    return res.status(400).json({ error: 'from and to must be YYYY-MM-DD' });
  }

  const conn = await getConnectionForWorkspace(workspaceId);
  const [rows] = await db.query(
    `SELECT id, domain_id, workspace_id, scheduled_date, title, target_keyword,
            publish_mode, article_id, status, created_at
     FROM automation_events
     WHERE domain_id = ? AND scheduled_date >= ? AND scheduled_date <= ?
     ORDER BY scheduled_date ASC, id ASC`,
    { replacements: [domainId, from, to] },
  );

  return res.status(200).json({
    wordpressConnected: !!conn,
    siteUrl: conn?.site_url || null,
    events: (rows as AutomationEventRow[]).map(mapAutomationEvent),
  });
}

async function createEvent(
  req: NextApiRequest,
  res: NextApiResponse,
  domainId: number,
  workspaceId: number,
  userId: string | null,
) {
  const body = (req.body || {}) as Record<string, unknown>;
  const scheduledDate = typeof body.scheduledDate === 'string' ? body.scheduledDate : '';
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const targetKeyword = typeof body.targetKeyword === 'string' ? body.targetKeyword.trim() : '';
  const publishMode = parsePublishMode(body.publishMode);

  if (!DATE_RE.test(scheduledDate)) return res.status(400).json({ error: 'scheduledDate must be YYYY-MM-DD' });
  if (!title) return res.status(400).json({ error: 'title is required' });
  if (!publishMode) return res.status(400).json({ error: 'publishMode must be draft or live' });

  // WordPress is only needed to publish. A draft-intent event can be scheduled without it;
  // a live one must have somewhere to publish to on the scheduled day.
  if (publishMode === 'live') {
    const conn = await getConnectionForWorkspace(workspaceId);
    if (!conn) {
      return res.status(400).json({
        error: 'wordpress_not_connected',
        message: 'Connect WordPress in Settings before scheduling a live publish.',
      });
    }
  }

  try {
    // The event is only scheduled here — no article, no quota yet. The automations cron
    // creates the draft, generates content, and publishes on the scheduled day (billing a
    // document then), so nothing runs at create time.
    let eventId: number | undefined;
    if (process.env.DATABASE_URL) {
      const erows = await db.query<{ id: number }>(
        `INSERT INTO automation_events
           (domain_id, workspace_id, scheduled_date, title, target_keyword, publish_mode, article_id, status, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, 'scheduled', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING id`,
        { replacements: [domainId, workspaceId, scheduledDate, title, targetKeyword || '', publishMode, userId], type: QueryTypes.SELECT },
      );
      eventId = erows[0]?.id;
    } else {
      const [newEventId] = await db.query(
        `INSERT INTO automation_events
           (domain_id, workspace_id, scheduled_date, title, target_keyword, publish_mode, article_id, status, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, 'scheduled', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        { replacements: [domainId, workspaceId, scheduledDate, title, targetKeyword || '', publishMode, userId], type: QueryTypes.INSERT },
      );
      eventId = newEventId as unknown as number;
    }

    const [rows] = await db.query(
      `SELECT id, domain_id, workspace_id, scheduled_date, title, target_keyword,
              publish_mode, article_id, status, created_at
       FROM automation_events WHERE id = ? LIMIT 1`,
      { replacements: [eventId] },
    );
    const row = (rows as AutomationEventRow[])[0];
    if (!row) return res.status(500).json({ error: 'Event created but not found' });

    return res.status(200).json({ event: mapAutomationEvent(row), articleId: null });
  } catch (error) {
    return res.status(500).json({ error: getErrorMessage(error) || 'DB error' });
  }
}

export default withOrgPaymentAccess(handler);
