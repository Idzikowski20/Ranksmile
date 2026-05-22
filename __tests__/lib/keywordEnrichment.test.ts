import { computeRelevanceScore, computeOpportunityScore, checkCoverage, competitionWeight } from '../../lib/keywordEnrichment';

describe('computeRelevanceScore', () => {
  it('returns 1 for exact keyword match in title', () => {
    expect(computeRelevanceScore('content marketing', 'content marketing tips 2024')).toBe(1);
  });

  it('returns high score when all keyword words appear in title', () => {
    expect(computeRelevanceScore('content marketing', 'content strategy and marketing guide')).toBeGreaterThan(0.5);
  });

  it('returns 0 when no word overlap', () => {
    expect(computeRelevanceScore('trump election', 'content marketing guide')).toBe(0);
  });

  it('filters words shorter than 3 chars', () => {
    expect(computeRelevanceScore('a b c', 'a sample title')).toBe(0);
  });
});

describe('computeOpportunityScore', () => {
  it('returns high score for high volume, low competition, weak position, uncovered', () => {
    const score = computeOpportunityScore({
      gsc_position: 20, ads_monthly_volume: 5000, ads_competition: 'LOW', is_covered: false,
    });
    expect(score).toBeGreaterThan(0.7);
  });

  it('returns low score for low volume, high competition, covered keyword, low position', () => {
    const score = computeOpportunityScore({
      gsc_position: 3, ads_monthly_volume: 100, ads_competition: 'HIGH', is_covered: true,
    });
    expect(score).toBeLessThan(0.3);
  });

  it('handles null values gracefully', () => {
    const score = computeOpportunityScore({
      gsc_position: null, ads_monthly_volume: null, ads_competition: null, is_covered: false,
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe('checkCoverage', () => {
  it('detects keyword in text', () => {
    expect(checkCoverage('content marketing', 'learn about content marketing today')).toBe(true);
  });

  it('returns false when keyword missing', () => {
    expect(checkCoverage('SEO strategy', 'learn about content marketing')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(checkCoverage('Content Marketing', 'Learn about CONTENT MARKETING today')).toBe(true);
  });
});

describe('competitionWeight', () => {
  it('returns 0.2 for LOW', () => {
    expect(competitionWeight('LOW')).toBe(0.2);
  });

  it('returns 0.5 for MEDIUM', () => {
    expect(competitionWeight('MEDIUM')).toBe(0.5);
  });

  it('returns 0.8 for HIGH', () => {
    expect(competitionWeight('HIGH')).toBe(0.8);
  });

  it('returns 0.5 for null', () => {
    expect(competitionWeight(null)).toBe(0.5);
  });
});
