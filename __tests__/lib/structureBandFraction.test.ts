/** @jest-environment node */
/**
 * Structure is graded against the lower edge of the competitor band, not against the
 * average.
 *
 * Measured on Surfer's editor for "szantaż emocjonalny" (content editor 16633552): the
 * heading guideline is a per-word ratio with min 0.004735 / avg 0.008838 / max 0.021044,
 * which at the 2600-word target is a band of 12.3–54.7 and a suggested 23. Their article
 * has 13 headings — 57% of the suggestion, just over the minimum — and scores 100. Ours
 * divided by the average, so the same article would have lost half the structure slot.
 */
import { structureFraction, cohortMin } from '@/src/core/domain/competitors/contentScore';

describe('structureFraction', () => {
  const targets = { avgWords: 2600, avgHeadings: 23, avgPs: 75, headingsMin: 12.3, psMin: 5.5 };

  it('gives full credit at the band minimum, not at the average', () => {
    // Surfer's own article: 13 headings, 44 paragraphs → 100.
    expect(structureFraction(13, 44, targets)).toBe(1);
  });

  it('scales toward the minimum below it', () => {
    // Half the heading floor, paragraphs fine → 0.75 overall.
    expect(structureFraction(6.15, 44, targets)).toBeCloseTo(0.75, 5);
  });

  it('never rewards exceeding the band', () => {
    expect(structureFraction(60, 300, targets)).toBe(1);
  });

  it('falls back to the average when no band is known (stored score_data from before)', () => {
    const legacy = { avgWords: 1307, avgHeadings: 20.75, avgPs: 26.5 };
    // 10 / 20.75 = 0.48; 51 / 26.5 capped at 1 → 0.74 — the old behaviour, unchanged.
    expect(structureFraction(10, 51, legacy)).toBeCloseTo(0.741, 2);
  });

  it('returns nothing for a cohort with no structure at all', () => {
    expect(structureFraction(10, 51, { avgWords: 0, avgHeadings: 0, avgPs: 0 })).toBe(0);
  });
});

describe('cohortMin', () => {
  it('takes the smallest positive value and ignores empty pages', () => {
    expect(cohortMin([14, 0, 9, 22])).toBe(9);
  });
  it('is undefined for an empty or all-zero cohort', () => {
    expect(cohortMin([])).toBeUndefined();
    expect(cohortMin([0, 0])).toBeUndefined();
  });
});
