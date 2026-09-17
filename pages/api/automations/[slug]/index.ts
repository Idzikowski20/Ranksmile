// GET  /api/automations/:slug?from=YYYY-MM-DD&to=YYYY-MM-DD
// POST /api/automations/:slug  { scheduledDate, keywords: string[], publishMode, timeZone? }
//      One keyword = one scheduled article. The title is chosen later by the LLM when the
//      automations cron writes the article.
import type { NextApiRequest, NextApiResponse } from 'next';
import { QueryTypes } from 'sequelize';
import { ensureAutomationTables } from '@/src/infrastructure/persistence/schema/ensureAutomationTables';
import { ensureArticlesTables } from '@/src/infrastructure/persistence/schema/ensureArticlesTables';
import { getConnectionForWorkspace } from '@/src/infrastructure/wordpress/wpConnection';
import { withOrgPaymentAccess } from '@/src/infrastructure/billing/requireOrgPaymentAccess';
import { getArticleIdSql } from '@/src/infrastructure/articles/articleSql';
import { getDomainLocale } from '@/src/infrastructure/config/domainLanguage';
import { getErrorMessage } from '@/src/core/shared/errors';
import { normalizeKeywords } from '@/src/core/domain/automations/keywords';
import { normalizeTimeZone } from '@/src/core/domain/automations/schedule';
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
  await ensureArticlesTables(); // the list joins articles
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
  if (req.method === 'POST') return createEvents(req, res, domainId, workspaceId, userId);
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
  const articleIdSql = await getArticleIdSql();
  // The generated article's title (LLM H1) replaces the keyword on the card once written.
  const rows = await db.query<AutomationEventRow>(
    `SELECT e.id, e.domain_id, e.workspace_id, e.scheduled_date, e.title, e.target_keyword,
            e.publish_mode, e.article_id, e.status, e.created_at, a.title AS article_title
     FROM automation_events e
     LEFT JOIN articles a ON a.${articleIdSql} = e.article_id
     WHERE e.domain_id = ? AND e.scheduled_date >= ? AND e.scheduled_date <= ?
     ORDER BY e.scheduled_date ASC, e.id ASC`,
    { replacements: [domainId, from, to], type: QueryTypes.SELECT },
  );
  const { countryCode } = await getDomainLocale(domainId).catch(() => ({ countryCode: '' }));

  return res.status(200).json({
    wordpressConnected: !!conn,
    siteUrl: conn?.site_url || null,
    country: (countryCode || 'US').toUpperCase(),
    events: (Array.isArray(rows) ? rows : []).map(mapAutomationEvent),
  });
}

async function createEvents(
  req: NextApiRequest,
  res: NextApiResponse,
  domainId: number,
  workspaceId: number,
  userId: string | null,
) {
  const body = (req.body || {}) as Record<string, unknown>;
  const scheduledDate = typeof body.scheduledDate === 'string' ? body.scheduledDate : '';
  const keywords = normalizeKeywords(body.keywords);
  const publishMode = parsePublishMode(body.publishMode);
  const timeZone = normalizeTimeZone(body.timeZone);

  if (!DATE_RE.test(scheduledDate)) return res.status(400).json({ error: 'scheduledDate must be YYYY-MM-DD' });
  if (keywords.length === 0) return res.status(400).json({ error: 'At least one keyword is required' });
  if (!publishMode) return res.status(400).json({ error: 'publishMode must be draft or live' });

  // WordPress is only needed to publish. Draft-intent events schedule without it; a live
  // one must have somewhere to publish to on the scheduled day.
  if (publishMode === 'live' && !(await getConnectionForWorkspace(workspaceId))) {
    return res.status(400).json({
      error: 'wordpress_not_connected',
      message: 'Connect WordPress in Settings before scheduling a live publish.',
    });
  }

  try {
    // Only scheduled here — no article, no quota. The automations cron creates each draft,
    // lets the LLM title and write it, and publishes on the day (billing a document then).
    // The keyword doubles as the event title until the article exists.
    const isPg = !!process.env.DATABASE_URL;
    const ids: number[] = [];
    await db.transaction(async (tx) => {
      for (const keyword of keywords) {
        const replacements = [domainId, workspaceId, scheduledDate, timeZone, keyword, keyword, publishMode, userId];
        if (isPg) {
          // eslint-disable-next-line no-await-in-loop
          const r = await db.query<{ id: number }>(
            `INSERT INTO automation_events
               (domain_id, workspace_id, scheduled_date, time_zone, title, target_keyword, publish_mode, article_id, status, created_by, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'scheduled', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             RETURNING id`,
            { replacements, type: QueryTypes.SELECT, transaction: tx },
          );
          if (r[0]?.id != null) ids.push(r[0].id);
        } else {
          // eslint-disable-next-line no-await-in-loop
          const [newId] = await db.query(
            `INSERT INTO automation_events
               (domain_id, workspace_id, scheduled_date, time_zone, title, target_keyword, publish_mode, article_id, status, created_by, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'scheduled', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            { replacements, type: QueryTypes.INSERT, transaction: tx },
          );
          ids.push(newId as unknown as number);
        }
      }
    });
    if (ids.length === 0) return res.status(500).json({ error: 'Events created but not found' });

    const rows = await db.query<AutomationEventRow>(
      `SELECT id, domain_id, workspace_id, scheduled_date, title, target_keyword,
              publish_mode, article_id, status, created_at
       FROM automation_events WHERE id IN (${ids.map(() => '?').join(', ')})
       ORDER BY id ASC`,
      { replacements: ids, type: QueryTypes.SELECT },
    );
    return res.status(200).json({ events: (Array.isArray(rows) ? rows : []).map(mapAutomationEvent) });
  } catch (error) {
    return res.status(500).json({ error: getErrorMessage(error) || 'DB error' });
  }
}

export default withOrgPaymentAccess(handler);
