// Shared react-query access to a single article record (/api/articles/[id]).
// The New-Content wizard steps (content-type → context → writing-mode) each read
// the saved `wizard_state` to resume a draft; this hook fetches once and reuses
// the cached record across those client-side navigations.
import { useQuery } from 'react-query';

import type { RankingSourceEntry } from '../lib/types/sidecar';

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

/** A single article record. Disabled until `id` is known. */
export function useArticle(id: string | number | undefined) {
   return useQuery(
      ['article', id],
      () => fetchArticle(id as string | number),
      { enabled: !!id, staleTime: 30_000 },
   );
}
