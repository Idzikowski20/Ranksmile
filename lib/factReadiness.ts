import { tokenize } from './termMatch';

const AI_STOP = new Set([
  'jak', 'czy', 'co', 'ile', 'gdzie', 'kiedy', 'dlaczego', 'które', 'która', 'który',
  'jakie', 'jaki', 'oraz', 'dla', 'the', 'and', 'for', 'what', 'how', 'why', 'where', 'when', 'who',
]);

/** Token overlap readiness — same heuristic as legacy PAA path. Client-safe. */
export function factReadinessScore(articleText: string, factText: string): number {
  const bodyTokens = new Set(tokenize(articleText));
  const words = tokenize(factText).filter((w) => w.length >= 4 && !AI_STOP.has(w));
  if (!words.length) return 0;
  const matched = words.filter((w) => bodyTokens.has(w)).length;
  return Math.round((matched / words.length) * 100);
}
