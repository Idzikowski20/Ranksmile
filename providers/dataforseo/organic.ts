/**
 * DataForSEO Labs ranked_keywords — raw fetch + map to provider rows (not domain OrganicKeyword).
 */
import { toDfsLanguageCode } from '../../lib/domainLanguagePrompts';
import type {
  OrganicItemType,
  PositionBucketKey,
  ProviderKeywordRow,
  SearchIntent,
} from '../../lib/organicResearch/types';
import { ORGANIC_FETCH_LIMIT } from '../../lib/organicResearch/types';
import {
  dfsPostResult,
  isDataForSeoConfigured,
  locationCodeFor,
  normalizeTargetDomain,
} from './client';

type SerpItem = {
  type?: string;
  rank_group?: number;
  rank_absolute?: number;
  url?: string;
  relative_url?: string;
  etv?: number;
  estimated_paid_traffic_cost?: number;
};

type RankedItem = {
  keyword_data?: {
    keyword?: string;
    keyword_info?: { search_volume?: number; cpc?: number };
    keyword_properties?: { keyword_difficulty?: number };
    search_intent_info?: { main_intent?: string };
    serp_info?: {
      serp_item_types?: string[];
      last_updated_time?: string;
    };
  };
  ranked_serp_element?: {
    serp_item?: SerpItem;
    previous_rank_absolute?: number | null;
    is_new?: boolean;
    is_up?: boolean;
    is_down?: boolean;
    is_lost?: boolean;
  };
};

type OrganicMetricsBlock = {
  pos_1?: number;
  pos_2_3?: number;
  pos_4_10?: number;
  pos_11_20?: number;
  pos_21_30?: number;
  pos_31_40?: number;
  pos_41_50?: number;
  pos_51_60?: number;
  pos_61_70?: number;
  pos_71_80?: number;
  pos_81_90?: number;
  pos_91_100?: number;
  etv?: number;
  count?: number;
  estimated_paid_traffic_cost?: number;
  is_new?: number;
  is_lost?: number;
};

type RankedKeywordsResult = {
  target?: string;
  total_count?: number;
  items_count?: number;
  items?: RankedItem[];
  metrics?: {
    organic?: OrganicMetricsBlock;
    featured_snippet?: OrganicMetricsBlock;
    local_pack?: OrganicMetricsBlock;
  };
};

export type RankedKeywordsProviderResult = {
  keywords: ProviderKeywordRow[];
  totalCount: number;
  currentBuckets: Record<PositionBucketKey, number>;
  currentTraffic: number;
  currentTrafficCost: number;
};

function parseIntent(raw: string | undefined): SearchIntent {
  if (!raw) return null;
  const v = raw.toLowerCase();
  if (v === 'informational' || v === 'commercial' || v === 'transactional' || v === 'navigational') {
    return v;
  }
  return null;
}

function mapItemType(serpType: string | undefined): OrganicItemType {
  if (!serpType) return 'organic';
  if (serpType === 'organic') return 'organic';
  if (serpType === 'paid') return 'paid';
  return 'serp_feature';
}

function bucketsFromMetrics(m: OrganicMetricsBlock | undefined, serpFeatures: number): Record<PositionBucketKey, number> {
  const top3 = (m?.pos_1 ?? 0) + (m?.pos_2_3 ?? 0);
  const pos21_50 = (m?.pos_21_30 ?? 0) + (m?.pos_31_40 ?? 0) + (m?.pos_41_50 ?? 0);
  const pos51_100 = (m?.pos_51_60 ?? 0) + (m?.pos_61_70 ?? 0) + (m?.pos_71_80 ?? 0)
    + (m?.pos_81_90 ?? 0) + (m?.pos_91_100 ?? 0);
  return {
    top3,
    '4_10': m?.pos_4_10 ?? 0,
    '11_20': m?.pos_11_20 ?? 0,
    '21_50': pos21_50,
    '51_100': pos51_100,
    serp_features: serpFeatures,
  };
}

