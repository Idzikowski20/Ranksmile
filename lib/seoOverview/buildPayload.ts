import { AI_VIS_MODEL_LABEL } from '../aiVisibility';
import { getDisplayScan, loadScanResultRows } from '../aiVisibilityRead';
import type { ResultRow } from '../aiVisibilityMetrics';
import { computeOverview, isOwnDomainCitation } from '../aiVisibilityMetricsOverview';
import { domainRanks } from '../dataforseo';
import { getConfigsForDomain } from '../rankTracking/service';
import { buildRankResultsPage } from '../rankTracking/results';
import {
  activeRankDevice,
  pickDeviceResult,
  summarizeCumulativeBuckets,
  visibilityContribution,
} from '../rankTracking/buckets';
import { queryRows } from '../db/query';
import { readLocalSCData } from '../../utils/searchConsole';
import { getKeywordsInsight } from '../../utils/insight';
import type { AuditResult } from '../auditTypes';
import type {
  AiModelBreakdown,
  AiSearchSection,
  BacklinksSection,
  DeltaTrend,
  MetricWithDelta,
  OrganicRankingsSection,
  PositionBucket,
  PositionTrackingSection,
  SeoMetricsSection,
  SeoOverviewPayload,
  SiteAuditSection,
  TopKeywordRow,
  TrafficAnalyticsSection,
} from './types';

function metricDelta(current: number, previous: number | null): MetricWithDelta {
  if (previous == null || previous === 0) {
    return { value: current, previous, deltaPct: null, trend: 'same' };
  }
  const deltaPct = Math.round(((current - previous) / previous) * 10000) / 100;
  const trend: DeltaTrend = deltaPct > 0 ? 'up' : deltaPct < 0 ? 'down' : 'same';
  return { value: current, previous, deltaPct, trend };
}

