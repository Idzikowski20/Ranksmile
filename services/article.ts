// Shared react-query access to a single article record (/api/articles/[id]).
// The New-Content wizard steps (content-type → context → writing-mode) each read
// the saved `wizard_state` to resume a draft; this hook fetches once and reuses
// the cached record across those client-side navigations.
import { useQuery } from 'react-query';

import type { RankingSourceEntry } from '@/src/core/shared/types/sidecar';

export type ArticleRecord = {
   id?: number;
   wizard_state?: string | null;
   ranking_sources?: RankingSourceEntry[] | string | null;
   content?: string | null;
   [k: string]: unknown;
};

export async function fetchArticle(id: string | number): Promise<ArticleRecord | null> {
   const res = await fetch(`/api/articles/${id}`);
   const d = await res.json().catch(() => ({}));
   return d.article || null;
}

/** Every title/keyword a domain already covers (all articles and crawled pages), for content ideas. */
export async function fetchCoveredTopics(slug: string): Promise<string[]> {
   const res = await fetch(`/api/articles?domain=${encodeURIComponent(slug)}&covered=1`);
   if (!res.ok) throw new Error('Failed to load covered topics');
   const d = (await res.json()) as { covered?: string[] };
   return d.covered || [];
}

/**
 * Query key for fetchCoveredTopics. Under ['articles', slug], so invalidating a domain's
 * articles refreshes it too.
 */
export const coveredTopicsKey = (slug: string) => ['articles', slug, 'covered'];

/** A single article record. Disabled until `id` is known. */
export function useArticle(id: string | number | undefined) {
   return useQuery(
      ['article', id],
      () => fetchArticle(id as string | number),
      { enabled: !!id, staleTime: 30_000 },
   );
}
