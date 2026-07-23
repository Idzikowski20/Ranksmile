import { createHash } from 'crypto';
import type {
  ChartPoint,
  KeywordState,
  KeywordTrend,
  OrganicKeyword,
  OrganicMetrics,
  PageSummary,
  PositionBucketKey,
  ProviderKeywordRow,
  ProviderOrganicPayload,
  ProviderOverviewPoint,
  TopicRef,
} from './types';

const CTR_BY_POS: Record<number, number> = {
  1: 0.3, 2: 0.15, 3: 0.1, 4: 0.07, 5: 0.05,
  6: 0.04, 7: 0.03, 8: 0.025, 9: 0.02, 10: 0.02,
};

function ctrForPosition(pos: number | null): number {
  if (pos == null || pos < 1) return 0;
  if (pos <= 10) return CTR_BY_POS[pos] ?? 0.02;
  if (pos <= 20) return 0.01;
  if (pos <= 50) return 0.004;
  return 0.001;
}

function positionGapFactor(pos: number | null): number {
  if (pos == null) return 0.2;
  if (pos >= 4 && pos <= 20) return 1.4;
  if (pos >= 2 && pos <= 3) return 1.1;
  if (pos === 1) return 0.5;
  if (pos <= 50) return 1.0;
  return 0.6;
}

export function opportunityScore(row: {
  volume: number | null;
  difficulty: number | null;
  position: number | null;
}): number | null {
  const vol = row.volume;
  if (vol == null || vol <= 0) return null;
  const kd = row.difficulty ?? 50;
  const raw = vol * ctrForPosition(row.position) * (1 - Math.min(100, Math.max(0, kd)) / 100)
    * positionGapFactor(row.position);
  // Soft normalize: log scale into 0–100
  const score = Math.round(Math.min(100, (Math.log10(raw + 1) / Math.log10(50000)) * 100));
  return Number.isFinite(score) ? score : null;
}

export function keywordId(domain: string, keyword: string, localeKey: string): string {
  return createHash('sha1')
    .update(`${domain}|${localeKey}|${keyword.toLowerCase().trim()}`)
    .digest('hex')
    .slice(0, 16);
}

export function pageIdFromUrl(url: string | null): { pageId: string | null; path: string; normalized: string } {
  if (!url) return { pageId: null, path: '', normalized: '' };
  try {
    const withProto = url.startsWith('http') ? url : `https://${url.replace(/^\//, '')}`;
    const u = new URL(withProto.includes('://') ? withProto : `https://example.com${url.startsWith('/') ? url : `/${url}`}`);
    const path = u.pathname || '/';
    const normalized = `${u.hostname.replace(/^www\./, '')}${path}`.toLowerCase();
    const pageId = createHash('sha1').update(normalized).digest('hex').slice(0, 12);
    return { pageId, path, normalized: `https://${normalized}` };
  } catch {
    const path = url.startsWith('/') ? url : `/${url}`;
    const pageId = createHash('sha1').update(path.toLowerCase()).digest('hex').slice(0, 12);
    return { pageId, path, normalized: path };
  }
}

function deltaPct(current: number, previous: number | undefined): number | null {
  if (previous == null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 10000) / 100;
}

function trendFromChange(change: number | null): KeywordTrend {
  if (change == null || change === 0) return 'flat';
  return change > 0 ? 'up' : 'down';
}

function stateFromRow(
  row: ProviderKeywordRow,
  change30d: number | null,
): KeywordState {
  if (row.isLost) return 'lost';
  if (row.isNew || (row.previousPosition == null && row.position != null)) return 'new';
  if (change30d != null && change30d > 0) return 'growing';
  if (change30d != null && change30d < 0) return 'declining';
  return 'stable';
}

/** Position improvement: previous − current (positive = better rank). */
function positionChange(previous: number | null, current: number | null): number | null {
  if (previous == null || current == null) return null;
  return previous - current;
}

