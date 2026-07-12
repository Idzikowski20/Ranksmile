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
