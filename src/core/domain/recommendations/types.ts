/**
 * Recommendation engine — Surfer-parity "which pages to optimize next, and in what order".
 *
 * Surfer's Content Audit surfaces two recommendation types: `optimize` (existing pages in
 * striking distance worth re-optimizing) and `write` (topical-map ideas worth writing).
 * We build `optimize` on the GSC snapshots we already store; `write` is a typed seam for a
 * later topical-map/keyword-volume source (DataForSEO).
 */

export type RecommendationType = 'optimize' | 'write';

/** One "optimize" recommendation: an existing page worth re-optimizing, with its opportunity score. */
export interface OptimizeRecommendation {
  type: 'optimize';
  /** GSC page path (or full URL once enriched by the API layer). */
  page: string;
  /** Current-week average position for the page. */
  currentPosition: number;
  /** Previous-week average position, or null when there was no baseline. */
  previousPosition: number | null;
  impressions: number;
  clicks: number;
  /** clicks / impressions, 0 when no impressions. */
  ctr: number;
  /** 0–10 opportunity score, higher = optimize sooner. Ordering key within the type. */
  score: number;
  /** Optional enrichment from our own articles table (page → target keyword / title). */
  keyword?: string;
  pageTitle?: string;
  /** Our internal article id when the page maps to a Ranksmile article, for the Optimize action. */
  articleId?: number;
}
