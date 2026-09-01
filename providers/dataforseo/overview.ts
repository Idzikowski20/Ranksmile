/**
 * DataForSEO Labs historical_rank_overview — chart + metric deltas (provider shape).
 */
import { toDfsLanguageCode } from '../../lib/domainLanguagePrompts';
import type { ProviderOverviewPoint } from '../../lib/organicResearch/types';
import {
  dfsPostResult,
  isDataForSeoConfigured,
  locationCodeFor,
  normalizeTargetDomain,
} from './client';

type MetricsBlock = {
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
};

type HistoryItem = {
  year?: number;
  month?: number;
  metrics?: {
    organic?: MetricsBlock;
    featured_snippet?: MetricsBlock;
    local_pack?: MetricsBlock;
  };
};

type HistoricalResult = {
  items?: HistoryItem[];
};

function toPoint(item: HistoryItem): ProviderOverviewPoint | null {
  const y = item.year;
  const m = item.month;
  if (typeof y !== 'number' || typeof m !== 'number') return null;
  const organic = item.metrics?.organic;
  const fs = item.metrics?.featured_snippet?.count ?? 0;
  const lp = item.metrics?.local_pack?.count ?? 0;
  const top3 = (organic?.pos_1 ?? 0) + (organic?.pos_2_3 ?? 0);
  const pos21_50 = (organic?.pos_21_30 ?? 0) + (organic?.pos_31_40 ?? 0) + (organic?.pos_41_50 ?? 0);
  const pos51_100 = (organic?.pos_51_60 ?? 0) + (organic?.pos_61_70 ?? 0) + (organic?.pos_71_80 ?? 0)
    + (organic?.pos_81_90 ?? 0) + (organic?.pos_91_100 ?? 0);
  const date = `${y}-${String(m).padStart(2, '0')}-01`;
  return {
    date,
    keywordCount: organic?.count ?? 0,
    traffic: organic?.etv ?? 0,
    trafficCost: organic?.estimated_paid_traffic_cost ?? 0,
    top3,
    pos4_10: organic?.pos_4_10 ?? 0,
    pos11_20: organic?.pos_11_20 ?? 0,
    pos21_50,
    pos51_100,
    serpFeatures: fs + lp,
  };
}

export async function fetchHistoricalRankOverview(opts: {
  target: string;
  country?: string;
  languageCode?: string;
  dateFrom?: string;
}): Promise<ProviderOverviewPoint[]> {
  if (!isDataForSeoConfigured()) return [];

  const dateFrom = opts.dateFrom || (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 2);
    return d.toISOString().slice(0, 10);
  })();

  const result = await dfsPostResult<HistoricalResult>(
    '/dataforseo_labs/google/historical_rank_overview/live',
    {
      target: normalizeTargetDomain(opts.target),
      location_code: locationCodeFor(opts.country),
      language_code: toDfsLanguageCode(opts.languageCode, 'en'),
      date_from: dateFrom,
      correlate: true,
    },
  );

  return (result.items ?? [])
    .map(toPoint)
    .filter((p): p is ProviderOverviewPoint => p != null)
    .sort((a, b) => a.date.localeCompare(b.date));
}
