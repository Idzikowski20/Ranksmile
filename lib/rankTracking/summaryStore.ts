import type { Transaction } from 'sequelize';
import db from '../../database/database';
import { queryOne, queryRows } from '../db/query';
import type {
  RankAnalyticsSummary,
  RankCheckRunRow,
  RankSummaryChartPoint,
  RankTrackingConfigRow,
  RankTrackingSummaryRow,
} from '../types/rankTracking';
import { ANALYTICS_VERSION } from './constants';
import {
  activeRankDevice,
  exclusiveVisibilityPercents,
  pickDeviceResult,
  summarizeExclusiveBuckets,
  summarizeUiBuckets,
} from './buckets';
import { buildRankResultsPage } from './results';

const isPg = !!process.env.DATABASE_URL;

function parseVisibility(raw: unknown): RankTrackingSummaryRow['visibility'] {
  if (!raw) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    return {
      top3: Number(o.top3 ?? 0),
      top10: Number(o.top10 ?? 0),
      top20: Number(o.top20 ?? 0),
      notRanking: Number(o.notRanking ?? 0),
    };
  }
  if (typeof raw === 'string') {
    try {
      return parseVisibility(JSON.parse(raw) as unknown);
    } catch {
      return null;
    }
  }
  return null;
}

function mapSummaryRow(row: RankTrackingSummaryRow & { visibility?: unknown }): RankTrackingSummaryRow {
  return {
    ...row,
    visibility: parseVisibility(row.visibility),
  };
}

export async function getSummaryForRun(
  configId: number,
  runId: number,
): Promise<RankTrackingSummaryRow | undefined> {
  const row = await queryOne<RankTrackingSummaryRow>(
    'SELECT * FROM rank_tracking_summary WHERE config_id = ? AND run_id = ? LIMIT 1',
    [configId, runId],
  );
  return row ? mapSummaryRow(row) : undefined;
}

export async function getLatestSummary(configId: number): Promise<RankTrackingSummaryRow | undefined> {
  const row = await queryOne<RankTrackingSummaryRow>(
    `SELECT s.* FROM rank_tracking_summary s
     INNER JOIN rank_check_runs r ON r.id = s.run_id
     WHERE s.config_id = ? AND r.status = 'completed'
     ORDER BY s.run_id DESC LIMIT 1`,
    [configId],
  );
  return row ? mapSummaryRow(row) : undefined;
}

export async function listSummaryChartPoints(
  configId: number,
  limit = 90,
): Promise<RankSummaryChartPoint[]> {
  const rows = await queryRows<{
    run_id: number;
    avg_position: number | null;
    finished_at: string | null;
  }>(
    `SELECT s.run_id, s.avg_position, r.finished_at
     FROM rank_tracking_summary s
     INNER JOIN rank_check_runs r ON r.id = s.run_id
     WHERE s.config_id = ? AND r.status = 'completed'
     ORDER BY s.run_id ASC
     LIMIT ?`,
    [configId, limit],
  );
  return rows.map((r) => ({
    runId: r.run_id,
    finishedAt: r.finished_at,
    avgPosition: r.avg_position,
  }));
}

export async function getPreviousCompletedRun(
  configId: number,
  beforeRunId: number,
): Promise<RankCheckRunRow | undefined> {
  return queryOne<RankCheckRunRow>(
    `SELECT * FROM rank_check_runs
     WHERE config_id = ? AND status = 'completed' AND id < ?
     ORDER BY id DESC LIMIT 1`,
    [configId, beforeRunId],
  );
}

/** Compute summary payload from live results (for write + backfill + fallback). */
export async function computeSummaryPayload(
  config: RankTrackingConfigRow,
  runId: number,
  previousRunId: number | null,
): Promise<Omit<RankTrackingSummaryRow, 'id' | 'updated_at'>> {
  const device = activeRankDevice(config);
  const { rows } = await buildRankResultsPage({
    config,
    comparePeriod: '7d',
    pageSize: 10000,
    activeDevice: device,
  });

  const withDelta = rows.map((r) => {
    const dev = pickDeviceResult(r, device);
    const delta =
      dev.position != null && dev.previousPosition != null
        ? dev.previousPosition - dev.position
        : 0;
    return { row: r, delta, dev };
  });

  let movedUp = 0;
  let movedDown = 0;
  let unchanged = 0;
  for (const x of withDelta) {
    if (x.dev.position == null || x.dev.previousPosition == null) {
      unchanged += 1;
      continue;
    }
    if (x.delta > 0) movedUp += 1;
    else if (x.delta < 0) movedDown += 1;
    else unchanged += 1;
  }

  const ranked = withDelta.filter((x) => x.dev.found && x.dev.position != null);
  const avg = ranked.length
    ? Math.round(ranked.reduce((s, x) => s + (x.dev.position as number), 0) / ranked.length)
    : null;

  const uiBuckets = summarizeUiBuckets(withDelta.map((x) => x.dev));
  const exclusive = summarizeExclusiveBuckets(withDelta.map((x) => x.dev));
  const visibility = exclusiveVisibilityPercents(exclusive, withDelta.length || 1);

  // Previous buckets from previous summary if present
  let prevBuckets = { top3: 0, top10: 0, top100: 0, notRanking: 0 };
  let previousAvg: number | null = null;
  if (previousRunId) {
    const prev = await getSummaryForRun(config.id, previousRunId);
    if (prev) {
      previousAvg = prev.avg_position;
      prevBuckets = {
        top3: prev.bucket_top3,
        top10: prev.bucket_top10,
        top100: prev.bucket_top100,
        notRanking: prev.bucket_not_ranking,
      };
    }
  }

  return {
    config_id: config.id,
    run_id: runId,
    previous_run_id: previousRunId,
    analytics_version: ANALYTICS_VERSION,
    avg_position: avg,
    previous_avg_position: previousAvg,
    moved_up: movedUp,
    moved_down: movedDown,
    unchanged,
    bucket_top3: uiBuckets.top3,
    bucket_top10: uiBuckets.top10,
    bucket_top100: uiBuckets.top100,
    bucket_not_ranking: uiBuckets.notRanking,
    prev_bucket_top3: prevBuckets.top3,
    prev_bucket_top10: prevBuckets.top10,
    prev_bucket_top100: prevBuckets.top100,
    prev_bucket_not_ranking: prevBuckets.notRanking,
    visibility,
  };
}

