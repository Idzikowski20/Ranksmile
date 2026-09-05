/**
 * How much one section edit may add, from the article's own length target (the SERP
 * average the analysis stored as words_target / words_max). Bundles used to size
 * themselves from their item count alone, so an article already at target still grew by
 * up to 300 words per section (163: 1080 → 2223 words in one run).
 */
export type ArticleWords = { current: number; target: number; max: number };

const MIN_GROWTH = 40;
const MAX_GROWTH = 300;
/** Weaving terms and facts into existing sentences needs this much even at target. */
const WEAVE_ONLY = 60;
const AT_MAX = 20;

/** The SERP maximum is one outlier page away from nonsense (5648 for a 1692-word target):
 *  the ceiling never exceeds 1.5× the target. */
const MAX_OVER_TARGET = 1.5;

export function articleWordsFromScoreData(
  scoreData: { words_target?: number; words_max?: number } | null | undefined,
  current: number,
): ArticleWords | null {
  const target = Number(scoreData?.words_target ?? 0);
  if (!(target > 0)) return null;
  const bound = Math.round(target * MAX_OVER_TARGET);
  const serpMax = Number(scoreData?.words_max ?? 0);
  const max = serpMax > 0 ? Math.min(serpMax, bound) : bound;
  return { current, target, max };
}

export function sectionGrowthAllowance(opts: ArticleWords & { sections: number }): number {
  const sections = Math.max(1, opts.sections);
  if (opts.max > 0 && opts.current >= opts.max) return AT_MAX;
  const headroom = opts.target - opts.current;
  if (headroom <= 0) return WEAVE_ONLY;
  const share = Math.round((headroom * 1.15) / sections);
  return Math.min(MAX_GROWTH, Math.max(MIN_GROWTH, share));
}
