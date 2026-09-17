/**
 * Automations scheduler — the cron that makes scheduled content-calendar events real.
 *
 * A tick does two things:
 *   START    each due `scheduled` event: claim it (→ generating), create and link a
 *            keyword-mode draft (one transaction), bill a document, and kick deep-analysis. The app's article
 *            pipeline (deep-analysis → autopilot sweep → generate) writes the draft and the
 *            LLM picks its title — automations piggyback on that engine.
 *   FINALIZE each `generating` event once its article has content: a `live` event is
 *            claimed (→ publishing) and pushed to WordPress (→ published); a draft-intent one
 *            is marked ready (→ created). A dead analysis marks the event `failed`.
 *
 * Every transition is a conditional UPDATE whose row count decides who proceeds, so two
 * overlapping sweeps never bill, draft or publish the same event twice.
 */
import { QueryTypes } from 'sequelize';
import db from '@/database/database';
import { ensureAutomationTables } from '@/src/infrastructure/persistence/schema/ensureAutomationTables';
import { createAutopilotDraft, discardAutopilotDraft, triggerAutopilotAnalysis } from '@/src/infrastructure/cron/autopilot';
import { affectedRows } from '@/src/infrastructure/cron/queueRunner';
import { getConnectionForWorkspace } from '@/src/infrastructure/wordpress/wpConnection';
import { publishToWordPress } from '@/src/infrastructure/wordpress/wordpressPublish';
import { getArticleIdSql } from '@/src/infrastructure/articles/articleSql';
import { collectAllowed, createBillingAccessCheck } from '@/src/infrastructure/billing/orgAccess';
import { dateKeyIn, finalizeAction, isDue, type GenerationState } from '@/src/core/domain/automations/schedule';
import { getErrorMessage } from '@/src/core/shared/errors';

const isPg = !!process.env.DATABASE_URL;
/**
 * A `generating` event with no progress for this long is dead: its analysis job stalled, or
 * no job ever appeared (the start crashed or the analysis request was never accepted).
 */
const STALE_MINUTES = 45;

async function rows<T extends object>(sql: string, repl: unknown[]): Promise<T[]> {
  const r = await db.query<T>(sql, { replacements: repl, type: QueryTypes.SELECT });
  return (Array.isArray(r) ? r : []) as unknown as T[];
}

/** Move the event from `from` to `status`; true only for the caller whose UPDATE moved it. */
async function transition(eventId: number, from: string, status: string, clearArticle = false): Promise<boolean> {
  const out = await db.query(
    `UPDATE automation_events SET status = ?, ${clearArticle ? 'article_id = NULL, ' : ''}updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = ?`,
    { replacements: [status, eventId, from] },
  );
  return affectedRows(out) > 0;
}

const chargeKey = (orgId: number, eventId: number) => `auto-doc:${orgId}:${eventId}`;

/**
 * Give back the document a scheduler-created draft was billed for (same key as a manual
 * delete). Only when the charge was recorded — it may have been rejected, or never reached.
 */
async function refundDocument(domainId: number, articleId: number, eventId: number): Promise<void> {
  const { getOrgIdForDomain, adjustActiveUsage } = await import('@/src/infrastructure/quota/index');
  const orgId = await getOrgIdForDomain(domainId);
  if (!orgId) return;
  const charged = await rows<{ one: number }>(
    'SELECT 1 AS one FROM usage_events WHERE idempotency_key = ? LIMIT 1',
    [chargeKey(orgId, eventId)],
  );
  if (charged.length === 0) return;
  await adjustActiveUsage({
    orgId,
    meter: 'documents',
    delta: -1,
    idempotencyKey: `doc-delete:${articleId}`,
    ref: { type: 'article', id: String(articleId) },
    userId: null,
  });
}

/** Remove a draft the pipeline never wrote into, and refund it. Best-effort. */
async function dropDraft(domainId: number, articleId: number, eventId: number): Promise<boolean> {
  // Refund only a draft that is really gone — one the pipeline picked up still counts.
  const removed = await discardAutopilotDraft(articleId).catch(() => false);
  if (removed) await refundDocument(domainId, articleId, eventId).catch(() => {});
  return removed;
}

/** The event was removed (or taken) before its draft could be linked. */
class EventGone extends Error {}

type DueRow = {
  id: number; domain_id: number; workspace_id: number; title: string; target_keyword: string; publish_mode: string;
  scheduled_date: string; time_zone: string | null;
};

