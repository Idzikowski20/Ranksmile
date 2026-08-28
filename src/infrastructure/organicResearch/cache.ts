import { cached, TTL } from '@/src/infrastructure/cache/fileCache';
import type { DatasetCacheMeta, OrganicDataset } from '@/src/infrastructure/organicResearch/types';
import {
  DATASET_VERSION,
  ORGANIC_CACHE_TTL_MS,
  PROVIDER_VERSION_DATAFORSEO,
  PROVIDER_VERSION_GSC,
  PROVIDER_VERSION_HYBRID,
} from '@/src/infrastructure/organicResearch/types';

export type CachedOrganicEnvelope = {
  meta: DatasetCacheMeta;
  dataset: OrganicDataset;
};

export function buildCacheMeta(opts: {
  provider: 'dataforseo' | 'gsc' | 'hybrid';
  locale: DatasetCacheMeta['locale'];
  ttlMs?: number;
  providerVersion?: string;
}): DatasetCacheMeta {
  const fetchedAt = new Date().toISOString();
  const ttl = opts.ttlMs ?? ORGANIC_CACHE_TTL_MS;
  return {
    fetchedAt,
    expiresAt: new Date(Date.now() + ttl).toISOString(),
    provider: opts.provider,
    providerVersion: opts.providerVersion
      ?? (opts.provider === 'gsc'
        ? PROVIDER_VERSION_GSC
        : opts.provider === 'hybrid'
          ? PROVIDER_VERSION_HYBRID
          : PROVIDER_VERSION_DATAFORSEO),
    datasetVersion: DATASET_VERSION,
    locale: opts.locale,
  };
}

export async function loadCachedDataset(
  cacheKey: unknown[],
  producer: () => Promise<OrganicDataset>,
): Promise<OrganicDataset> {
  return cached({
    namespace: 'organic-dataset',
    key: [DATASET_VERSION, PROVIDER_VERSION_DATAFORSEO, ...cacheKey],
    ttlMs: TTL.RANKED_KEYWORDS,
    producer,
  });
}
