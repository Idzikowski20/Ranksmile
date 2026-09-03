/** @jest-environment node */
/**
 * Calibration guard: presenceScore must reproduce the reference tool's published numbers.
 *
 * Samples are real rows read from a live tracker project (7-day window, all models) — the
 * same 100-row set the coefficients were fitted on. If someone retunes the formula, these
 * fail loudly instead of silently drifting our scale away from theirs again.
 */
import { presenceScore } from '@/src/core/domain/aiVisibility/presence';

// [mentionRate, avgPosition, referencePresence]
const SAMPLES: Array<[number, number, number]> = [
  [39, 1.6, 56],
  [27, 2.8, 43],
  [20, 2.5, 39],
  [21, 3.2, 38],
  [23, 3.6, 37],
  [15, 3.2, 33],
  [11, 2.5, 33],
  [16, 3.9, 32],
  [9, 2.8, 31],
  [1, 1.0, 30],
  [1, 2.0, 27],
  [1, 3.0, 24],
  [1, 4.0, 20],
  [5, 5.0, 20],
  [3, 5.0, 19],
];

describe('presenceScore', () => {
  it.each(SAMPLES)('mentionRate %s @ position %s → ~%s', (mentionRate, avgPosition, expected) => {
    // ±1 absorbs their integer rounding; the fit's worst case over 100 rows was 0.90.
    expect(Math.abs(presenceScore({ mentionRate, avgPosition }) - expected)).toBeLessThanOrEqual(1);
  });

  it('scores a brand that was never mentioned as 0, not the fit intercept', () => {
    expect(presenceScore({ mentionRate: 0, avgPosition: null })).toBe(0);
    expect(presenceScore({ mentionRate: 0, avgPosition: 3 })).toBe(0);
  });

  it('clamps to 0..100', () => {
    expect(presenceScore({ mentionRate: 100, avgPosition: 1 })).toBeLessThanOrEqual(100);
    expect(presenceScore({ mentionRate: 1, avgPosition: 40 })).toBe(0);
  });
});
