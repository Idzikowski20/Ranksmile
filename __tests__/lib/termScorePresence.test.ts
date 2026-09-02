/** @jest-environment node */
/**
 * The SEO score counts a term by presence, not by hitting its usage band.
 *
 * Measured against Surfer's editor for "szantaż emocjonalny" (content editor
 * 16633552): 21 of 80 recommended terms sat below their serp_usage minimum —
 * `drugą osobę` 3/8, `manipulacji` 6/10, `konsekwencji` 1/4 — and the SEO Content
 * Score was 100. Their own tool text says it outright: serp_usage "is a
 * suggestion, not a goal, and no input to the score". We were grading the band and
 * losing a third of the terms slot on articles Surfer scores as perfect.
 */
import { termScoreFraction, termRangeCoverageFraction } from '@/src/core/domain/competitors/contentScore';

const terms = [
  { term: 'drugą osobę', target_count: 12, suggested_min: 8, suggested_max: 18 },
  { term: 'manipulacji', target_count: 18, suggested_min: 10, suggested_max: 29 },
  { term: 'konsekwencji', target_count: 7, suggested_min: 4, suggested_max: 11 },
  { term: 'czujesz', target_count: 15, suggested_min: 7, suggested_max: 29 },
];

// Every term present exactly once — far below every band.
const body = 'Szantażysta kontroluje drugą osobę przez manipulacji bez konsekwencji, a ty czujesz winę.';

describe('termScoreFraction — presence, not band', () => {
  it('gives full credit to a term that is present but under its band', () => {
    expect(termScoreFraction(body, terms)).toBe(1);
  });

  it('still charges for a term that is absent', () => {
    const absent = [...terms, { term: 'poczucie obowiązku', target_count: 3, suggested_min: 2, suggested_max: 4 }];
    expect(termScoreFraction(body, absent)).toBeCloseTo(4 / 5, 5);
  });

  it('keeps the band model available as a writing suggestion', () => {
    // The bands are not gone — the editor still shows under/over-use — they just
    // no longer decide the score.
    expect(termRangeCoverageFraction(body, terms)).toBeLessThan(1);
  });
});
