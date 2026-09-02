import { tokenize, wordMatch } from '@/src/core/domain/terms/termMatch';

const AI_STOP = new Set([
  'jak', 'czy', 'co', 'ile', 'gdzie', 'kiedy', 'dlaczego', 'które', 'która', 'który',
  'jakie', 'jaki', 'oraz', 'dla', 'the', 'and', 'for', 'what', 'how', 'why', 'where', 'when', 'who',
]);

/**
 * Body-token index for one article: the exact-match set plus first-4-char buckets. Every
 * caller scores many facts against the SAME article in a loop (computeAiSearchScoreV2 over
 * all facts, loadDaFactSeeds over up to 40 claims, factsToVisibilitySummary), so tokenize
 * once and reuse. `wordMatch` only returns true when two tokens share a ≥4-char prefix, so
 * candidates for a fact word live entirely in its own first-4 bucket — no full scan.
 */
let bodyIndexCache: { text: string; set: Set<string>; buckets: Map<string, string[]> } | null = null;

function bodyIndex(articleText: string): { set: Set<string>; buckets: Map<string, string[]> } {
  if (bodyIndexCache && bodyIndexCache.text === articleText) return bodyIndexCache;
  const set = new Set(tokenize(articleText));
  const buckets = new Map<string, string[]>();
  for (const t of set) {
    if (t.length < 4) continue;
    const key = t.slice(0, 4);
    const arr = buckets.get(key);
    if (arr) arr.push(t);
    else buckets.set(key, [t]);
  }
  bodyIndexCache = { text: articleText, set, buckets };
  return bodyIndexCache;
}

/**
 * Token overlap readiness — client-safe. Inflection-tolerant: a fact word counts as
 * covered if the article has the exact token OR an inflected form (wordMatch, prefix ≥4),
 * the same matcher the SEO term scorer uses. Exact set membership under-credited Polish
 * badly — the article states a fact in declined/paraphrased form ("asertywność … pomagają"
 * for the fact "asertywność … metodą … przeciwdziałania") and scored it a miss. On the
 * reference "szantaż emocjonalny" article this lifts covered facts 20→39 of 44.
 */
export function factReadinessScore(articleText: string, factText: string): number {
  const { set, buckets } = bodyIndex(articleText);
  const words = tokenize(factText).filter((w) => w.length >= 4 && !AI_STOP.has(w));
  if (!words.length) return 0;
  const matched = words.filter(
    (w) => set.has(w) || (buckets.get(w.slice(0, 4)) || []).some((b) => wordMatch(b, w)),
  ).length;
  return Math.round((matched / words.length) * 100);
}
