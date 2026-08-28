import { queryRows } from '../db/query';
import type { ComparePeriod, RankDevice, RankSnapshotRow } from '../types/rankTracking';

function comparePeriodDays(period: ComparePeriod): number {
  if (period === '1d') return 1;
  if (period === '2d') return 2;
  if (period === '7d') return 7;
  if (period === '30d') return 30;
  if (period === '60d') return 60;
  return 90;
}

// Everything except raw_items (full SERP payload) — list views never read it, and it
// dominates row size, so SELECT * here multiplied transfer for nothing.
const SNAPSHOT_COLS = 'id, config_id, run_id, tracking_keyword_id, device, found, position, '
  + 'ranking_url, ranking_title, ranking_description, ranking_domain, serp_features, '
  + 'provider, provider_version, provider_response_hash, checked_at';

/** One windowed query instead of 2N round trips (works on Postgres and SQLite 3.25+). */
async function latestPerKeywordDevice(
  configId: number,
  keywordIds: number[],
  beforeIso?: string,
): Promise<Map<string, RankSnapshotRow>> {
  const out = new Map<string, RankSnapshotRow>();
  if (!keywordIds.length) return out;

  const placeholders = keywordIds.map(() => '?').join(',');
  const rows = await queryRows<RankSnapshotRow>(
    `SELECT ${SNAPSHOT_COLS} FROM (
       SELECT *, ROW_NUMBER() OVER (
         PARTITION BY tracking_keyword_id, device ORDER BY checked_at DESC) AS rn
       FROM rank_snapshots
       WHERE config_id = ? AND tracking_keyword_id IN (${placeholders})${beforeIso ? ' AND checked_at < ?' : ''}
     ) t WHERE rn = 1`,
    beforeIso ? [configId, ...keywordIds, beforeIso] : [configId, ...keywordIds],
  );
  for (const r of rows) out.set(`${r.tracking_keyword_id}:${r.device}`, r);
  return out;
}

export async function getLatestSnapshots(
  configId: number,
  keywordIds: number[],
): Promise<Map<string, RankSnapshotRow>> {
  return latestPerKeywordDevice(configId, keywordIds);
}

export async function getSnapshotsBeforeDate(
  configId: number,
  keywordIds: number[],
  beforeIso: string,
): Promise<Map<string, RankSnapshotRow>> {
  return latestPerKeywordDevice(configId, keywordIds, beforeIso);
}

export function baselineDate(comparePeriod: ComparePeriod): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - comparePeriodDays(comparePeriod));
  return d.toISOString();
}

export async function getKeywordHistory(
  configId: number,
  trackingKeywordId: number,
  device: RankDevice,
  limit = 365,
): Promise<RankSnapshotRow[]> {
  return queryRows<RankSnapshotRow>(
    `SELECT ${SNAPSHOT_COLS} FROM rank_snapshots
     WHERE config_id = ? AND tracking_keyword_id = ? AND device = ?
     ORDER BY checked_at ASC LIMIT ?`,
    [configId, trackingKeywordId, device, limit],
  );
}

export async function getHistorySummaryForConfig(
  configId: number,
  keywordIds: number[],
): Promise<Array<{ trackingKeywordId: number; device: RankDevice; min: number | null; max: number | null; avg: number | null; points: Array<{ date: string; position: number | null; found: boolean }> }>> {
  const summaries: Array<{ trackingKeywordId: number; device: RankDevice; min: number | null; max: number | null; avg: number | null; points: Array<{ date: string; position: number | null; found: boolean }> }> = [];

  if (!keywordIds.length) return summaries;

  const placeholders = keywordIds.map(() => '?').join(',');
  const all = await queryRows<Pick<RankSnapshotRow, 'tracking_keyword_id' | 'device' | 'checked_at' | 'position' | 'found'>>(
    `SELECT tracking_keyword_id, device, checked_at, position, found FROM (
       SELECT tracking_keyword_id, device, checked_at, position, found, ROW_NUMBER() OVER (
         PARTITION BY tracking_keyword_id, device ORDER BY checked_at ASC) AS rn
       FROM rank_snapshots
       WHERE config_id = ? AND tracking_keyword_id IN (${placeholders})
     ) t WHERE rn <= 90 ORDER BY tracking_keyword_id, device, checked_at ASC`,
    [configId, ...keywordIds],
  );
  const grouped = new Map<string, typeof all>();
  for (const r of all) {
    const key = `${r.tracking_keyword_id}:${r.device}`;
    const list = grouped.get(key) ?? [];
    list.push(r);
    grouped.set(key, list);
  }

  for (const kid of keywordIds) {
    for (const device of ['desktop', 'mobile'] as RankDevice[]) {
      const rows = grouped.get(`${kid}:${device}`) ?? [];
      const positions = rows.filter((r) => r.found && r.position != null).map((r) => r.position as number);
      summaries.push({
        trackingKeywordId: kid,
        device,
        min: positions.length ? Math.min(...positions) : null,
        max: positions.length ? Math.max(...positions) : null,
        avg: positions.length ? Math.round(positions.reduce((a, b) => a + b, 0) / positions.length) : null,
        points: rows.map((r) => ({
          date: r.checked_at,
          position: r.position,
          found: !!r.found,
        })),
      });
    }
  }
  return summaries;
}
