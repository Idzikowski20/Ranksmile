/**
 * Hybrid OrganicDataset: DataForSEO Labs (Semrush-like chart/keywords/ETV/cost)
 * + optional GSC enrich (real clicks).
 */
import Domain from '../../database/models/domain';
import { getDomainLocale } from '../domainLanguage';
import { isDataForSeoConfigured } from '../../providers/dataforseo/organic';
import { loadCachedDataset } from './cache';
import { dataforseoOrganicProvider, defaultProviderContext } from './dataforseoProvider';
import { loadOrganicDatasetFromGsc } from './gscProvider';
import {
  DATASET_VERSION,
  PROVIDER_VERSION_HYBRID,
  type OrganicDataset,
} from './types';

export type HybridLoadResult =
  | { ok: true; dataset: OrganicDataset; gscConnected: boolean }
  | { ok: false; needsDfs: true; error?: string };

export async function loadHybridOrganicDataset(opts: {
  domainId: number;
  userId?: string | null;
}): Promise<HybridLoadResult> {
  if (!isDataForSeoConfigured()) {
    return {
      ok: false,
      needsDfs: true,
      error: 'DataForSEO is not configured. Set credentials for Organic Research data.',
    };
  }

  const domain = await Domain.findByPk(opts.domainId);
  if (!domain) throw new Error('Domain not found');
  const hostname = String(domain.domain || '');
  const locale = await getDomainLocale(opts.domainId);
  const ctx = defaultProviderContext(hostname, locale.countryCode, locale.languageCode);

  const dfsDataset = await loadCachedDataset(
    [ctx.domain, ctx.country, ctx.languageCode, ctx.locationCode, 'hybrid-base'],
    () => dataforseoOrganicProvider.fetchDataset(ctx),
  );

  let gscConnected = false;
  let enriched: OrganicDataset = {
    ...dfsDataset,
    meta: {
      ...dfsDataset.meta,
      provider: 'hybrid',
      providerVersion: PROVIDER_VERSION_HYBRID,
      datasetVersion: DATASET_VERSION,
      gscConnected: false,
    },
    metrics: {
      ...dfsDataset.metrics,
      gscClicks: null,
      gscClicksDeltaPct: null,
    },
  };

  try {
    const gsc = await loadOrganicDatasetFromGsc({
      domainId: opts.domainId,
      userId: opts.userId,
    });
    if (gsc.ok) {
      gscConnected = true;
      enriched = {
        ...enriched,
        meta: { ...enriched.meta, gscConnected: true },
        metrics: {
          ...enriched.metrics,
          gscClicks: gsc.dataset.metrics.traffic,
          gscClicksDeltaPct: gsc.dataset.metrics.trafficDeltaPct,
        },
      };
    }
  } catch {
    // GSC enrich is optional — keep DFS dataset
  }

  return { ok: true, dataset: enriched, gscConnected };
}
