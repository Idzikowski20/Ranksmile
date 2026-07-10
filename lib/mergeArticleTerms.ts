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
