import { tokenize, wordMatch } from '@/src/core/domain/terms/termMatch';

const AI_STOP = new Set([
  'jak', 'czy', 'co', 'ile', 'gdzie', 'kiedy', 'dlaczego', 'które', 'która', 'który',
  'jakie', 'jaki', 'oraz', 'dla', 'the', 'and', 'for', 'what', 'how', 'why', 'where', 'when', 'who',
]);

/**
 * Token overlap readiness — client-safe. Inflection-tolerant: a fact word counts as
 * covered if the article has the exact token OR an inflected form (wordMatch, prefix ≥4),
 * the same matcher the SEO term scorer uses. Exact set membership under-credited Polish
 * badly — the article states a fact in declined/paraphrased form ("asertywność … pomagają"
 * for the fact "asertywność … metodą … przeciwdziałania") and scored it a miss. On the
 * reference "szantaż emocjonalny" article this lifts covered facts 20→39 of 44.
 */
export function factReadinessScore(articleText: string, factText: string): number {
  const bodyTokens = tokenize(articleText);
  const bodySet = new Set(bodyTokens);
  const words = tokenize(factText).filter((w) => w.length >= 4 && !AI_STOP.has(w));
  if (!words.length) return 0;
  const matched = words.filter(
    (w) => bodySet.has(w) || bodyTokens.some((b) => wordMatch(b, w)),
  ).length;
  return Math.round((matched / words.length) * 100);
}
