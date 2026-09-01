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
  opts?: {
    max?: number;
    /**
     * Rows from `article_terms`. Terms activated after the analysis live only there, so
     * omitting them left the Write Engine allocating keywords from a stale list while the
     * editor graded the article against the full one.
     */
    tableTerms?: ArticleTermRow[];
  },
): string[] {
  const max = opts?.max ?? 24;
  const raw = scoreData && Array.isArray(scoreData.terms) ? (scoreData.terms as NlpTerm[]) : [];
  // Ranked before the cut. `mergeNlpTerms` returns Map insertion order — table rows in
  // whatever order the query returned them, then score-data terms — so slicing straight
  // off it dropped whichever strong term happened to land past the cap, and dropped a
  // different one whenever the row order changed.
  return mergeArticleTermSources({ scoreDataTerms: raw, tableTerms: opts?.tableTerms })
    .slice()
    .sort((a, b) => (
      (b.target_count || 0) - (a.target_count || 0)
      || (b.doc_freq || 0) - (a.doc_freq || 0)
      || (b.salience || 0) - (a.salience || 0)
      // Last resort so the same inputs always yield the same list.
      || a.term.localeCompare(b.term)
    ))
    .slice(0, max)
    .map((t) => t.term)
    .filter(Boolean);
}
