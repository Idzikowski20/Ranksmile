import { CoverageItem, CoverageSnapshot, computeCoverageScores } from '../../aiCoverage';

/** Marginal `overall` gain if `item` went to fully-covered (covered:true, quality:5), all else fixed.
 *  Pure — reuses A's scorer on a hypothetical graded-items array; NO judge round-trip. Integer. */
export function scoreContribution(item: CoverageItem, snapshot: CoverageSnapshot): number {
  const maxed: CoverageItem[] = snapshot.items.map((it) =>
    it.id === item.id ? { ...it, covered: true, quality: 5 } : it);
  const early = item.id === 'intent-answer-early' ? true : snapshot.answersMainQuestionEarly;
  const hypothetical = computeCoverageScores(maxed, early).overall;   // already rounded by A's scorer
  return Math.max(0, Math.round(hypothetical - snapshot.overall));    // explicit round guard
}
