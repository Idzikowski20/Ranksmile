import type { NlpTerm } from './contentScore';
import { filterUsefulNlpTerms } from './competitorTermCalibration';
import { mergeNlpTerms } from './pickArticleTerms';
import type { ArticleTermRow } from './articleTerms';

/** Merge score_data.terms with article_terms — never prefer the thinner list. */
export function mergeArticleTermSources(opts: {
  scoreDataTerms?: NlpTerm[];
  tableTerms?: ArticleTermRow[];
}): NlpTerm[] {
  const fromScore = filterUsefulNlpTerms(opts.scoreDataTerms ?? []);
  const fromTable = filterUsefulNlpTerms(
    (opts.tableTerms ?? []).map((r) => ({
      term: r.term,
      target_count: r.importance || r.target_max || 1,
      suggested_min: r.target_min,
      suggested_max: r.target_max,
      current_count: r.current_count,
    })),
  );
  return mergeNlpTerms(fromTable, fromScore);
}

/** Terms list for Auto-Optimize — useful NLP only, no strict seed-token filter. */
export function termsForOptimize(opts: {
  scoreDataTerms?: NlpTerm[];
  tableTerms?: ArticleTermRow[];
}): NlpTerm[] {
  return mergeArticleTermSources(opts);
}

/**
 * NLP terms an article must weave in, strongest first.
 *
 * Shared by the Write Engine (round-robin across paragraph plans) and the outline brief
 * writer (terms handed to the model as a list to distribute), so the two cannot disagree
 * about which vocabulary the article is being graded on.
 */
export function importantTermsFromScoreData(
  scoreData: Record<string, unknown> | null | undefined,
  max = 24,
): string[] {
  const raw = scoreData && Array.isArray(scoreData.terms) ? (scoreData.terms as NlpTerm[]) : [];
  return mergeArticleTermSources({ scoreDataTerms: raw })
    .slice(0, max)
    .map((t) => t.term)
    .filter(Boolean);
}
