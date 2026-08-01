import { useQuery, UseQueryResult } from 'react-query';
import type { KeywordPositionPoint } from '../lib/organicResearch/keywordHistory';
import type { OrganicDataset } from '../lib/organicResearch/types';
import type { Observation } from '../lib/primitives/types';

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  let body: unknown = null;
  try { body = await r.json(); } catch { /* empty */ }
  if (!r.ok) {
    const msg = (body as { error?: string } | null)?.error || `Request failed (${r.status})`;
    throw new Error(msg);
  }
  return body as T;
}

export type OrganicKeywordHistoryResponse = {
  points: KeywordPositionPoint[];
  source: 'dataforseo' | 'synthetic' | 'empty';
};

export type OrganicApiResponse = {
  dataset: OrganicDataset | null;
  observations: Observation[];
  configured: boolean;
  needsDfs?: boolean;
  needsGsc?: boolean;
  gscConnected?: boolean;
  error?: string;
};

export function useOrganicDataset(slug: string | undefined): UseQueryResult<OrganicApiResponse> {
  return useQuery(
    ['organic-dataset', slug],
    () => fetchJson<OrganicApiResponse>(`/api/rank-tracking/${slug}/organic`),
    {
      enabled: !!slug,
      staleTime: 5 * 60 * 1000,
      keepPreviousData: true,
    },
  );
}

export function organicExportUrl(
  slug: string,
  format: 'csv' | 'json',
  q?: string,
): string {
  const params = new URLSearchParams({ export: format });
  if (q) params.set('q', q);
  return `/api/rank-tracking/${slug}/organic?${params}`;
}

/** Position history for one organic keyword — server file-cache + react-query. */
export function useOrganicKeywordHistory(
  slug: string | undefined,
  keyword: string | undefined,
  meta?: {
    position?: number | null;
    previousPosition?: number | null;
    change30d?: number | null;
    updatedAt?: string | null;
  },
): UseQueryResult<OrganicKeywordHistoryResponse> {
  const params = new URLSearchParams();
  if (keyword) params.set('keyword', keyword);
  if (meta?.position != null) params.set('position', String(meta.position));
  if (meta?.previousPosition != null) params.set('previousPosition', String(meta.previousPosition));
  if (meta?.change30d != null) params.set('change30d', String(meta.change30d));
  if (meta?.updatedAt) params.set('updatedAt', meta.updatedAt);

  return useQuery(
    ['organic-keyword-history', slug, keyword],
    () => fetchJson<OrganicKeywordHistoryResponse>(
      `/api/rank-tracking/${slug}/organic-keyword-history?${params}`,
    ),
    {
      enabled: Boolean(slug && keyword),
      staleTime: 5 * 60 * 1000,
      cacheTime: 30 * 60 * 1000,
    },
  );
}