type GenRow = {
  id: number; domain_id: number; workspace_id: number; publish_mode: string; article_id: number | null;
  content: string | null; article_title: string | null; meta_title: string | null;
  analysis_status: string | null; stale: number | boolean | null;
};

export type AutomationsSweepResult = {
  started: number[]; created: number[]; published: number[]; failed: number[]; waiting: number; skipped: number;
};

/** Start a due `scheduled` event: claim → draft → link → bill → analysis. */
async function startEvent(row: DueRow, args: TriggerArgs): Promise<'started' | 'failed' | 'skipped'> {
  // Claim first: only the sweep whose UPDATE moved the row goes on to draft and bill.
  if (!(await transition(row.id, 'scheduled', 'generating'))) return 'skipped';

  const keyword = (row.target_keyword || row.title).trim();
  let articleId: number | null = null;
  try {
    const { getOrgIdForDomain, ensureOrgQuotaBalances, adjustActiveUsage } = await import('@/src/infrastructure/quota/index');
    const orgId = await getOrgIdForDomain(row.domain_id);
    if (!orgId) throw new Error('Domain has no organization');
    await ensureOrgQuotaBalances(orgId);
    // Same path as a user's new article, minus the interactive steps: the draft carries only
    // the keyword; generate writes the brief and the LLM picks the title.
    // Created and linked in one transaction: a crash in between leaves neither, and a link
    // that finds the event gone (removed meanwhile) rolls the draft back.
    try {
      articleId = await db.transaction(async (transaction) => {
        const id = await createAutopilotDraft(row.domain_id, keyword, transaction);
        const linked = affectedRows(await db.query(
          `UPDATE automation_events SET article_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status = 'generating' AND article_id IS NULL`,
          { replacements: [id, row.id], transaction },
        )) > 0;
        if (!linked) throw new EventGone();
        return id;
      });
    } catch (err) {
      if (err instanceof EventGone) return 'skipped';
      throw err;
    }

    await adjustActiveUsage({
      orgId,
      meter: 'documents',
      delta: 1,
      idempotencyKey: chargeKey(orgId, row.id),
      ref: { type: 'article', id: String(articleId) },
      userId: null,
    });

    const accepted = await triggerAutopilotAnalysis(args, { articleId, domainId: row.domain_id, keyword });
    if (!accepted) {
      // No analysis job means nothing will ever write this draft — fail now, don't wait forever.
      await transition(row.id, 'generating', 'failed', true);
      await dropDraft(row.domain_id, articleId, row.id);
      return 'failed';
    }
    return 'started';
  } catch (err) {
    console.error('[automations] start failed:', row.id, getErrorMessage(err));
    await transition(row.id, 'generating', 'failed', true).catch(() => false);
    // A rejected charge (e.g. quota full) recorded nothing, so dropDraft refunds nothing.
    if (articleId != null) await dropDraft(row.domain_id, articleId, row.id);
    return 'failed';
  }
}

