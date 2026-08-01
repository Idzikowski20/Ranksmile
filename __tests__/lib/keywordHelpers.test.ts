import { kdDotColor } from '../../components/koala/product/helpers/KeywordDifficultyDot';
import { kwIntentToSearchIntent } from '../../lib/keywordResearchView';

describe('product helpers + research intent map', () => {
  it('maps KD bands', () => {
    expect(kdDotColor(null)).toBe('var(--koala-border-primary)');
    expect(kdDotColor(10)).toBe('#22C55E');
    expect(kdDotColor(90)).toBe('#DC2626');
  });

  it('maps research KwIntent to SearchIntent', () => {
    expect(kwIntentToSearchIntent('Informational')).toBe('informational');
    expect(kwIntentToSearchIntent('Shopping')).toBe('transactional');
    expect(kwIntentToSearchIntent('Not detected')).toBeNull();
  });
});
