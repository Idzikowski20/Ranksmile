/**
 * GSC → OrganicDataset for Search Intelligence (daily truth for owned property).
 */
import Domain from '../../database/models/domain';
import {
  buildChart,
  buildPages,
  buildUncategorizedTopic,
  emptyBuckets,
  mapKeywords,
} from './derive';
import { cached, TTL } from '../cache/fileCache';
import {
  DATASET_VERSION,
  ORGANIC_GSC_CACHE_TTL_MS,
  PROVIDER_VERSION_GSC,
  type ChartPoint,
  type DatasetLocale,
  type OrganicDataset,
  type PositionBucketKey,
  type ProviderKeywordRow,
  type ProviderOverviewPoint,
} from './types';
import {
  fetchDomainSCData,
  fetchSearchConsoleData,
  getSearchConsoleApiInfo,
  hasValidSCAuth,
} from '../../utils/searchConsole';

export type GscLoadResult =
  | { ok: true; dataset: OrganicDataset }
  | { ok: false; needsGsc: true; error?: string };

type DateQueryRow = {
  date: string;
  keyword: string;
  clicks: number;
  impressions: number;
  position: number;
};

type AggKeyword = {
  keyword: string;
  clicks: number;
  impressions: number;
  positionWeighted: number;
  url: string | null;
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toDateString(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function daysAgo(days: number) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, 12);
}

function bucketForPosition(pos: number): PositionBucketKey | null {
  if (pos <= 0) return null;
  if (pos <= 3) return 'top3';
  if (pos <= 10) return '4_10';
  if (pos <= 20) return '11_20';
  if (pos <= 50) return '21_50';
  if (pos <= 100) return '51_100';
  return null;
}

function aggregateQueries(items: SearchAnalyticsItem[]): Map<string, AggKeyword> {
  const map = new Map<string, AggKeyword>();
  for (const item of items) {
    const key = item.keyword.trim().toLowerCase();
    if (!key) continue;
    const existing = map.get(key);
    const page = item.page ? (item.page.startsWith('/') ? item.page : `/${item.page}`) : null;
    if (!existing) {
      map.set(key, {
        keyword: item.keyword,
        clicks: item.clicks,
        impressions: item.impressions,
        positionWeighted: item.position * item.impressions,
        url: page,
      });
    } else {
      existing.clicks += item.clicks;
      existing.impressions += item.impressions;
      existing.positionWeighted += item.position * item.impressions;
      if ((!existing.url || existing.url === '/') && page) existing.url = page;
    }
  }
  return map;
}

function bucketsFromAgg(aggs: Iterable<AggKeyword>): Record<PositionBucketKey, number> {
  const buckets = emptyBuckets();
  for (const a of aggs) {
    if (a.impressions <= 0) continue;
    const pos = a.positionWeighted / a.impressions;
    const key = bucketForPosition(pos);
    if (key) buckets[key] += 1;
  }
  return buckets;
}

function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 10000) / 100;
}

function buildDailyChart(rows: DateQueryRow[]): ChartPoint[] {
  const byDate = new Map<string, {
    queries: Map<string, { impressions: number; positionWeighted: number; clicks: number }>;
  }>();

  for (const row of rows) {
    if (!row.date || !row.keyword) continue;
    let day = byDate.get(row.date);
    if (!day) {
      day = { queries: new Map() };
      byDate.set(row.date, day);
    }
    const qKey = row.keyword.toLowerCase();
    const prev = day.queries.get(qKey);
    if (!prev) {
      day.queries.set(qKey, {
        impressions: row.impressions,
        positionWeighted: row.position * row.impressions,
        clicks: row.clicks,
      });
    } else {
      prev.impressions += row.impressions;
      prev.positionWeighted += row.position * row.impressions;
      prev.clicks += row.clicks;
    }
  }

  const points: ChartPoint[] = [];
  for (const date of Array.from(byDate.keys()).sort()) {
    const day = byDate.get(date)!;
    const buckets = emptyBuckets();
    let traffic = 0;
    for (const q of day.queries.values()) {
      traffic += q.clicks;
      if (q.impressions <= 0) continue;
      const pos = q.positionWeighted / q.impressions;
      const key = bucketForPosition(pos);
      if (key) buckets[key] += 1;
    }
    points.push({
      date,
      top3: buckets.top3,
      pos4_10: buckets['4_10'],
      pos11_20: buckets['11_20'],
      pos21_50: buckets['21_50'],
      pos51_100: buckets['51_100'],
      serpFeatures: 0,
      keywordCount: day.queries.size,
      traffic,
      trafficCost: 0,
    });
  }
  return points;
}

function overviewFromChart(chart: ChartPoint[]): ProviderOverviewPoint[] {
  return chart.map((p) => ({
    date: p.date,
    keywordCount: p.keywordCount ?? 0,
    traffic: p.traffic ?? 0,
    trafficCost: 0,
    top3: p.top3,
    pos4_10: p.pos4_10,
    pos11_20: p.pos11_20,
    pos21_50: p.pos21_50,
    pos51_100: p.pos51_100,
    serpFeatures: 0,
  }));
}

export async function loadOrganicDatasetFromGsc(opts: {
  domainId: number;
  userId?: string | null;
}): Promise<GscLoadResult> {
  const domainRow = await Domain.findByPk(opts.domainId);
  if (!domainRow) throw new Error('Domain not found');
  const domainObj = domainRow.get({ plain: true }) as DomainType;
  const hostname = String(domainObj.domain || '');

  const api = await getSearchConsoleApiInfo(domainObj, opts.userId);
  if (!hasValidSCAuth(api)) {
    return { ok: false, needsGsc: true };
  }

  const cacheKey = [DATASET_VERSION, PROVIDER_VERSION_GSC, hostname, opts.userId || 'anon'];
  const dataset = await cached({
    namespace: 'organic-dataset',
    key: cacheKey,
    ttlMs: Math.min(TTL.RANKED_KEYWORDS, ORGANIC_GSC_CACHE_TTL_MS),
    producer: () => buildGscDataset(domainObj, api),
  });

  return { ok: true, dataset };
}

