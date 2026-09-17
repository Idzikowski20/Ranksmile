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

export type DomainArticleRow = { title?: string | null; target_keyword?: string | null; [k: string]: unknown };

/** Every article of a domain (the list API caps a page at 100), e.g. to know which topics are covered. */
export async function fetchAllDomainArticles<T extends object = DomainArticleRow>(slug: string): Promise<{ articles: T[] }> {
   const articles: T[] = [];
   // ponytail: hard stop at 50 pages (5000 articles) so a bad `hasMore` can't loop forever.
   for (let page = 0; page < 50; page += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await fetch(`/api/articles?domain=${encodeURIComponent(slug)}&limit=100&offset=${articles.length}`);
      // eslint-disable-next-line no-await-in-loop
      const d = (await res.json().catch(() => ({}))) as { articles?: T[]; hasMore?: boolean };
      const batch = d.articles || [];
      articles.push(...batch);
      if (!d.hasMore || batch.length === 0) break;
   }
   return { articles };
}

/** A single article record. Disabled until `id` is known. */
export function useArticle(id: string | number | undefined) {
   return useQuery(
      ['article', id],
      () => fetchArticle(id as string | number),
      { enabled: !!id, staleTime: 30_000 },
   );
}
