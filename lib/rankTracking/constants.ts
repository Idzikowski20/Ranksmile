/** Current analytics algorithm version — new summaries only; never auto-recompute old rows. */
export const ANALYTICS_VERSION = 'v1' as const;

export const SERP_PROVIDER = 'dataforseo' as const;
export const SERP_PROVIDER_VERSION = 'dataforseo-serp-live-v1' as const;

export const KEYWORD_MAX_ATTEMPTS = 3;

export type RankKeywordStatus =
  | 'queued'
  | 'active'
  | 'running'
  | 'failed'
  | 'paused'
  | 'archived';
