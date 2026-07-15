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

export async function getLatestSnapshots(
  configId: number,
  keywordIds: number[],
): Promise<Map<string, RankSnapshotRow>> {
  const out = new Map<string, RankSnapshotRow>();
  if (!keywordIds.length) return out;

  for (const kid of keywordIds) {
    for (const device of ['desktop', 'mobile'] as RankDevice[]) {
      const row = await queryRows<RankSnapshotRow>(
        `SELECT * FROM rank_snapshots
         WHERE config_id = ? AND tracking_keyword_id = ? AND device = ?
         ORDER BY checked_at DESC LIMIT 1`,
        [configId, kid, device],
      );
      if (row[0]) out.set(`${kid}:${device}`, row[0]);
    }
  }
  return out;
}

export async function getSnapshotsBeforeDate(
  configId: number,
  keywordIds: number[],
  beforeIso: string,
): Promise<Map<string, RankSnapshotRow>> {
  const out = new Map<string, RankSnapshotRow>();
  if (!keywordIds.length) return out;

  for (const kid of keywordIds) {
    for (const device of ['desktop', 'mobile'] as RankDevice[]) {
      const row = await queryRows<RankSnapshotRow>(
        `SELECT * FROM rank_snapshots
         WHERE config_id = ? AND tracking_keyword_id = ? AND device = ? AND checked_at < ?
         ORDER BY checked_at DESC LIMIT 1`,
        [configId, kid, device, beforeIso],
      );
      if (row[0]) out.set(`${kid}:${device}`, row[0]);
    }
  }
  return out;
}

export function baselineDate(comparePeriod: ComparePeriod): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - comparePeriodDays(comparePeriod));
  return d.toISOString();
}

export async function getKeywordHistory(
  trackingKeywordId: number,
  device: RankDevice,
  limit = 365,
): Promise<RankSnapshotRow[]> {
  return queryRows<RankSnapshotRow>(
    `SELECT * FROM rank_snapshots
     WHERE tracking_keyword_id = ? AND device = ?
     ORDER BY checked_at ASC LIMIT ?`,
    [trackingKeywordId, device, limit],
  );
}

export async function getHistorySummaryForConfig(
  configId: number,
  keywordIds: number[],
): Promise<Array<{ trackingKeywordId: number; device: RankDevice; min: number | null; max: number | null; avg: number | null; points: Array<{ date: string; position: number | null; found: boolean }> }>> {
  const summaries: Array<{ trackingKeywordId: number; device: RankDevice; min: number | null; max: number | null; avg: number | null; points: Array<{ date: string; position: number | null; found: boolean }> }> = [];

  for (const kid of keywordIds) {
    for (const device of ['desktop', 'mobile'] as RankDevice[]) {
      const rows = await getKeywordHistory(kid, device, 90);
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