function mapRow(item: RankedItem): ProviderKeywordRow | null {
  const kd = item.keyword_data;
  const keyword = (kd?.keyword || '').trim();
  if (!keyword) return null;
  const serp = item.ranked_serp_element?.serp_item;
  const prev = item.ranked_serp_element?.previous_rank_absolute;
  const url = serp?.url || (serp?.relative_url ? serp.relative_url : null);
  return {
    keyword,
    intent: parseIntent(kd?.search_intent_info?.main_intent),
    position: typeof serp?.rank_absolute === 'number' ? serp.rank_absolute
      : typeof serp?.rank_group === 'number' ? serp.rank_group : null,
    previousPosition: typeof prev === 'number' ? prev : null,
    volume: typeof kd?.keyword_info?.search_volume === 'number' ? kd.keyword_info.search_volume : null,
    difficulty: typeof kd?.keyword_properties?.keyword_difficulty === 'number'
      ? kd.keyword_properties.keyword_difficulty : null,
    cpc: typeof kd?.keyword_info?.cpc === 'number' ? kd.keyword_info.cpc : null,
    traffic: typeof serp?.etv === 'number' ? serp.etv : null,
    trafficCost: typeof serp?.estimated_paid_traffic_cost === 'number'
      ? serp.estimated_paid_traffic_cost : null,
    serpFeatures: Array.isArray(kd?.serp_info?.serp_item_types) ? kd.serp_info.serp_item_types : [],
    itemType: mapItemType(serp?.type),
    url,
    updatedAt: kd?.serp_info?.last_updated_time ?? null,
    isNew: item.ranked_serp_element?.is_new === true,
    isLost: item.ranked_serp_element?.is_lost === true,
  };
}

export async function fetchRankedKeywordsRaw(opts: {
  target: string;
  country?: string;
  languageCode?: string;
  limit?: number;
}): Promise<RankedKeywordsProviderResult> {
  if (!isDataForSeoConfigured()) {
    return {
      keywords: [],
      totalCount: 0,
      currentBuckets: { top3: 0, '4_10': 0, '11_20': 0, '21_50': 0, '51_100': 0, serp_features: 0 },
      currentTraffic: 0,
      currentTrafficCost: 0,
    };
  }

  const result = await dfsPostResult<RankedKeywordsResult>(
    '/dataforseo_labs/google/ranked_keywords/live',
    {
      target: normalizeTargetDomain(opts.target),
      location_code: locationCodeFor(opts.country),
      language_code: toDfsLanguageCode(opts.languageCode, 'en'),
      limit: Math.min(opts.limit ?? ORGANIC_FETCH_LIMIT, 1000),
      item_types: ['organic', 'featured_snippet', 'local_pack', 'ai_overview_reference'],
      order_by: ['keyword_data.keyword_info.search_volume,desc'],
      load_rank_absolute: true,
    },
  );

  const keywords = (result.items ?? [])
    .map(mapRow)
    .filter((r): r is ProviderKeywordRow => r != null);

  const organic = result.metrics?.organic;
  const fsCount = result.metrics?.featured_snippet?.count ?? 0;
  const lpCount = result.metrics?.local_pack?.count ?? 0;

  // Semrush Keywords = organic top-100 count (not total_count across SERP features).
  const organicCount = typeof organic?.count === 'number'
    ? organic.count
    : typeof result.total_count === 'number'
      ? result.total_count
      : keywords.length;

  return {
    keywords,
    totalCount: organicCount,
    currentBuckets: bucketsFromMetrics(organic, fsCount + lpCount),
    // Traffic = expected monthly organic visits (ETV). Traffic Cost = Ads equivalent.
    currentTraffic: organic?.etv ?? keywords.reduce((s, k) => s + (k.traffic ?? 0), 0),
    currentTrafficCost: organic?.estimated_paid_traffic_cost
      ?? keywords.reduce((s, k) => s + (k.trafficCost ?? 0), 0),
  };
}

export { isDataForSeoConfigured };
