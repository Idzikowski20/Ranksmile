// __tests__/lib/aiCoverage.test.ts
import {
  computeCoverageScores, computeBucketScore, blendBuckets, earlyAnswerBonus,
  CoverageItem,
} from '../../lib/aiCoverage';

// GRADED item factory — the scorer works on graded items (covered/quality baked in), NOT CoverageResult.
const gi = (
  id: string,
  covered: boolean,
  quality: number,
  category: CoverageItem['category'] = 'knowledge',
  importance: CoverageItem['importance'] = 'recommended',
): CoverageItem => ({
  id, label: id, type: 'paa', category, importance,
  source: 'paa', covered, quality,
});

describe('computeCoverageScores', () => {
  it('no items → overall 0, 5 empty buckets (intent/knowledge/authority/quality/style)', () => {
    const { overall, buckets } = computeCoverageScores([], false);
    expect(overall).toBe(0);
    expect(buckets.map((b) => b.key)).toEqual(['intent', 'knowledge', 'authority', 'quality', 'style']);
    expect(buckets.every((b) => b.score === 0 && b.items === 0)).toBe(true);
  });
  it('all covered q5 + early → overall 100', () => {
    const items = [gi('a', true, 5, 'knowledge'), gi('b', true, 5, 'intent', 'critical')];
    expect(computeCoverageScores(items, true).overall).toBe(100);
  });
  it('all covered q5, no early → overall 85', () => {
    const items = [gi('a', true, 5, 'knowledge'), gi('b', true, 5, 'intent', 'critical')];
    expect(computeCoverageScores(items, false).overall).toBe(85);
  });
  it('quality matters: single knowledge item covered q1 → bucket score 20', () => {
    const { buckets } = computeCoverageScores([gi('a', true, 1, 'knowledge')], false);
    expect(buckets.find((b) => b.key === 'knowledge')?.score).toBe(20);
  });
  it('empty bucket contributes 0 weight (paa-only article not dragged by empty intent)', () => {
    const { overall, buckets } = computeCoverageScores([gi('a', true, 5, 'knowledge')], false);
    expect(overall).toBe(85);                 // knowledge fully covered, no early
    expect(buckets.find((b) => b.key === 'intent')?.items).toBe(0);
    expect(buckets.find((b) => b.key === 'intent')?.score).toBe(0);
  });
  it('per-bucket importance weighting: critical covered + optional uncovered → knowledge bucket 75', () => {
    const items = [gi('a', true, 5, 'knowledge', 'critical'), gi('b', false, 0, 'knowledge', 'optional')];
    // earned = 3×1 = 3 ; max = 3+1 = 4 ; 3/4 = 75
    expect(computeCoverageScores(items, false).buckets.find((b) => b.key === 'knowledge')?.score).toBe(75);
  });
});

// The swappable helpers are exported + tested in isolation so weight/algorithm changes
// can't silently break the blend (3rd-review risk). They read graded items — no verdict map (4th-review).
describe('scoring helpers (isolated)', () => {
  it('computeBucketScore: only counts items in its category; empty → max 0, score 0', () => {
    const items = [gi('a', true, 5, 'knowledge'), gi('b', true, 5, 'intent', 'critical')];
    const empty = computeBucketScore('authority', items);
    expect(empty.items).toBe(0);
    expect(empty.max).toBe(0);
    expect(empty.score).toBe(0);
    const knowledge = computeBucketScore('knowledge', items);
    expect(knowledge.items).toBe(1);
    expect(knowledge.covered).toBe(1);
    expect(knowledge.score).toBe(100);
  });

  it('blendBuckets: weights buckets by BucketScore.weight; all-empty → 0', () => {
    expect(blendBuckets([])).toBe(0);
    const buckets = computeCoverageScores([gi('a', true, 5, 'knowledge')], false).buckets;
    // knowledge fully covered, all other buckets empty (weight-0 contribution) → base 85
    expect(Math.round(blendBuckets(buckets))).toBe(85);
  });

  it('earlyAnswerBonus: 15 when flagged, 0 otherwise', () => {
    expect(earlyAnswerBonus(true)).toBe(15);
    expect(earlyAnswerBonus(false)).toBe(0);
  });
});
