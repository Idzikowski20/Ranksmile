import { queryOne, queryRows } from '../db/query';
import type {
  ComparePeriod,
  RankDevice,
  RankResultsPage,
  RankSnapshotRow,
  RankTrackingConfigRow,
  RankTrackingDeviceResult,
  RankTrackingKeywordRow,
  RankTrackingRow,
} from '../types/rankTracking';
import { devicesList, normalizeKeyword } from '../types/rankTracking';
import { metricsForKeyword, getLatestMetrics } from './keywordMetricsCache';
import { baselineDate, getLatestSnapshots, getSnapshotsBeforeDate } from './snapshotQueries';

function parseSerpFeatures(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string');
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw) as unknown;
      return Array.isArray(p) ? p.filter((x): x is string => typeof x === 'string') : [];
    } catch { return []; }
  }
  return [];
}

function snapshotToDeviceResult(
  current: RankSnapshotRow | undefined,
  previous: RankSnapshotRow | undefined,
): RankTrackingDeviceResult {
  return {
    position: current?.position ?? null,
    previousPosition: previous?.position ?? null,
    rankingUrl: current?.ranking_url ?? null,
    rankingTitle: current?.ranking_title ?? null,
    found: !!current?.found,
    serpFeatures: parseSerpFeatures(current?.serp_features),
    hasSnapshot: !!current,
  };
}

function emptyDevice(): RankTrackingDeviceResult {
  return {
    position: null,
    previousPosition: null,
    rankingUrl: null,
    rankingTitle: null,
    found: false,
    serpFeatures: [],
    hasSnapshot: false,
  };
}

export type ResultsQuery = {
  config: RankTrackingConfigRow;
  comparePeriod: ComparePeriod;
  search?: string;
  limit?: number;
  cursor?: string | null;
  page?: number;
  pageSize?: number;
  sort?: 'keyword' | 'position' | 'volume' | 'kd' | 'cpc';
  order?: 'asc' | 'desc';
  activeDevice?: RankDevice;
};

function encodeCursor(sortValue: string | number | null, id: number): string {
  return Buffer.from(JSON.stringify({ sortValue, id }), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): { sortValue: string | number | null; id: number } | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { sortValue: string | number | null; id: number };
    if (typeof parsed.id !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function buildRankResultsPage(query: ResultsQuery): Promise<RankResultsPage> {
  const keywords = await queryRows<RankTrackingKeywordRow>(
    `SELECT * FROM rank_tracking_keywords
     WHERE config_id = ? AND archived_at IS NULL
     ORDER BY keyword ASC`,
    [query.config.id],
  );

  let filtered = keywords;
  if (query.search?.trim()) {
    const q = query.search.trim().toLowerCase();
    filtered = keywords.filter((k) => k.keyword.toLowerCase().includes(q));
  }

  const metricKeys = filtered.map((k) => ({
    keyword: k.keyword,
    locationCode: query.config.location_code,
    languageCode: query.config.language_code,
  }));
  // Use cache only on list load — never block keyword UI on live DFS (balance/errors).
  const metricsMap = await getLatestMetrics(metricKeys);

  const keywordIds = filtered.map((k) => k.id);
  const latest = await getLatestSnapshots(query.config.id, keywordIds);
  const before = await getSnapshotsBeforeDate(query.config.id, keywordIds, baselineDate(query.comparePeriod));

  const deviceList = devicesList(query.config.devices);
  const primaryDevice = query.activeDevice ?? deviceList[0] ?? 'desktop';

  const rows: RankTrackingRow[] = filtered.map((kw) => {
    const desk = snapshotToDeviceResult(
      latest.get(`${kw.id}:desktop`),
      before.get(`${kw.id}:desktop`),
    );
    const mob = snapshotToDeviceResult(
      latest.get(`${kw.id}:mobile`),
      before.get(`${kw.id}:mobile`),
    );
    const m = metricsForKeyword(metricsMap, kw.keyword, query.config.location_code, query.config.language_code);
    return {
      trackingKeywordId: kw.id,
      keyword: kw.keyword,
      searchVolume: m.volume,
      keywordDifficulty: m.kd,
      cpc: m.cpc,
      desktop: query.config.devices === 'mobile' ? emptyDevice() : desk,
      mobile: query.config.devices === 'desktop' ? emptyDevice() : mob,
    };
  });

  const sort = query.sort ?? 'keyword';
  const order = query.order ?? 'asc';
  const sortKey = (r: RankTrackingRow): string | number | null => {
    if (sort === 'keyword') return normalizeKeyword(r.keyword);
    if (sort === 'volume') return r.searchVolume ?? -1;
    if (sort === 'kd') return r.keywordDifficulty ?? -1;
    if (sort === 'cpc') return r.cpc ?? -1;
    const dev = primaryDevice === 'mobile' ? r.mobile : r.desktop;
    return dev.position ?? 9999;
  };

  rows.sort((a, b) => {
    const av = sortKey(a);
    const bv = sortKey(b);
    if (av === bv) return a.trackingKeywordId - b.trackingKeywordId;
    if (av === null) return 1;
    if (bv === null) return -1;
    if (typeof av === 'number' && typeof bv === 'number') {
      return order === 'asc' ? av - bv : bv - av;
    }
    const cmp = String(av).localeCompare(String(bv));
    return order === 'asc' ? cmp : -cmp;
  });

  const total = rows.length;
  const pageSize = query.pageSize ?? query.limit ?? 50;

  if (query.cursor) {
    const decoded = decodeCursor(query.cursor);
    let startIdx = 0;
    if (decoded) {
      startIdx = rows.findIndex((r) => r.trackingKeywordId === decoded.id);
      if (startIdx >= 0) startIdx += 1;
    }
    const slice = rows.slice(startIdx, startIdx + pageSize);
    const last = slice[slice.length - 1];
    const nextCursor = last && startIdx + pageSize < total
      ? encodeCursor(sortKey(last), last.trackingKeywordId)
      : null;
    return { rows: slice, nextCursor, hasMore: !!nextCursor, total };
  }

  const page = Math.max(1, query.page ?? 1);
  const offset = (page - 1) * pageSize;
  const slice = rows.slice(offset, offset + pageSize);
  const last = slice[slice.length - 1];
  const nextCursor = last && offset + pageSize < total
    ? encodeCursor(sortKey(last), last.trackingKeywordId)
    : null;

  return {
    rows: slice,
    nextCursor,
    hasMore: offset + pageSize < total,
    total,
    page,
    pageSize,
  };
}

export async function countKeywords(configId: number): Promise<number> {
  const row = await queryOne<{ c: number }>(
    'SELECT COUNT(*) AS c FROM rank_tracking_keywords WHERE config_id = ?',
    [configId],
  );
  return Number(row?.c ?? 0);
}
