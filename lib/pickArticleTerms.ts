import type { NlpTerm } from './contentScore';
import { filterUsefulNlpTerms, isWeakTermList } from './competitorTermCalibration';
import { filterNlpTermsForAnalysis, filterOnTopicTerms } from './topicRelevance';

export function mergeNlpTerms(existing: NlpTerm[], incoming: NlpTerm[]): NlpTerm[] {
  const map = new Map<string, NlpTerm>();
  for (const t of existing) {
    const k = t.term.toLowerCase().trim();
    if (k) map.set(k, t);
  }
  for (const t of incoming) {
    const k = t.term.toLowerCase().trim();
    if (!k) continue;
    const prev = map.get(k);
    map.set(k, prev && (prev.target_count || 0) >= (t.target_count || 0) ? prev : t);
  }
  return Array.from(map.values());
}

/** Prefer deep-analysis terms when sidecar SERP terms are thin PK splits. */
export function pickTermsForGeneratedArticle(
  existingTerms: NlpTerm[],
  incomingTerms: NlpTerm[],
  keyword: string,
): NlpTerm[] {
  const existing = filterOnTopicTerms(filterUsefulNlpTerms(existingTerms), keyword);
  const incoming = filterNlpTermsForAnalysis(filterUsefulNlpTerms(incomingTerms), keyword);

  if (!isWeakTermList(incoming, keyword)) {
    return mergeNlpTerms(existing, incoming);
  }
  if (!isWeakTermList(existing, keyword)) {
    return existing;
  }
  return mergeNlpTerms(existing, incoming);
}
