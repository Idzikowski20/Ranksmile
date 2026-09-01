/**
 * WIE Performance Loop — sync GSC 30d page metrics → Outcome Learning.
 */
import { queryOne, queryRows } from '../db/query';
import { getArticleIdSql } from '../articleSql';
import { readLocalSCData } from '../../utils/searchConsole';
import {
  applyOutcomeLearning,
  readWieLastRun,
  type OutcomeMetrics,
} from './outcomeLearning';
import {
  aggregateGscPageMetrics,
  type PageGscMetrics,
} from './gscPageMetrics';

export type { PageGscMetrics };
export { aggregateGscPageMetrics };

export type GscOutcomeSyncResult = {
  articleId: number;
  ok: boolean;
  reason?: string;
  metrics?: OutcomeMetrics;
  page?: PageGscMetrics;
  outcome?: Awaited<ReturnType<typeof applyOutcomeLearning>>;
};

export async function syncArticleOutcomeFromGsc(articleId: number): Promise<GscOutcomeSyncResult> {
  const idSql = await getArticleIdSql();
  const row = await queryOne<{
    id: number;
    domain_id: number | null;
    meta_url: string | null;
    publish_url: string | null;
  }>(
    `SELECT ${idSql} AS id, domain_id, meta_url, publish_url FROM articles WHERE ${idSql} = ? LIMIT 1`,
    [articleId],
  );

  if (!row) return { articleId, ok: false, reason: 'article_not_found' };

  const pageUrl = (row.publish_url || row.meta_url || '').trim();
  if (!pageUrl) return { articleId, ok: false, reason: 'no_publish_url' };

  const lastRun = await readWieLastRun(articleId);
  if (!lastRun?.patternIds?.length) {
    return { articleId, ok: false, reason: 'no_wie_last_run' };
  }

  if (row.domain_id == null) return { articleId, ok: false, reason: 'no_domain' };

  const domainRow = await queryOne<{ domain: string }>(
    `SELECT domain FROM domain WHERE "ID" = ? LIMIT 1`,
    [row.domain_id],
  );
  if (!domainRow?.domain) return { articleId, ok: false, reason: 'domain_not_found' };

  const sc = await readLocalSCData(domainRow.domain);
  if (!sc || !Array.isArray(sc.thirtyDays) || sc.thirtyDays.length === 0) {
    return { articleId, ok: false, reason: 'no_gsc_cache' };
  }

  const page = aggregateGscPageMetrics(sc.thirtyDays, pageUrl);
  if (!page) return { articleId, ok: false, reason: 'page_not_in_gsc' };

  const metrics: OutcomeMetrics = {
    clicks: page.clicks,
    impressions: page.impressions,
    ctr: page.ctr,
    position: page.position,
    windowDays: 30,
  };

  const outcome = await applyOutcomeLearning({
    articleId,
    metrics,
    patternIds: lastRun.patternIds,
  });

  return { articleId, ok: true, metrics, page, outcome };
}

/**
 * Cron helper: sync articles that have a WIE last run + publish URL.
 * Caps batch size to keep daily cron bounded.
 */
export async function syncDueWieOutcomesFromGsc(opts?: {
  limit?: number;
}): Promise<{ scanned: number; synced: number; skipped: number; results: GscOutcomeSyncResult[] }> {
  const limit = Math.min(50, Math.max(1, opts?.limit ?? 25));
  const idSql = await getArticleIdSql();

  const articles = await queryRows<{
    id: number;
    domain_id: number | null;
    meta_url: string | null;
    publish_url: string | null;
  }>(
    `SELECT ${idSql} AS id, domain_id, meta_url, publish_url
     FROM articles
     WHERE (publish_url IS NOT NULL AND publish_url <> '')
        OR (meta_url IS NOT NULL AND meta_url <> '')
     ORDER BY updated_at DESC
     LIMIT ?`,
    [limit * 4],
  );

  const results: GscOutcomeSyncResult[] = [];
  let synced = 0;
  let skipped = 0;
  let scanned = 0;

  for (const a of articles) {
    if (synced >= limit) break;
    scanned += 1;
    const run = await readWieLastRun(a.id);
    if (!run?.patternIds?.length) {
      skipped += 1;
      continue;
    }
    const r = await syncArticleOutcomeFromGsc(a.id);
    results.push(r);
    if (r.ok) synced += 1;
    else skipped += 1;
  }

  return { scanned, synced, skipped, results };
}
