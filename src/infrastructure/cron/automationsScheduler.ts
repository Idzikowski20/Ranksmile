/**
 * Automations scheduler — the cron that makes scheduled content-calendar events real.
 *
 * A tick does two things:
 *   START    each due `scheduled` event: bill a document, create a keyword-mode draft, set
 *            its title, kick deep-analysis, and move the event to `generating`. The app's
 *            existing article pipeline (deep-analysis → autopilot sweep → generate) fills
 *            the draft with content — automations piggyback on that engine rather than
 *            re-implement it.
 *   FINALIZE each `generating` event once its article has content: publish to WordPress for
 *            a `live` event (→ published), otherwise leave the draft ready (→ created). A
 *            failed/stalled analysis marks the event `failed`.
 *
 * Nothing here runs until the cron endpoint calls it, so the create request stays instant.
 */
import { QueryTypes } from 'sequelize';
import db from '@/database/database';
import { ensureAutomationTables } from '@/src/infrastructure/persistence/schema/ensureAutomationTables';
import { createAutopilotDraft, triggerAutopilotAnalysis } from '@/src/infrastructure/cron/autopilot';
import { getConnectionForWorkspace } from '@/src/infrastructure/wordpress/wpConnection';
import { publishToWordPress } from '@/src/infrastructure/wordpress/wordpressPublish';
import { getArticleIdSql } from '@/src/infrastructure/articles/articleSql';
import { finalizeAction, type GenerationState } from '@/src/core/domain/automations/schedule';
import { getErrorMessage } from '@/src/core/shared/errors';

const isPg = !!process.env.DATABASE_URL;
/** A `generating` event whose analysis has not progressed for this long is considered dead. */
const STALE_ANALYSIS_MINUTES = 45;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

async function rows<T extends object>(sql: string, repl: unknown[]): Promise<T[]> {
  const r = await db.query<T>(sql, { replacements: repl, type: QueryTypes.SELECT });
  return (Array.isArray(r) ? r : []) as unknown as T[];
}

async function setStatus(eventId: number, status: string, from: string): Promise<void> {
  await db.query(
    'UPDATE automation_events SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = ?',
    { replacements: [status, eventId, from] },
  );
}

type DueRow = { id: number; domain_id: number; workspace_id: number; title: string; target_keyword: string; publish_mode: string };

type GenRow = {
  id: number; workspace_id: number; publish_mode: string; article_id: number | null;
  content: string | null; article_title: string | null; meta_title: string | null;
  analysis_status: string | null; analysis_stale: number | boolean | null;
};

export type AutomationsSweepResult = { started: number[]; created: number[]; published: number[]; failed: number[]; waiting: number };

/** Move a due `scheduled` event into `generating`: bill, create the draft, kick analysis. */
async function startEvent(row: DueRow, args: TriggerArgs): Promise<'started' | 'failed'> {
  const keyword = (row.target_keyword || row.title).trim();
  try {
    const { getOrgIdForDomain, ensureOrgQuotaBalances, adjustActiveUsage } = await import('@/src/infrastructure/quota/index');
    const orgId = await getOrgIdForDomain(row.domain_id);
    if (!orgId) throw new Error('Domain has no organization');
    await ensureOrgQuotaBalances(orgId);
    await adjustActiveUsage({
      orgId,
      meter: 'documents',
      delta: 1,
      idempotencyKey: `auto-doc:${orgId}:${row.id}`,
      ref: { type: 'article', id: `auto-${row.id}` },
      userId: null,
    });

    // Same path as a user's new article, minus the interactive steps: the draft carries only
    // the keyword; generate writes the brief and the LLM picks the title (job-progress stores
    // the article's H1 as its title).
    const articleId = await createAutopilotDraft(row.domain_id, keyword);
    // Claim the event before the (fire-and-forget) analysis so a second worker cannot double-start it.
    await db.query(
      'UPDATE automation_events SET status = \'generating\', article_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = \'scheduled\'',
      { replacements: [articleId, row.id] },
    );
    await triggerAutopilotAnalysis(args, { articleId, domainId: row.domain_id, keyword });
    return 'started';
  } catch (err) {
    await setStatus(row.id, 'failed', 'scheduled').catch(() => {});
    await db.query('UPDATE automation_events SET status = \'failed\' WHERE id = ? AND status = \'generating\'', { replacements: [row.id] }).catch(() => {});
    console.error('[automations] start failed:', row.id, getErrorMessage(err));
    return 'failed';
  }
}