export function buildPages(keywords: OrganicKeyword[]): PageSummary[] {
  const map = new Map<string, PageSummary>();
  for (const k of keywords) {
    if (!k.pageId || !k.url) continue;
    const { path, normalized } = pageIdFromUrl(k.url);
    const existing = map.get(k.pageId);
    const traffic = k.traffic ?? 0;
    if (!existing) {
      map.set(k.pageId, {
        id: k.pageId,
        url: normalized || k.url,
        path: path || '/',
        keywordCount: 1,
        traffic,
        visibility: traffic,
        topPosition: k.position,
      });
    } else {
      existing.keywordCount += 1;
      existing.traffic += traffic;
      existing.visibility += traffic;
      if (k.position != null && (existing.topPosition == null || k.position < existing.topPosition)) {
        existing.topPosition = k.position;
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.traffic - a.traffic);
}

export function buildUncategorizedTopic(keywords: OrganicKeyword[]): TopicRef[] {
  if (!keywords.length) return [];
  return [{
    id: 'uncategorized',
    label: 'Uncategorized',
    keywordIds: keywords.map((k) => k.id),
  }];
}

export function mapKeywords(
  domain: string,
  localeKey: string,
  rows: ProviderKeywordRow[],
): OrganicKeyword[] {
  const totalTraffic = rows.reduce((s, r) => s + (r.traffic ?? 0), 0) || 1;
  return rows.map((row) => {
    const change30d = positionChange(row.previousPosition, row.position);
    const { pageId } = pageIdFromUrl(row.url);
    const id = keywordId(domain, row.keyword, localeKey);
    return {
      id,
      keyword: row.keyword,
      intent: row.intent,
      position: row.position,
      previousPosition: row.previousPosition,
      change30d,
      change90d: null,
      trend: trendFromChange(change30d),
      state: stateFromRow(row, change30d),
      volume: row.volume,
      difficulty: row.difficulty,
      traffic: row.traffic,
      trafficShare: row.traffic != null ? Math.round((row.traffic / totalTraffic) * 10000) / 100 : null,
      trafficCost: row.trafficCost,
      serpFeatures: row.serpFeatures,
      itemType: row.itemType,
      pageId,
      url: row.url,
      topicId: 'uncategorized',
      entityIds: [],
      opportunityScore: opportunityScore(row),
      updatedAt: row.updatedAt,
    };
  });
}

export function buildMetrics(payload: ProviderOrganicPayload): OrganicMetrics {
  const overview = payload.overview;
  const prev = overview.length >= 2 ? overview[overview.length - 2] : undefined;
  const keywordCount = payload.totalCount || payload.keywords.length;
  return {
    keywordCount,
    traffic: payload.currentTraffic,
    trafficCost: payload.currentTrafficCost,
    keywordCountDeltaPct: deltaPct(keywordCount, prev?.keywordCount),
    trafficDeltaPct: deltaPct(payload.currentTraffic, prev?.traffic),
    trafficCostDeltaPct: deltaPct(payload.currentTrafficCost, prev?.trafficCost),
    positionBuckets: payload.currentBuckets,
  };
}

export function buildChart(overview: ProviderOverviewPoint[]): ChartPoint[] {
  const monthly = overview.map((p) => ({
    date: p.date,
    top3: p.top3,
    pos4_10: p.pos4_10,
    pos11_20: p.pos11_20,
    pos21_50: p.pos21_50,
    pos51_100: p.pos51_100,
    serpFeatures: p.serpFeatures,
    keywordCount: p.keywordCount,
    traffic: p.traffic,
    trafficCost: p.trafficCost,
  }));
  return expandMonthlyChartToDaily(monthly);
}

function utcDateParts(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

function toIsoDateUTC(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function addUtcDays(y: number, m: number, d: number, days: number): { y: number; m: number; d: number } {
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

/**
 * DataForSEO Labs overview is monthly. Semrush 1M draws a bar per day —
 * expand each month snapshot forward until the next month (or today).
 */
export function expandMonthlyChartToDaily(
  monthly: ChartPoint[],
  untilIso?: string,
): ChartPoint[] {
  if (!monthly.length) return [];
  const sorted = [...monthly]
    .filter((p) => utcDateParts(p.date))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!sorted.length) return [];

  const today = untilIso || new Date().toISOString().slice(0, 10);
  const start = utcDateParts(sorted[0].date)!;
  const end = utcDateParts(today) || start;

  const out: ChartPoint[] = [];
  let cursor = start;
  let idx = 0;

  while (toIsoDateUTC(cursor.y, cursor.m, cursor.d) <= toIsoDateUTC(end.y, end.m, end.d)) {
    const cursorIso = toIsoDateUTC(cursor.y, cursor.m, cursor.d);
    while (idx + 1 < sorted.length && sorted[idx + 1].date <= cursorIso) {
      idx += 1;
    }
    if (cursorIso >= sorted[idx].date.slice(0, 10)) {
      const src = sorted[idx];
      out.push({ ...src, date: cursorIso });
    }
    cursor = addUtcDays(cursor.y, cursor.m, cursor.d, 1);
  }
  return out;
}

export function emptyBuckets(): Record<PositionBucketKey, number> {
  return { top3: 0, '4_10': 0, '11_20': 0, '21_50': 0, '51_100': 0, serp_features: 0 };
}
