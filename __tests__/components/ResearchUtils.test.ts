import {
  jaccardSimilarity,
  classifyHeadingStatus,
  isPaaCovered,
  computeSerpInsights,
} from '../../lib/researchUtils';

describe('jaccardSimilarity', () => {
  it('returns 0 for completely different strings', () => {
    expect(jaccardSimilarity('apple orange', 'banana grape')).toBe(0);
  });

  it('returns 1 for identical strings', () => {
    expect(jaccardSimilarity('machine learning guide', 'machine learning guide')).toBe(1);
  });

  it('returns ~0.5 for 50% overlap', () => {
    const result = jaccardSimilarity('machine learning guide', 'machine learning tools');
    expect(result).toBeGreaterThanOrEqual(0.49);
    expect(result).toBeLessThanOrEqual(0.51);
  });

  it('ignores words with 3 or fewer characters', () => {
    expect(jaccardSimilarity('the and of', 'the and of')).toBe(0);
  });
});

describe('classifyHeadingStatus', () => {
  const currentHeadings = [
    { level: 2, text: 'Introduction to machine learning' },
    { level: 2, text: 'Deep learning fundamentals' },
  ];

  it('returns "covered" when overlap >= 50%', () => {
    expect(classifyHeadingStatus({ level: 2, text: 'machine learning introduction' }, currentHeadings)).toBe('covered');
  });

  it('returns "expand" when overlap is 20-49%', () => {
    // 'machine' + 'learning' overlap with 'Introduction to machine learning' → Jaccard 2/5 = 0.4
    expect(classifyHeadingStatus({ level: 2, text: 'machine learning basics tutorial' }, currentHeadings)).toBe('expand');
  });

  it('returns "missing" when overlap < 20%', () => {
    expect(classifyHeadingStatus({ level: 2, text: 'natural language processing text' }, currentHeadings)).toBe('missing');
  });

  it('returns "missing" when currentHeadings is empty', () => {
    expect(classifyHeadingStatus({ level: 2, text: 'anything here' }, [])).toBe('missing');
  });
});

describe('isPaaCovered', () => {
  const currentHeadings = [
    { level: 2, text: 'machine learning algorithms explained' },
  ];

  it('returns true when question overlaps a heading >= 50%', () => {
    expect(isPaaCovered('What are machine learning algorithms?', currentHeadings)).toBe(true);
  });

  it('returns false when no heading overlaps >= 50%', () => {
    expect(isPaaCovered('How do neural networks process images?', currentHeadings)).toBe(false);
  });

  it('returns false when currentHeadings is empty', () => {
    expect(isPaaCovered('anything', [])).toBe(false);
  });
});

describe('computeSerpInsights', () => {
  const competitors = [
    { url: 'a', title: 'A', favicon: '', heading_count: 5, word_count: 1000, headings: [{ level: 2, text: 'machine learning basics guide' }, { level: 2, text: 'project management tools best' }] },
    { url: 'b', title: 'B', favicon: '', heading_count: 5, word_count: 2000, headings: [{ level: 2, text: 'machine learning basics guide' }, { level: 2, text: 'project management tools list' }] },
    { url: 'c', title: 'C', favicon: '', heading_count: 5, word_count: 3000, headings: [{ level: 2, text: 'machine learning basics tutorial' }, { level: 2, text: 'project management tools comparison' }] },
  ];

  it('computes average word count', () => {
    const { avgWordCount } = computeSerpInsights(competitors);
    expect(avgWordCount).toBe(2000);
  });

  it('returns words appearing in >= 3 competitors', () => {
    const { commonTopics } = computeSerpInsights(competitors);
    expect(commonTopics).toContain('machine');
    expect(commonTopics).toContain('learning');
    expect(commonTopics).toContain('basics');
    expect(commonTopics).toContain('project');
    expect(commonTopics).toContain('management');
    expect(commonTopics).toContain('tools');
  });

  it('excludes words appearing in < 3 competitors', () => {
    const { commonTopics } = computeSerpInsights(competitors);
    expect(commonTopics).not.toContain('guide');
  });

  it('returns empty results for no competitors', () => {
    const { avgWordCount, commonTopics } = computeSerpInsights([]);
    expect(avgWordCount).toBe(0);
    expect(commonTopics).toHaveLength(0);
  });
});
