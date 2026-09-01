import { termRangeCoverageFraction } from '../../lib/competitorContentScore';

describe('competitorContentScore anti-stuffing', () => {
  it('penalizes term usage above max with 0.7 score cap per term', () => {
    const body = 'prywatny detektyw '.repeat(20);
    const fraction = termRangeCoverageFraction(body, [{
      term: 'prywatny detektyw',
      suggested_min: 2,
      suggested_max: 8,
      target_count: 5,
    }]);
    const inRange = termRangeCoverageFraction('prywatny detektyw prywatny detektyw prywatny detektyw prywatny detektyw', [{
      term: 'prywatny detektyw',
      suggested_min: 2,
      suggested_max: 8,
      target_count: 5,
    }]);
    expect(fraction).toBeLessThan(inRange);
    expect(fraction).toBeCloseTo(0.7, 1);
  });
});
