import { useQuery } from 'react-query';
import type { SeoOverviewPayload } from '../lib/seoOverview/types';

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

export function useSeoOverview(slug: string | undefined) {
  return useQuery<SeoOverviewPayload>(
    ['seo-overview', slug],
    () => fetchJson<SeoOverviewPayload>(`/api/seo-overview/${slug}`),
    { enabled: !!slug, staleTime: 60_000, keepPreviousData: true },
  );
}

export type { SeoOverviewPayload };