/** Finalize a `generating` event whose article is ready (or whose analysis died). */
async function finalizeEvent(row: GenRow): Promise<'created' | 'published' | 'failed' | 'waiting'> {
  const hasContent = !!row.content && row.content.trim().length > 0;
  let generation: GenerationState = 'pending';
  if (hasContent) generation = 'done';
  else if (row.analysis_status === 'failed' || Number(row.stale) === 1) generation = 'failed';

  const publishMode = row.publish_mode === 'live' ? 'live' : 'draft';
  const action = finalizeAction(publishMode, generation, hasContent);

  if (action === 'wait') return 'waiting';
  if (action === 'fail') {
    if (!(await transition(row.id, 'generating', 'failed'))) return 'waiting';
    if (row.article_id != null && !hasContent && (await dropDraft(row.domain_id, row.article_id, row.id))) {
      // The draft is gone — don't leave the event pointing at it.
      await db.query('UPDATE automation_events SET article_id = NULL WHERE id = ?', { replacements: [row.id] });
    }
    return 'failed';
  }

  if (action === 'publish' && row.article_id != null) {
    // Live intent survives a missing connection: the event waits until WordPress is reconnected.
    const conn = await getConnectionForWorkspace(row.workspace_id);
    if (!conn) return 'waiting';
    // Claim the publish: only one sweep creates the WordPress post. A crash after the post but
    // before the updates below leaves the event in `publishing`, which is never re-published.
    if (!(await transition(row.id, 'generating', 'publishing'))) return 'waiting';
    let link: string;
    try {
      const result = await publishToWordPress({
        wpUrl: conn.site_url,
        apiKey: conn.api_key,
        title: row.meta_title || row.article_title || '',
        content: row.content || '',
        status: 'publish',
      });
      link = result.link;
    } catch (err) {
      console.error('[automations] publish failed:', row.id, getErrorMessage(err));
      await transition(row.id, 'publishing', 'failed');
      return 'failed';
    }
    // The post is live now; a bookkeeping error must not record it as a failure (a retry
    // would duplicate it). The event stays `publishing` and the error is logged.
    try {
      const articleIdSql = await getArticleIdSql();
      await db.query(
        `UPDATE articles SET status = 'published', publish_target = 'wordpress', publish_url = ?, updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
        { replacements: [link, row.article_id] },
      );
      await transition(row.id, 'publishing', 'published');
    } catch (err) {
      console.error('[automations] published but not recorded:', row.id, link, getErrorMessage(err));
    }
    return 'published';
  }

  return (await transition(row.id, 'generating', 'created')) ? 'created' : 'waiting';
}

type TriggerArgs = { baseUrl: string; cronSecret: string };

export async function runAutomationsSweep(args: TriggerArgs & { limit?: number }): Promise<AutomationsSweepResult> {
  await ensureAutomationTables();
  const limit = args.limit ?? 20;
  const result: AutomationsSweepResult = { started: [], created: [], published: [], failed: [], waiting: 0, skipped: 0 };
  const now = new Date();
  // No zone is ahead of UTC by a full day, so UTC tomorrow bounds every candidate; each row is
  // then due by the calendar day in its own zone.
  const horizon = dateKeyIn(new Date(now.getTime() + 24 * 3600 * 1000), 'UTC');
  // Cron runs without a session, so the API billing gate never saw these orgs.
  const billing = createBillingAccessCheck();
  const due = await collectAllowed(
    (offset, pageSize) => rows<DueRow>(
      `SELECT id, domain_id, workspace_id, title, target_keyword, publish_mode, scheduled_date, time_zone
         FROM automation_events
        WHERE status = 'scheduled' AND scheduled_date <= ?
        ORDER BY scheduled_date ASC, id ASC LIMIT ? OFFSET ?`,
      [horizon, pageSize, offset],
    ),
    async (row) => {
      if (!isDue(row.scheduled_date, dateKeyIn(now, row.time_zone))) return false;
      if (await billing.forDomain(row.domain_id)) return true;
      result.skipped += 1;
      return false;
    },
    limit,
  );
  for (const row of due.rows) {
    // eslint-disable-next-line no-await-in-loop
    const outcome = await startEvent(row, args);
    if (outcome === 'started') result.started.push(row.id);
    else if (outcome === 'failed') result.failed.push(row.id);
    else result.skipped += 1;
  }

  const articleIdSql = await getArticleIdSql();
  const older = (col: string) => (isPg
    ? `${col} < NOW() - INTERVAL '${STALE_MINUTES} minutes'`
    : `datetime(${col}) < datetime('now', '-${STALE_MINUTES} minutes')`);
  const generating = await collectAllowed(
    (offset, pageSize) => rows<GenRow>(
      `SELECT e.id, e.domain_id, e.workspace_id, e.publish_mode, e.article_id,
              a.content AS content, a.title AS article_title, a.meta_title AS meta_title,
              j.status AS analysis_status,
              CASE WHEN (j.id IS NOT NULL AND ${older('j.updated_at')})
                     OR (j.id IS NULL AND ${older('e.updated_at')}) THEN 1 ELSE 0 END AS stale
         FROM automation_events e
         LEFT JOIN articles a ON a.${articleIdSql} = e.article_id
         LEFT JOIN analysis_jobs j ON j.article_id = e.article_id AND j.job_type = 'deep_analysis'
              AND j.created_at = (SELECT MAX(l.created_at) FROM analysis_jobs l WHERE l.article_id = e.article_id AND l.job_type = 'deep_analysis')
        WHERE e.status = 'generating'
        ORDER BY e.id ASC LIMIT ? OFFSET ?`,
      [pageSize, offset],
    ),
    (row) => billing.forDomain(row.domain_id),
    limit,
  );
  // Parked, not failed: finishing resumes once the org pays again.
  result.waiting += generating.denied;
  for (const row of generating.rows) {
    // eslint-disable-next-line no-await-in-loop
    const outcome = await finalizeEvent(row);
    if (outcome === 'created') result.created.push(row.id);
    else if (outcome === 'published') result.published.push(row.id);
    else if (outcome === 'failed') result.failed.push(row.id);
    else result.waiting += 1;
  }

  return result;
}
