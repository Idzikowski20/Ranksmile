import Domain from '@/database/models/domain';
import { getDomainLocale } from '@/src/infrastructure/domainLanguage';
import { loadCachedDataset } from '@/src/infrastructure/organicResearch/cache';
import { dataforseoOrganicProvider, defaultProviderContext } from '@/src/infrastructure/organicResearch/dataforseoProvider';
import { isDataForSeoConfigured } from '@/providers/dataforseo/organic';
import { loadHybridOrganicDataset, type HybridLoadResult } from '@/src/infrastructure/organicResearch/hybrid';
import {
  filterKeywords,
  paginateKeywords,
  sortKeywords,
  type OrganicFilters,
  type OrganicSortKey,
} from '@/src/infrastructure/organicResearch/filter';
import { keywordsToObservations } from '@/src/infrastructure/organicResearch/observations';
import type { OrganicDataset, OrganicKeyword } from '@/src/infrastructure/organicResearch/types';
import { runExport, type ExportFormat } from '@/src/infrastructure/organicResearch/export';

export type { OrganicDataset, OrganicKeyword } from '@/src/infrastructure/organicResearch/types';
export type { OrganicFilters, OrganicSortKey, OrganicTab } from '@/src/infrastructure/organicResearch/filter';
export { exportProviders, runExport } from '@/src/infrastructure/organicResearch/export';
export { keywordsToObservations } from '@/src/infrastructure/organicResearch/observations';
export type { HybridLoadResult } from '@/src/infrastructure/organicResearch/hybrid';

export async function loadOrganicDataset(opts: {
  domainId: number;
  domainHostname: string;
  countryCode?: string | null;
  languageCode?: string | null;
}): Promise<OrganicDataset> {
  const ctx = defaultProviderContext(opts.domainHostname, opts.countryCode, opts.languageCode);
  return loadCachedDataset(
    [ctx.domain, ctx.country, ctx.languageCode, ctx.locationCode],
    () => dataforseoOrganicProvider.fetchDataset(ctx),
  );
}

/** Search Intelligence — hybrid (DFS Labs + optional GSC clicks). */
export async function loadOrganicDatasetForDomainId(
  domainId: number,
  userId?: string | null,
): Promise<HybridLoadResult> {
  return loadHybridOrganicDataset({ domainId, userId });
}

export async function loadOrganicDatasetFromDfsForDomainId(domainId: number): Promise<OrganicDataset> {
  const domain = await Domain.findByPk(domainId);
  if (!domain) throw new Error('Domain not found');
  const hostname = String(domain.domain || '');
  const locale = await getDomainLocale(domainId);
  return loadOrganicDataset({
    domainId,
    domainHostname: hostname,
    countryCode: locale.countryCode,
    languageCode: locale.languageCode,
  });
}

export function viewOrganicTable(
  dataset: OrganicDataset,
  opts: {
    filters?: OrganicFilters;
    sort?: OrganicSortKey;
    order?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
  } = {},
): {
  rows: OrganicKeyword[];
  total: number;
  page: number;
  pageSize: number;
} {
  const filtered = filterKeywords(dataset.keywords, opts.filters || {});
  const sorted = sortKeywords(filtered, opts.sort || 'traffic', opts.order || 'desc');
  return paginateKeywords(sorted, opts.page || 1, opts.pageSize || 50);
}

export function exportOrganic(
  dataset: OrganicDataset,
  format: ExportFormat,
  filters?: OrganicFilters,
): { ok: true; body: string; contentType: string } | { ok: false; error: string } {
  const rows = filterKeywords(dataset.keywords, filters || {});
  return runExport(format, rows, dataset);
}

export function isOrganicProviderConfigured(): boolean {
  return isDataForSeoConfigured();
}

export function getOrganicObservations(dataset: OrganicDataset, domainId?: number) {
  return keywordsToObservations(dataset, { domainId });
}
