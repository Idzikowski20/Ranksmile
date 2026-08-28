/** Search Intelligence — domain model (provider-agnostic). */

export type KeywordState = 'new' | 'lost' | 'growing' | 'declining' | 'stable';
export type SearchIntent = 'informational' | 'commercial' | 'transactional' | 'navigational' | null;
export type KeywordTrend = 'up' | 'down' | 'flat';
export type OrganicItemType = 'organic' | 'serp_feature' | 'paid' | string;

export type OrganicKeyword = {
  id: string;
  keyword: string;
  intent: SearchIntent;
  position: number | null;
  previousPosition: number | null;
  change30d: number | null;
  change90d: number | null;
  trend: KeywordTrend;
  state: KeywordState;
  volume: number | null;
  difficulty: number | null;
  traffic: number | null;
  trafficShare: number | null;
  trafficCost: number | null;
  serpFeatures: string[];
  itemType: OrganicItemType;
  pageId: string | null;
  url: string | null;
  topicId: string | null;
  entityIds: string[];
  opportunityScore: number | null;
  updatedAt: string | null;
};

export type PageSummary = {
  id: string;
  url: string;
  path: string;
  keywordCount: number;
  traffic: number;
  visibility: number;
  topPosition: number | null;
};

export type TopicRef = {
  id: string;
  label: string;
  keywordIds: string[];
};

export type EntityRef = {
  id: string;
  label: string;
  keywordIds: string[];
};

export type PositionBucketKey = 'top3' | '4_10' | '11_20' | '21_50' | '51_100' | 'serp_features';

export type OrganicMetrics = {
  keywordCount: number;
  traffic: number;
  trafficCost: number;
  keywordCountDeltaPct: number | null;
  trafficDeltaPct: number | null;
  trafficCostDeltaPct: number | null;
  positionBuckets: Record<PositionBucketKey, number>;
  /** GSC enrich (hybrid) — real clicks last 30d */
  gscClicks?: number | null;
  gscClicksDeltaPct?: number | null;
};

export type ChartPoint = {
  date: string;
  top3: number;
  pos4_10: number;
  pos11_20: number;
  pos21_50: number;
  pos51_100: number;
  serpFeatures?: number;
  /** Domain-level series for KPI mini-trends */
  keywordCount?: number;
  traffic?: number;
  trafficCost?: number;
};

export type DatasetLocale = {
  country: string;
  language: string;
  locationCode: number;
};

export type DatasetCacheMeta = {
  fetchedAt: string;
  expiresAt: string;
  provider: 'dataforseo' | 'gsc' | 'hybrid';
  providerVersion: string;
  datasetVersion: string;
  locale: DatasetLocale;
  gscConnected?: boolean;
};

export type OrganicDataset = {
  domain: string;
  meta: DatasetCacheMeta;
  metrics: OrganicMetrics;
  chart: ChartPoint[];
  keywords: OrganicKeyword[];
  pages: PageSummary[];
  topics: TopicRef[];
  entities: EntityRef[];
};

/** Raw keyword row from a provider before domain derive (no DFS types). */
export type ProviderKeywordRow = {
  keyword: string;
  intent: SearchIntent;
  position: number | null;
  previousPosition: number | null;
  volume: number | null;
  difficulty: number | null;
  cpc: number | null;
  traffic: number | null;
  trafficCost: number | null;
  serpFeatures: string[];
  itemType: OrganicItemType;
  url: string | null;
  updatedAt: string | null;
  isNew?: boolean;
  isLost?: boolean;
};

export type ProviderOverviewPoint = {
  date: string;
  keywordCount: number;
  traffic: number;
  trafficCost: number;
  top3: number;
  pos4_10: number;
  pos11_20: number;
  pos21_50: number;
  pos51_100: number;
  serpFeatures: number;
};

export type ProviderOrganicPayload = {
  domain: string;
  locale: DatasetLocale;
  keywords: ProviderKeywordRow[];
  totalCount: number;
  overview: ProviderOverviewPoint[];
  currentBuckets: Record<PositionBucketKey, number>;
  currentTraffic: number;
  currentTrafficCost: number;
};

export const DATASET_VERSION = '4';
export const PROVIDER_VERSION_DATAFORSEO = 'labs-ranked-v1';
export const PROVIDER_VERSION_GSC = 'gsc-search-analytics-v1';
export const PROVIDER_VERSION_HYBRID = 'hybrid-dfs-gsc-v1';
export const ORGANIC_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** GSC cache — shorter; Search Analytics updates daily. */
export const ORGANIC_GSC_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
export const ORGANIC_FETCH_LIMIT = 1000;