async function buildGscDataset(
  domainObj: DomainType,
  api: Awaited<ReturnType<typeof getSearchConsoleApiInfo>>,
): Promise<OrganicDataset> {
  const hostname = String(domainObj.domain || '');
  const end = toDateString(daysAgo(0));
  const start30 = toDateString(daysAgo(29));
  const prevEnd = toDateString(daysAgo(30));
  const prevStart = toDateString(daysAgo(59));
  const chartStart = toDateString(daysAgo(89));

  const [currentPack, previousPack, dateQueryRaw] = await Promise.all([
    fetchDomainSCData(domainObj, api, { startDate: start30, endDate: end }),
    fetchDomainSCData(domainObj, api, { startDate: prevStart, endDate: prevEnd }),
    fetchSearchConsoleData(domainObj, 0, 'dateQuery', api, {
      startDate: chartStart,
      endDate: end,
    }),
  ]);

  if (currentPack.lastFetchError && !(currentPack.selectedRange?.length)) {
    // Still allow empty dataset if auth works but no rows
  }

  const currentItems = currentPack.selectedRange?.length
    ? currentPack.selectedRange
    : (currentPack.thirtyDays || []);
  const previousItems = previousPack.selectedRange?.length
    ? previousPack.selectedRange
    : (previousPack.thirtyDays || []);

  const currentAgg = aggregateQueries(currentItems);
  const previousAgg = aggregateQueries(previousItems);

  const rows: ProviderKeywordRow[] = [];
  for (const agg of currentAgg.values()) {
    const prev = previousAgg.get(agg.keyword.toLowerCase());
    const position = agg.impressions > 0 ? agg.positionWeighted / agg.impressions : null;
    const previousPosition = prev && prev.impressions > 0
      ? prev.positionWeighted / prev.impressions
      : null;
    rows.push({
      keyword: agg.keyword,
      intent: null,
      position: position != null ? Math.round(position * 10) / 10 : null,
      previousPosition: previousPosition != null ? Math.round(previousPosition * 10) / 10 : null,
      volume: agg.impressions || null,
      difficulty: null,
      cpc: null,
      traffic: agg.clicks,
      trafficCost: null,
      serpFeatures: [],
      itemType: 'organic',
      url: agg.url,
      updatedAt: new Date().toISOString(),
      isNew: !prev,
      isLost: false,
    });
  }

  // Lost keywords: in previous but not current
  for (const [key, prev] of previousAgg) {
    if (currentAgg.has(key)) continue;
    rows.push({
      keyword: prev.keyword,
      intent: null,
      position: null,
      previousPosition: prev.impressions > 0 ? Math.round((prev.positionWeighted / prev.impressions) * 10) / 10 : null,
      volume: prev.impressions || null,
      difficulty: null,
      cpc: null,
      traffic: 0,
      trafficCost: null,
      serpFeatures: [],
      itemType: 'organic',
      url: prev.url,
      updatedAt: new Date().toISOString(),
      isNew: false,
      isLost: true,
    });
  }

  rows.sort((a, b) => (b.traffic ?? 0) - (a.traffic ?? 0));

  const locale: DatasetLocale = {
    country: 'US',
    language: 'en',
    locationCode: 2840,
  };
  const localeKey = `${locale.country}:${locale.language}`;
  const keywords = mapKeywords(hostname, localeKey, rows.slice(0, 1000));

  const currentBuckets = bucketsFromAgg(currentAgg.values());
  const currentTraffic = Array.from(currentAgg.values()).reduce((s, a) => s + a.clicks, 0);
  const previousTraffic = Array.from(previousAgg.values()).reduce((s, a) => s + a.clicks, 0);
  const keywordCount = currentAgg.size;
  const previousKeywordCount = previousAgg.size;

  const dateQueryRows: DateQueryRow[] = Array.isArray(dateQueryRaw)
    ? (dateQueryRaw as DateQueryRow[]).filter((r) => r && typeof r.date === 'string')
    : [];

  let chart = buildDailyChart(dateQueryRows);
  if (!chart.length && Array.isArray(currentPack.stats) && currentPack.stats.length) {
    chart = currentPack.stats.map((s) => ({
      date: s.date,
      top3: 0,
      pos4_10: 0,
      pos11_20: 0,
      pos21_50: 0,
      pos51_100: 0,
      serpFeatures: 0,
      keywordCount: 0,
      traffic: s.clicks,
      trafficCost: 0,
    }));
  }

  const overview = overviewFromChart(chart);
  const fetchedAt = new Date().toISOString();

  return {
    domain: hostname,
    meta: {
      fetchedAt,
      expiresAt: new Date(Date.now() + ORGANIC_GSC_CACHE_TTL_MS).toISOString(),
      provider: 'gsc',
      providerVersion: PROVIDER_VERSION_GSC,
      datasetVersion: DATASET_VERSION,
      locale,
    },
    metrics: {
      keywordCount,
      traffic: currentTraffic,
      trafficCost: 0,
      keywordCountDeltaPct: deltaPct(keywordCount, previousKeywordCount),
      trafficDeltaPct: deltaPct(currentTraffic, previousTraffic),
      trafficCostDeltaPct: null,
      positionBuckets: currentBuckets,
    },
    chart: buildChart(overview),
    keywords,
    pages: buildPages(keywords),
    topics: buildUncategorizedTopic(keywords),
    entities: [],
  };
}
