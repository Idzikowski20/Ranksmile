/**
 * SERP-first term weight — IDF-like from doc_freq across competitor set.
 * Prefer SERP prevalence over local salience alone.
 */
import type { NlpTerm } from './contentScore';
import { termSalienceWeight } from './termSalienceCore';

export type TermWeightInput = {
  term: string;
  doc_freq?: number;
  target_count?: number;
  salience?: number;
  /** Total competitor docs in corpus (default 10). */
  corpusSize?: number;
};

/** Weight in [0.25, 4] — high doc_freq → higher weight. */
export function termWeight(t: TermWeightInput): number {
  const N = Math.max(1, t.corpusSize ?? 10);
  const df = Math.max(0, t.doc_freq ?? 0);
  const idf = Math.log(1 + N / Math.max(1, df || 0.5));
  // SERP-first: invert classic IDF so frequent-in-SERP terms weigh more
  const serpBoost = 1 + Math.min(2.5, (df / N) * 3);
  const salience = termSalienceWeight({
    term: t.term,
    target_count: t.target_count ?? 1,
    salience: t.salience,
    doc_freq: t.doc_freq,
  } as NlpTerm);
  return Math.min(4, Math.max(0.25, serpBoost * (0.5 + 0.5 * salience) * (0.7 + 0.3 / Math.max(0.5, idf))));
}

export function weightedTermCoverageRatio(
  plainText: string,
  terms: Array<TermWeightInput & { target_count?: number }>,
  countFn: (text: string, term: string) => number,
): number {
  if (!terms.length) return 0;
  let totalW = 0;
  let earned = 0;
  for (const t of terms) {
    const w = termWeight(t) * Math.max(t.target_count ?? 1, 1);
    totalW += w;
    const actual = countFn(plainText, t.term);
    const target = Math.max(t.target_count ?? 1, 1);
    earned += Math.min(actual / target, 1) * w;
  }
  return totalW > 0 ? earned / totalW : 0;
}