/** Finalize a `generating` event whose article is ready (or whose analysis died). */
async function finalizeEvent(row: GenRow): Promise<'created' | 'published' | 'failed' | 'waiting'> {
  const hasContent = !!row.content && row.content.trim().length > 0;
  let generation: GenerationState = 'pending';
  if (hasContent) generation = 'done';
  else if (row.analysis_status === 'failed' || Number(row.analysis_stale) === 1) generation = 'failed';

  const publishMode = row.publish_mode === 'live' ? 'live' : 'draft';
  const action = finalizeAction(publishMode, generation, hasContent);

  if (action === 'wait') return 'waiting';
  if (action === 'fail') { await setStatus(row.id, 'failed', 'generating'); return 'failed'; }

  if (action === 'publish' && row.article_id != null) {
    const conn = await getConnectionForWorkspace(row.workspace_id);
    if (!conn) { await setStatus(row.id, 'created', 'generating'); return 'created'; }
    try {
      const result = await publishToWordPress({
        wpUrl: conn.site_url,
        apiKey: conn.api_key,
        title: row.meta_title || row.article_title || '',
        content: row.content || '',
        status: 'publish',
      });
      const articleIdSql = await getArticleIdSql();
      await db.query(
        `UPDATE articles SET status = 'published', publish_target = 'wordpress', publish_url = ?, updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
        { replacements: [result.link, row.article_id] },
      );
      await setStatus(row.id, 'published', 'generating');
      return 'published';
    } catch (err) {
      console.error('[automations] publish failed:', row.id, getErrorMessage(err));
      await setStatus(row.id, 'failed', 'generating');
      return 'failed';
    }
  }

  await setStatus(row.id, 'created', 'generating');
  return 'created';
}

type TriggerArgs = { baseUrl: string; cronSecret: string };

export async function runAutomationsSweep(args: TriggerArgs & { limit?: number }): Promise<AutomationsSweepResult> {
  await ensureAutomationTables();
  const limit = args.limit ?? 20;
  const result: AutomationsSweepResult = { started: [], created: [], published: [], failed: [], waiting: 0 };
  const today = todayKey();

  const due = await rows<DueRow>(
    `SELECT id, domain_id, workspace_id, title, target_keyword, publish_mode
       FROM automation_events
      WHERE status = 'scheduled' AND scheduled_date <= ?
      ORDER BY scheduled_date ASC, id ASC LIMIT ?`,
    [today, limit],
  );
  for (const row of due) {
    // eslint-disable-next-line no-await-in-loop
    const outcome = await startEvent(row, args);
    if (outcome === 'started') result.started.push(row.id);
    else result.failed.push(row.id);
  }

  const articleIdSql = await getArticleIdSql();
  const stalePredicate = isPg
    ? `j.updated_at < NOW() - INTERVAL '${STALE_ANALYSIS_MINUTES} minutes'`
    : `j.updated_at < datetime('now', '-${STALE_ANALYSIS_MINUTES} minutes')`;
  const generating = await rows<GenRow>(
    `SELECT e.id, e.workspace_id, e.publish_mode, e.article_id,
            a.content AS content, a.title AS article_title, a.meta_title AS meta_title,
            j.status AS analysis_status,
            CASE WHEN j.updated_at IS NOT NULL AND ${stalePredicate} THEN 1 ELSE 0 END AS analysis_stale
       FROM automation_events e
       LEFT JOIN articles a ON a.${articleIdSql} = e.article_id
       LEFT JOIN analysis_jobs j ON j.article_id = e.article_id AND j.job_type = 'deep_analysis'
            AND j.created_at = (SELECT MAX(l.created_at) FROM analysis_jobs l WHERE l.article_id = e.article_id AND l.job_type = 'deep_analysis')
      WHERE e.status = 'generating'
      ORDER BY e.id ASC LIMIT ?`,
    [limit],
  );
  for (const row of generating) {
    // eslint-disable-next-line no-await-in-loop
    const outcome = await finalizeEvent(row);
    if (outcome === 'created') result.created.push(row.id);
    else if (outcome === 'published') result.published.push(row.id);
    else if (outcome === 'failed') result.failed.push(row.id);
    else result.waiting += 1;
  }

  return result;
}
