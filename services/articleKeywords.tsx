// Shared react-query access to an article's keyword rows
// (/api/articles/[id]/keywords). Several places in the editor read these — the
// breadcrumb popover, the internal-links panel and the NLP keywords section —
// so this hook fetches once and dedupes across all of them.
import { useQuery } from 'react-query';

export type ArticleKeyword = {
   keyword: string;
   is_covered?: boolean;
   gsc_position?: number | null;
   ads_monthly_volume?: number | null;
   ads_competition?: string | null;
   [k: string]: unknown;
};

export async function fetchArticleKeywords(id: string | number): Promise<ArticleKeyword[]> {
   const res = await fetch(`/api/articles/${id}/keywords`);
   const d = await res.json().catch(() => ({}));
   return d.keywords || [];
}

/** Article keyword rows. Disabled until `id` is known; pass enabled=false to defer. */
export function useArticleKeywords(id: string | string[] | number | undefined, enabled = true) {
   return useQuery(
      ['article-keywords', id],
      () => fetchArticleKeywords(id as string | number),
      { enabled: !!id && enabled, staleTime: 60_000 },
   );
}
