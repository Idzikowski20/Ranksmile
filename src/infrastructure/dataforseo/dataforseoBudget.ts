/**
 * DataForSEO cost-control defaults for SERP crawls.
 * @see https://dataforseo.com/blog/budget-friendly-rank-tracking-strategies-with-dataforseo-serp-api
 *
 * Billing is per SERP page crawled — keep depth small, cap pages with
 * max_crawl_pages, and stop early with stop_crawl_on_match when tracking own domain.
 */

/** PAA + related searches live on page 1 — one page is enough. */
export const DFS_SERP_PAA = {
   depth: 10,
   max_crawl_pages: 1,
   people_also_ask_click_depth: 1,
} as const;

/** AI Overview / AI Mode elements appear on the first organic SERP page. */
export const DFS_SERP_AI_ELEMENT = {
   depth: 10,
   max_crawl_pages: 1,
} as const;

/** Labs defaults — 300 covers enrichment; callers can override. */
export const DFS_DEFAULT_KEYWORD_LIMIT = 300;
export const DFS_DEFAULT_RANKED_LIMIT = 80;

export type StopCrawlTarget = {
   match_value: string,
   match_type: 'domain' | 'with_subdomains' | 'wildcard',
};

/** Build stop_crawl_on_match for rank tracking when the target domain is known. */
export function stopCrawlOnDomain(domain: string, withSubdomains = false): StopCrawlTarget[] {
   const d = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '').toLowerCase();
   if (!d) return [];
   return [{ match_value: d, match_type: withSubdomains ? 'with_subdomains' : 'domain' }];
}

/** Merge SERP crawl budget params; optionally stop when own domain is found. */
export function serpCrawlBudget(opts?: { ownDomain?: string, withSubdomains?: boolean }): Record<string, unknown> {
   const base: Record<string, unknown> = { ...DFS_SERP_AI_ELEMENT };
   if (opts?.ownDomain) {
      const targets = stopCrawlOnDomain(opts.ownDomain, opts.withSubdomains);
      if (targets.length) base.stop_crawl_on_match = targets;
   }
   return base;
}
