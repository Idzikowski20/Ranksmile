import type { ComparePeriod, RankAnalyticsSummary, RankTrackingRow } from '../types/rankTracking';
import { buildRankResultsPage } from './results';
import type { RankTrackingConfigRow } from '../types/rankTracking';
import { ANALYTICS_VERSION } from './constants';
import {
  activeRankDevice,
  exclusiveVisibilityPercents,
  pickDeviceResult,
  summarizeExclusiveBuckets,
  summarizeUiBuckets,
} from './buckets';
import {
  getLatestSummary,
  listSummaryChartPoints,
  summaryRowToAnalytics,
} from './summaryStore';

function primaryDelta(row: RankTrackingRow, device: 'desktop' | 'mobile'): number {
  const r = pickDeviceResult(row, device);
  if (r.position == null || r.previousPosition == null) return 0;
  return r.previousPosition - r.position;
}

/** Live compute — temporary fallback until backfill; remove after summaries exist. */
export async function buildAnalyticsSummaryLive(
  config: RankTrackingConfigRow,
  comparePeriod: ComparePeriod,
  activeDevice: 'desktop' | 'mobile' = activeRankDevice(config),
): Promise<RankAnalyticsSummary> {
  const { rows } = await buildRankResultsPage({
    config,
    comparePeriod,
    pageSize: 10000,
    activeDevice,
  });

  const withDelta = rows.map((r) => ({
    row: r,
    delta: primaryDelta(r, activeDevice),
    dev: pickDeviceResult(r, activeDevice),
  }));

  const ranked = withDelta.filter((x) => x.dev.found && x.dev.position != null);
  const avg = ranked.length
    ? Math.round(ranked.reduce((s, x) => s + (x.dev.position as number), 0) / ranked.length)
    : null;

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

  const bucketCounts = summarizeExclusiveBuckets(withDelta.map((x) => x.dev));
  const uiBuckets = summarizeUiBuckets(withDelta.map((x) => x.dev));
  const total = withDelta.length || 1;

  return {
    topGainers: [...withDelta]
      .filter((x) => x.delta > 0)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 10)
      .map((x) => ({
        keyword: x.row.keyword,
        trackingKeywordId: x.row.trackingKeywordId,
        delta: x.delta,
        position: x.dev.position,
      })),
    topLosers: [...withDelta]
      .filter((x) => x.delta < 0)
      .sort((a, b) => a.delta - b.delta)
      .slice(0, 10)
      .map((x) => ({
        keyword: x.row.keyword,
        trackingKeywordId: x.row.trackingKeywordId,
        delta: x.delta,
        position: x.dev.position,
      })),
    newlyRanked: withDelta
      .filter((x) => x.dev.found && (x.dev.previousPosition == null))
      .slice(0, 10)
      .map((x) => ({
        keyword: x.row.keyword,
        trackingKeywordId: x.row.trackingKeywordId,
        position: x.dev.position,
      })),
    lostRankings: withDelta
      .filter((x) => !x.dev.found && x.dev.previousPosition != null)
      .slice(0, 10)
      .map((x) => ({
        keyword: x.row.keyword,
        trackingKeywordId: x.row.trackingKeywordId,
        previousPosition: x.dev.previousPosition,
      })),
    averagePosition: avg,
    previousAveragePosition: null,
    movedUp,
    movedDown,
    unchanged,
    buckets: uiBuckets,
    previousBuckets: { top3: 0, top10: 0, top100: 0, notRanking: 0 },
    visibilityScore: exclusiveVisibilityPercents(bucketCounts, total),
    analyticsVersion: ANALYTICS_VERSION,
    runId: null,
    previousRunId: null,
    fromSummary: false,
  };
}

export async function buildAnalyticsSummary(
  config: RankTrackingConfigRow,
  comparePeriod: ComparePeriod,
  activeDevice: 'desktop' | 'mobile' = activeRankDevice(config),
): Promise<RankAnalyticsSummary> {
  const stored = await getLatestSummary(config.id);
  if (stored) return summaryRowToAnalytics(stored);

  // Temporary compute-on-read fallback
  return buildAnalyticsSummaryLive(config, comparePeriod, activeDevice);
}

export { listSummaryChartPoints };
