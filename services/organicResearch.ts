import { useQuery, UseQueryResult } from 'react-query';
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
