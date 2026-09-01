/** Shared GSC (Google Search Console) utility functions */

export type GscKeywordRow = {
  keyword: string;
  page?: string;
  clicks?: number;
  impressions?: number;
  position?: number;
};

export function normalizeUrlForMatch(url: string): string {
   try {
      return new URL(url).pathname.toLowerCase().replace(/\/+$/, '') || '/';
   } catch {
      return url.toLowerCase().replace(/\/+$/, '') || '/';
   }
}

export function kwScore(kw: { clicks?: number; impressions?: number; position?: number }): number {
   const clicks = kw.clicks ?? 0;
   const impressions = kw.impressions ?? 0;
   const position = kw.position ?? 0;
   return clicks * 2 + impressions * 0.1 + (position > 0 ? (1 / position) * 100 : 0);
}

/** Best GSC keyword per normalized page URL (highest kwScore wins). */
export function buildGscUrlKeywordMap(rows: GscKeywordRow[]): Map<string, GscKeywordRow> {
   const map = new Map<string, GscKeywordRow>();
   for (const row of rows) {
      if (!row.page || !row.keyword) continue;
      const key = normalizeUrlForMatch(row.page);
      const candidate: GscKeywordRow = {
         keyword: row.keyword,
         page: row.page,
         clicks: row.clicks ?? 0,
         impressions: row.impressions ?? 0,
         position: row.position ?? 0,
      };
      const prev = map.get(key);
      if (!prev || kwScore(candidate) > kwScore(prev)) {
         map.set(key, candidate);
      }
   }
   return map;
}

/** URL path → keyword string (for inferPageKeyword). */
export function buildGscUrlKeywordStrings(rows: GscKeywordRow[]): Map<string, string> {
   return new Map([...buildGscUrlKeywordMap(rows).entries()].map(([k, v]) => [k, v.keyword]));
}

/** Full URL or path → pathname ("https://x.pl/blog/" → "/blog"). */
export function toPath(url: string): string {
   if (!url) return '';
   try {
      const p = (url.startsWith('http') ? new URL(url).pathname : url).replace(/\/+$/, '');
      return p === '' ? '/' : p;
   } catch { return url; }
}

export type GscPage = { path: string; url: string; keyword: string; clicks: number; impressions: number };

/**
 * GSC query rows → one row per page: clicks/impressions summed across queries and the
 * best-performing query kept as the page's keyword. `exclude` drops already-tracked paths.
 */
export function aggregateGscPages(
   items: Array<{ page?: string; keyword?: string; clicks?: number; impressions?: number }>,
   exclude?: Set<string>,
): GscPage[] {
   const map = new Map<string, GscPage & { best: number }>();
   items.forEach((it) => {
      if (!it.page) return;
      const path = toPath(it.page);
      if (!path || exclude?.has(path)) return;
      const e = map.get(path) || { path, url: it.page, keyword: it.keyword || '', clicks: 0, impressions: 0, best: -1 };
      e.clicks += it.clicks || 0;
      e.impressions += it.impressions || 0;
      const score = (it.clicks || 0) * 10 + (it.impressions || 0);
      if (score > e.best) { e.best = score; e.keyword = it.keyword || e.keyword; e.url = it.page; }
      map.set(path, e);
   });
   return [...map.values()].map(({ best, ...page }) => page);
}
