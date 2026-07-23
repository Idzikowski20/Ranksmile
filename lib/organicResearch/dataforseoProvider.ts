import { fetchRankedKeywordsRaw, isDataForSeoConfigured } from '../../providers/dataforseo/organic';
import { fetchHistoricalRankOverview } from '../../providers/dataforseo/overview';
import { locationCodeFor } from '../../providers/dataforseo/client';
import { buildCacheMeta } from './cache';
import {
  buildChart,
  buildMetrics,
  buildPages,
  buildUncategorizedTopic,
  emptyBuckets,
  mapKeywords,
} from './derive';
import type { OrganicProvider, OrganicProviderContext } from './provider';
import { localeFromCtx } from './provider';
import type { OrganicDataset, ProviderOrganicPayload } from './types';

function assembleDataset(payload: ProviderOrganicPayload): OrganicDataset {
  const localeKey = `${payload.locale.country}:${payload.locale.language}`;
  const keywords = mapKeywords(payload.domain, localeKey, payload.keywords);
  const meta = buildCacheMeta({ provider: 'dataforseo', locale: payload.locale });
  return {
    domain: payload.domain,
    meta,
    metrics: buildMetrics(payload),
    chart: buildChart(payload.overview),
    keywords,
    pages: buildPages(keywords),
    topics: buildUncategorizedTopic(keywords),
    entities: [],
  };
}

async function fetchDataset(ctx: OrganicProviderContext): Promise<OrganicDataset> {
  const locale = localeFromCtx(ctx);
  if (!isDataForSeoConfigured()) {
    return assembleDataset({
      domain: ctx.domain,
      locale,
      keywords: [],
      totalCount: 0,
      overview: [],
      currentBuckets: emptyBuckets(),
      currentTraffic: 0,
      currentTrafficCost: 0,
    });
  }

  const [ranked, overview] = await Promise.all([
    fetchRankedKeywordsRaw({
      target: ctx.domain,
      country: ctx.country,
      languageCode: ctx.languageCode,
    }),
    fetchHistoricalRankOverview({
      target: ctx.domain,
      country: ctx.country,
      languageCode: ctx.languageCode,
    }).catch(() => [] as Awaited<ReturnType<typeof fetchHistoricalRankOverview>>),
  ]);

  return assembleDataset({
    domain: ctx.domain,
    locale,
    keywords: ranked.keywords,
    totalCount: ranked.totalCount,
    overview,
    currentBuckets: ranked.currentBuckets,
    currentTraffic: ranked.currentTraffic,
    currentTrafficCost: ranked.currentTrafficCost,
  });
}

export const dataforseoOrganicProvider: OrganicProvider = {
  id: 'dataforseo',
  isConfigured: isDataForSeoConfigured,
  fetchDataset,
};

export function defaultProviderContext(
  domain: string,
  countryCode?: string | null,
  languageCode?: string | null,
): OrganicProviderContext {
  const c = (countryCode || 'US').toUpperCase().slice(0, 2);
  const lang = (languageCode || 'en').toLowerCase().slice(0, 2);
  return {
    domain: domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '').toLowerCase(),
    country: c,
    languageCode: lang,
    locationCode: locationCodeFor(c),
  };
}
