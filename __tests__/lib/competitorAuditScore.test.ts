import { termRangeCoverageFraction, computeCompetitorContentScore } from '../../lib/competitorContentScore';

describe('termRangeCoverageFraction', () => {
  it('counts terms within suggested min/max only', () => {
    const body = 'prywatny detektyw prywatny detektyw warszawa biuro detektywistyczne biuro detektywistyczne biuro';
    const frac = termRangeCoverageFraction(body, [
      { term: 'prywatny detektyw', suggested_min: 2, suggested_max: 5, target_count: 3 },
      { term: 'biuro detektywistyczne', suggested_min: 4, suggested_max: 10, target_count: 6 },
      { term: 'agencja detektywistyczna', suggested_min: 7, suggested_max: 12, target_count: 8 },
    ]);
    expect(frac).toBeCloseTo(1 / 3, 2);
  });
});

describe('computeCompetitorContentScore', () => {
  it('scores thin pages with weak term coverage in a mid band when structure is ok', () => {
    const terms = Array.from({ length: 50 }, (_, i) => ({
      term: `term-${i}`,
      target_count: 3,
      suggested_min: 2,
      suggested_max: 6,
    }));
    const body = Array.from({ length: 12 }, (_, i) => `term-${i} term-${i} term-${i}`).join(' ');
    const score = computeCompetitorContentScore(
      body,
      960,
      12,
      34,
      terms,
      { avgWords: 5000, avgHeadings: 35, avgPs: 60 },
    );
    expect(score).toBeGreaterThanOrEqual(15);
    expect(score).toBeLessThanOrEqual(45);
  });
});