export async function insertSummary(
  payload: Omit<RankTrackingSummaryRow, 'id' | 'updated_at'>,
  transaction?: Transaction,
): Promise<void> {
  const visJson = JSON.stringify(payload.visibility ?? {});
  const sql = `INSERT INTO rank_tracking_summary (
    config_id, run_id, previous_run_id, analytics_version,
    avg_position, previous_avg_position,
    moved_up, moved_down, unchanged,
    bucket_top3, bucket_top10, bucket_top100, bucket_not_ranking,
    prev_bucket_top3, prev_bucket_top10, prev_bucket_top100, prev_bucket_not_ranking,
    visibility, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${isPg ? '?::jsonb' : '?'}, CURRENT_TIMESTAMP)`;
  const replacements = [
    payload.config_id, payload.run_id, payload.previous_run_id, payload.analytics_version,
    payload.avg_position, payload.previous_avg_position,
    payload.moved_up, payload.moved_down, payload.unchanged,
    payload.bucket_top3, payload.bucket_top10, payload.bucket_top100, payload.bucket_not_ranking,
    payload.prev_bucket_top3, payload.prev_bucket_top10, payload.prev_bucket_top100, payload.prev_bucket_not_ranking,
    visJson,
  ];
  await db.query(sql, { replacements, transaction });
}

/**
 * Atomically mark run completed + insert summary.
 * No summary if status is not completed.
 */
export async function completeRunWithSummary(input: {
  config: RankTrackingConfigRow;
  runId: number;
  keywordsChecked: number;
  keywordsSuccess: number;
  keywordsFailed: number;
  startedAt: string | null;
}): Promise<void> {
  const previous = await getPreviousCompletedRun(input.config.id, input.runId);
  const payload = await computeSummaryPayload(input.config, input.runId, previous?.id ?? null);
  const finishedAt = new Date().toISOString();
  const durationMs = input.startedAt
    ? Math.max(0, Date.now() - new Date(input.startedAt).getTime())
    : null;

  await db.transaction(async (transaction: Transaction) => {
    await db.query(
      `UPDATE rank_check_runs SET
         status = 'completed',
         keywords_checked = ?,
         keywords_success = ?,
         keywords_failed = ?,
         duration_ms = ?,
         finished_at = ?,
         last_error = NULL
       WHERE id = ?`,
      {
        replacements: [
          input.keywordsChecked,
          input.keywordsSuccess,
          input.keywordsFailed,
          durationMs,
          finishedAt,
          input.runId,
        ],
        transaction,
      },
    );
    try {
      await insertSummary(payload, transaction);
    } catch (e) {
      const m = String((e as { message?: string })?.message ?? e);
      if (!/unique|duplicate/i.test(m)) throw e;
    }
  });

  console.info('[rank-tracking] summary_created', JSON.stringify({
    configId: input.config.id,
    runId: input.runId,
    analyticsVersion: ANALYTICS_VERSION,
  }));
  console.info('[rank-tracking] tracking_run_completed', JSON.stringify({
    configId: input.config.id,
    runId: input.runId,
    success: input.keywordsSuccess,
    failed: input.keywordsFailed,
  }));
}

/** Idempotent backfill: skip if summary exists for completed run. */
export async function backfillSummariesForConfig(config: RankTrackingConfigRow): Promise<number> {
  const runs = await queryRows<RankCheckRunRow>(
    `SELECT * FROM rank_check_runs WHERE config_id = ? AND status = 'completed' ORDER BY id ASC`,
    [config.id],
  );
  let inserted = 0;
  for (const run of runs) {
    const existing = await getSummaryForRun(config.id, run.id);
    if (existing) continue;
    const previous = await getPreviousCompletedRun(config.id, run.id);
    const payload = await computeSummaryPayload(config, run.id, previous?.id ?? null);
    try {
      await insertSummary(payload);
      inserted += 1;
    } catch (e) {
      const m = String((e as { message?: string })?.message ?? e);
      if (!/unique|duplicate/i.test(m)) throw e;
    }
  }
  return inserted;
}

export function summaryRowToAnalytics(row: RankTrackingSummaryRow): RankAnalyticsSummary {
  return {
    topGainers: [],
    topLosers: [],
    newlyRanked: [],
    lostRankings: [],
    averagePosition: row.avg_position,
    previousAveragePosition: row.previous_avg_position,
    movedUp: row.moved_up,
    movedDown: row.moved_down,
    unchanged: row.unchanged,
    buckets: {
      top3: row.bucket_top3,
      top10: row.bucket_top10,
      top100: row.bucket_top100,
      notRanking: row.bucket_not_ranking,
    },
    previousBuckets: {
      top3: row.prev_bucket_top3,
      top10: row.prev_bucket_top10,
      top100: row.prev_bucket_top100,
      notRanking: row.prev_bucket_not_ranking,
    },
    visibilityScore: row.visibility ?? { top3: 0, top10: 0, top20: 0, notRanking: 0 },
    analyticsVersion: row.analytics_version,
    runId: row.run_id,
    previousRunId: row.previous_run_id,
    fromSummary: true,
  };
}
