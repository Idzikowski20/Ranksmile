import {
  isActionableRecommendation,
  countActionableRecommendations,
} from '../../../../../src/core/domain/recommendations/actionable';

describe('actionable recommendations', () => {
  it('keeps create-type rows (no score) and optimize rows with a positive score', () => {
    expect(isActionableRecommendation({ type: 'create', score: null })).toBe(true);
    expect(isActionableRecommendation({ type: 'optimize', score: 5 })).toBe(true);
  });

  it('drops optimize rows with a zero/missing score', () => {
    expect(isActionableRecommendation({ type: 'optimize', score: 0 })).toBe(false);
    expect(isActionableRecommendation({ score: 0 })).toBe(false);
  });

  it('counts only the actionable rows', () => {
    expect(
      countActionableRecommendations([
        { type: 'create', score: null },
        { type: 'optimize', score: 0 },
        { type: 'optimize', score: 3 },
      ]),
    ).toBe(2);
  });
});
