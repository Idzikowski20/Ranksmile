export type DeltaTrend = 'up' | 'down' | 'same';

export type MetricWithDelta = {
  value: number;
  previous: number | null;
  deltaPct: number | null;
  trend: DeltaTrend;
};

export type AiModelBreakdown = {
  model: string;
  label: string;
  mentions: number;
  citedPages: number;
};

export type AiSearchSection = {
  pending: boolean;
  visibility: number;
  mentions: number;
  citedPages: number;
  models: AiModelBreakdown[];
  finishedAt: string | null;
  usingFallbackScan: boolean;
};

export type SeoMetricsSection = {
  connected: boolean;
  organicTraffic: MetricWithDelta;
  organicKeywords: MetricWithDelta;
  paidKeywords: number;
  paidTraffic: number;
  referringDomains: number | null;
  backlinks: number | null;
  trafficSparkline: number[];
  keywordsSparkline: number[];
  asOfDate: string | null;
};

export type PositionBucket = {
  label: string;
  count: number;
  newCount: number;
  lostCount: number;
  sparkline: number[];
};

export type TopKeywordRow = {
  keyword: string;
  position: number | null;
  visibilityPct: number;
};

export type PositionTrackingSection = {
  configured: boolean;
  visibility: MetricWithDelta;
  visibilityTrend: Array<{ date: string; value: number }>;
  buckets: PositionBucket[];
  topKeywords: TopKeywordRow[];
  locationLabel: string;
  dateRangeLabel: string;
};

export type SeoOverviewPayload = {
  domain: string;
  gscConnected: boolean;
  aiSearch: AiSearchSection;
  seo: SeoMetricsSection;
  positionTracking: PositionTrackingSection;
  siteAudit: SiteAuditSection;
  trafficAnalytics: TrafficAnalyticsSection;
  organicRankings: OrganicRankingsSection;
  backlinks: BacklinksSection;
};

export type SiteAuditSection = {
  configured: boolean;
  health: number | null;
  errors: number;
  warnings: number;
  crawledPages: number;
  distribution: { healthy: number; broken: number; haveIssues: number; redirects: number };
  updatedAt: string | null;
};

export type TrafficAnalyticsSection = {
  connected: boolean;
  monthLabel: string;
  visits: MetricWithDelta;
  uniqueVisitors: MetricWithDelta;
  pagesPerVisit: MetricWithDelta;
  avgVisitDurationSec: number | null;
  bounceRate: MetricWithDelta;
  trend: Array<{ date: string; value: number }>;
};

export type OrganicRankingsSection = {
  connected: boolean;
  trafficTrend: Array<{ date: string; value: number }>;
  improved: number;
  declined: number;
  changesByDay: Array<{ date: string; improved: number; declined: number }>;
};

export type BacklinksSection = {
  available: boolean;
  referringDomains: number | null;
  trend: Array<{ date: string; value: number }>;
  authorityBuckets: Array<{ range: string; pct: number; count: number }>;
};