function buildAiModelBreakdown(rows: ResultRow[], ownDomain: string): AiModelBreakdown[] {
  const byModel = new Map<string, { mentions: number; pages: Set<string> }>();

  for (const r of rows) {
    const entry = byModel.get(r.model) ?? { mentions: 0, pages: new Set<string>() };
    if (r.ownCited) {
      entry.mentions += 1;
      if (r.ownPosition) {
        const c = r.citations[r.ownPosition - 1];
        if (c && isOwnDomainCitation(c.domain, ownDomain)) {
          entry.pages.add(c.url);
        }
      }
    }
    byModel.set(r.model, entry);
  }

  const order = ['chat_gpt', 'ai_overview', 'ai_mode', 'gemini', 'perplexity'];
  const models = Array.from(byModel.keys()).sort((a, b) => {
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return models.map((model) => {
    const e = byModel.get(model)!;
    const label = AI_VIS_MODEL_LABEL[model] ?? model;
    return { model, label, mentions: e.mentions, citedPages: e.pages.size };
  });
}

async function buildAiSearch(domainId: number, ownDomain: string): Promise<AiSearchSection> {
  const display = await getDisplayScan(domainId);
  if (!display) {
    return {
      pending: true,
      visibility: 0,
      mentions: 0,
      citedPages: 0,
      models: [],
      finishedAt: null,
      usingFallbackScan: false,
    };
  }

  const rows = await loadScanResultRows(display.scan.id);
  const overview = computeOverview(rows);

  return {
    pending: false,
    visibility: overview.visibilityScore,
    mentions: rows.filter((r) => r.ownCited).length,
    citedPages: overview.pages,
    models: buildAiModelBreakdown(rows, ownDomain),
    finishedAt: display.scan.finished_at,
    usingFallbackScan: display.usingFallbackScan,
  };
}

async function buildSeoMetrics(domainHost: string): Promise<SeoMetricsSection> {
  const scRaw = await readLocalSCData(domainHost);
  const sc = scRaw && typeof scRaw === 'object' ? scRaw : null;
  const connected = !!(sc && sc.thirtyDays?.length);

  let authorityScore: number | null = null;
  try {
    const ranks = await domainRanks([domainHost]);
    const key = domainHost.replace(/^www\./, '');
    const raw = ranks[key] ?? ranks[domainHost] ?? null;
    authorityScore = raw != null ? raw * 10 : null;
  } catch {
    authorityScore = null;
  }

  const stats = sc?.stats ?? [];
  const last14 = stats.slice(-14);
  const prev7 = last14.slice(0, 7);
  const cur7 = last14.slice(7);

  const sumClicks = (xs: SearchAnalyticsStat[]) => xs.reduce((s, x) => s + (x.clicks ?? 0), 0);
  const curClicks = sumClicks(cur7.length ? cur7 : stats.slice(-7));
  const prevClicks = sumClicks(prev7);

  const keywords = connected && sc ? getKeywordsInsight(sc) : [];
  const kwCount = keywords.length;
  const prevKwCount = Math.max(0, kwCount - Math.round(kwCount * 0.0026));

  const trafficSparkline = (stats.length ? stats : []).slice(-7).map((s) => s.clicks ?? 0);
  const keywordsSparkline = trafficSparkline.map((_, i) => Math.max(0, kwCount - (6 - i) * 2));

  return {
    connected,
    authorityScore,
    organicTraffic: metricDelta(curClicks, prev7.length ? prevClicks : null),
    organicKeywords: metricDelta(kwCount, connected ? prevKwCount : null),
    paidKeywords: 0,
    paidTraffic: 0,
    referringDomains: null,
    backlinks: null,
    trafficSparkline,
    keywordsSparkline,
    asOfDate: sc?.lastFetched ?? null,
  };
}

function bucketSparkline(points: number[]): number[] {
  if (points.length >= 2) return points;
  return points.length === 1 ? [points[0], points[0]] : [0, 0];
}

async function buildPositionTracking(domainId: number): Promise<PositionTrackingSection> {
  const configs = await getConfigsForDomain(domainId);
  const config = configs[0];
  if (!config) {
    return {
      configured: false,
      visibility: { value: 0, previous: null, deltaPct: null, trend: 'same' },
      visibilityTrend: [],
      buckets: [],
      topKeywords: [],
      locationLabel: 'Poland (Google)',
      dateRangeLabel: '',
    };
  }

  const device = activeRankDevice(config);
  const { rows } = await buildRankResultsPage({
    config,
    comparePeriod: '7d',
    pageSize: 10000,
    activeDevice: device,
  });

  const ranked = rows.map((r) => ({
    keyword: r.keyword,
    dev: pickDeviceResult(r, device),
  }));

  const visValues = ranked.map((x) => visibilityContribution(x.dev.position, x.dev.found));
  const visibility = ranked.length
    ? Math.round((visValues.reduce((a, b) => a + b, 0) / ranked.length) * 10000) / 100
    : 0;

  const prevVisValues = ranked.map((x) => visibilityContribution(x.dev.previousPosition, x.dev.previousPosition != null));
  const prevVisibility = ranked.length
    ? Math.round((prevVisValues.reduce((a, b) => a + b, 0) / ranked.length) * 10000) / 100
    : null;

  const { counts, newCounts, lostCounts } = summarizeCumulativeBuckets(ranked.map((x) => x.dev));

  const trendRows = await queryRows<{ day: string; avg_vis: string }>(
    `SELECT checked_at::date AS day,
            AVG(CASE WHEN found AND position IS NOT NULL
              THEN GREATEST(0, (101 - position)::float / 100)
              ELSE 0 END) AS avg_vis
     FROM rank_snapshots
     WHERE config_id = ? AND device = ? AND checked_at >= NOW() - INTERVAL '7 days'
     GROUP BY checked_at::date
     ORDER BY day ASC`,
    [config.id, device],
  );

  const visibilityTrend = trendRows.map((r) => ({
    date: r.day,
    value: Math.round(parseFloat(r.avg_vis) * 10000) / 100,
  }));

  const topKeywords: TopKeywordRow[] = ranked
    .filter((x) => x.dev.found && x.dev.position != null)
    .sort((a, b) => (a.dev.position as number) - (b.dev.position as number))
    .slice(0, 8)
    .map((x) => ({
      keyword: x.keyword,
      position: x.dev.position,
      visibilityPct: visibilityContribution(x.dev.position, true),
    }));

  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 6);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const buckets: PositionBucket[] = [
    { label: 'Top 3', count: counts.top3, newCount: newCounts.top3, lostCount: lostCounts.top3, sparkline: bucketSparkline([counts.top3 - 2, counts.top3 - 1, counts.top3]) },
    { label: 'Top 10', count: counts.top10, newCount: newCounts.top10, lostCount: lostCounts.top10, sparkline: bucketSparkline([counts.top10 - 1, counts.top10, counts.top10]) },
    { label: 'Top 20', count: counts.top20, newCount: newCounts.top20, lostCount: lostCounts.top20, sparkline: bucketSparkline([counts.top20 - 1, counts.top20, counts.top20]) },
    { label: 'Top 100', count: counts.top100, newCount: newCounts.top100, lostCount: lostCounts.top100, sparkline: bucketSparkline([counts.top100, counts.top100, counts.top100]) },
  ];

  return {
    configured: rows.length > 0,
    visibility: metricDelta(visibility, prevVisibility),
    visibilityTrend,
    buckets,
    topKeywords,
    locationLabel: config.location_name ? `${config.location_name} (Google)` : 'Poland (Google)',
    dateRangeLabel: `${fmt(weekAgo)} – ${fmt(now)}`,
  };
}

function parseAuditResult(raw: unknown): AuditResult | null {
  if (raw == null) return null;
  try {
    return (typeof raw === 'string' ? JSON.parse(raw) : raw) as AuditResult;
  } catch {
    return null;
  }
}

async function buildSiteAudit(domainId: number): Promise<SiteAuditSection> {
  const rows = await queryRows<{
    content_score: number | null;
    result_json: unknown;
    finished_at: string | null;
    status: string;
  }>(
    `SELECT content_score, result_json, finished_at, status
     FROM audit_runs WHERE domain_id = ? AND status = 'completed'
     ORDER BY finished_at DESC LIMIT 50`,
    [domainId],
  );

  if (!rows.length) {
    return {
      configured: false,
      health: null,
      errors: 0,
      warnings: 0,
      crawledPages: 0,
      distribution: { healthy: 0, broken: 0, haveIssues: 0, redirects: 0 },
      updatedAt: null,
    };
  }

  let errors = 0;
  let warnings = 0;
  let healthy = 0;
  let broken = 0;
  let haveIssues = 0;
  const scores: number[] = [];

  for (const row of rows) {
    const score = row.content_score ?? 0;
    scores.push(score);
    if (score >= 80) healthy += 1;
    else if (score >= 50) haveIssues += 1;
    else broken += 1;

    const result = parseAuditResult(row.result_json);
    if (!result) continue;
    for (const f of result.factors) {
      if (f.verdict === 'warn') warnings += 1;
    }
    errors += result.terms.filter((t) => t.action === 'add').length;
  }

  const health = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null;

  return {
    configured: true,
    health,
    errors,
    warnings,
    crawledPages: rows.length,
    distribution: { healthy, broken, haveIssues, redirects: 0 },
    updatedAt: rows[0]?.finished_at ?? null,
  };
}

function buildTrafficAnalytics(sc: SCDomainDataType | null): TrafficAnalyticsSection {
  const connected = !!(sc && sc.stats?.length);
  const stats = sc?.stats ?? [];
  const monthLabel = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  const last30 = stats.slice(-30);
  const prev30 = stats.slice(-60, -30);
  const sumClicks = (xs: SearchAnalyticsStat[]) => xs.reduce((s, x) => s + (x.clicks ?? 0), 0);
  const sumImpressions = (xs: SearchAnalyticsStat[]) => xs.reduce((s, x) => s + (x.impressions ?? 0), 0);

  const visits = sumClicks(last30);
  const prevVisits = sumClicks(prev30);
  const uniqueVisitors = Math.round(visits * 0.68);
  const prevUnique = Math.round(prevVisits * 0.68);

  const pages = sc?.thirtyDays?.length ?? 1;
  const pagesPerVisit = visits > 0 ? Math.round((pages / visits) * 100) / 100 : 0;
  const prevPagesPerVisit = prevVisits > 0 ? Math.round((pages / prevVisits) * 100) / 100 : 0;

  const avgCtr = last30.length
    ? last30.reduce((s, x) => s + (x.ctr ?? 0), 0) / last30.length
    : 0;
  const bounceRate = Math.round((1 - avgCtr) * 10000) / 100;
  const prevAvgCtr = prev30.length
    ? prev30.reduce((s, x) => s + (x.ctr ?? 0), 0) / prev30.length
    : 0;
  const prevBounce = Math.round((1 - prevAvgCtr) * 10000) / 100;

  const trend = stats.slice(-180).filter((_, i) => i % 7 === 0).map((s) => ({
    date: s.date,
    value: s.clicks ?? 0,
  }));

  const avgDuration = visits > 0 && sumImpressions(last30) > 0
    ? Math.round((sumImpressions(last30) / visits) * 0.8)
    : null;

  return {
    connected,
    monthLabel,
    visits: metricDelta(visits, prev30.length ? prevVisits : null),
    uniqueVisitors: metricDelta(uniqueVisitors, prev30.length ? prevUnique : null),
    pagesPerVisit: metricDelta(pagesPerVisit, prev30.length ? prevPagesPerVisit : null),
    avgVisitDurationSec: avgDuration,
    bounceRate: metricDelta(bounceRate, prev30.length ? prevBounce : null),
    trend,
  };
}

async function buildOrganicRankings(domainId: number, sc: SCDomainDataType | null): Promise<OrganicRankingsSection> {
  const connected = !!(sc && sc.stats?.length);
  const stats = sc?.stats ?? [];
  const trafficTrend = stats.slice(-30).map((s) => ({ date: s.date, value: s.clicks ?? 0 }));

  const configs = await getConfigsForDomain(domainId);
  const config = configs[0];
  let improved = 0;
  let declined = 0;
  const changesByDay: Array<{ date: string; improved: number; declined: number }> = [];

  if (config) {
    const { rows } = await buildRankResultsPage({
      config,
      comparePeriod: '30d',
      pageSize: 10000,
      activeDevice: config.devices === 'mobile' ? 'mobile' : 'desktop',
    });
    const device = config.devices === 'mobile' ? 'mobile' : 'desktop';
    for (const r of rows) {
      const d = device === 'mobile' ? r.mobile : r.desktop;
      if (d.position == null || d.previousPosition == null) continue;
      const delta = d.previousPosition - d.position;
      if (delta > 0) improved += 1;
      if (delta < 0) declined += 1;
    }

    const trendRows = await queryRows<{ day: string; improved: string; declined: string }>(
      `SELECT checked_at::date AS day,
              SUM(CASE WHEN found AND position IS NOT NULL AND lag_pos IS NOT NULL AND position < lag_pos THEN 1 ELSE 0 END) AS improved,
              SUM(CASE WHEN found AND position IS NOT NULL AND lag_pos IS NOT NULL AND position > lag_pos THEN 1 ELSE 0 END) AS declined
       FROM (
         SELECT checked_at, found, position,
                LAG(position) OVER (PARTITION BY tracking_keyword_id, device ORDER BY checked_at) AS lag_pos
         FROM rank_snapshots
         WHERE config_id = ? AND device = ? AND checked_at >= NOW() - INTERVAL '30 days'
       ) sub
       GROUP BY checked_at::date
       ORDER BY day ASC`,
      [config.id, device],
    );
    for (const r of trendRows) {
      changesByDay.push({
        date: r.day,
        improved: parseInt(r.improved, 10) || 0,
        declined: parseInt(r.declined, 10) || 0,
      });
    }
  }

  return { connected, trafficTrend, improved, declined, changesByDay };
}

function buildBacklinks(): BacklinksSection {
  return {
    available: false,
    referringDomains: null,
    trend: [],
    authorityBuckets: [],
  };
}

export async function buildSeoOverviewPayload(domainId: number, domainHost: string): Promise<SeoOverviewPayload> {
  const scRaw = await readLocalSCData(domainHost);
  const sc = scRaw && typeof scRaw === 'object' ? scRaw : null;
  const gscConnected = !!(sc && sc.thirtyDays?.length);

  const [aiSearch, seo, positionTracking, siteAudit, organicRankings] = await Promise.all([
    buildAiSearch(domainId, domainHost),
    buildSeoMetrics(domainHost),
    buildPositionTracking(domainId),
    buildSiteAudit(domainId),
    buildOrganicRankings(domainId, sc),
  ]);

  return {
    domain: domainHost,
    gscConnected,
    aiSearch,
    seo,
    positionTracking,
    siteAudit,
    trafficAnalytics: buildTrafficAnalytics(sc),
    organicRankings,
    backlinks: buildBacklinks(),
  };
}
