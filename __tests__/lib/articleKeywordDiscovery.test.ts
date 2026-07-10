jest.mock('../../database/database', () => ({ default: { query: jest.fn() } }));
jest.mock('../../lib/seo/keywordData', () => ({
  enrichTerms: jest.fn(),
  getOwnVisibleKeywords: jest.fn().mockResolvedValue({ keywords: [] }),
}));
jest.mock('../../lib/dataforseo', () => ({
  getRankedKeywords: jest.fn(),
  isDataForSeoConfigured: jest.fn().mockReturnValue(true),
}));
jest.mock('../../lib/cache/fileCache', () => ({
  cached: jest.fn(({ producer }: { producer: () => Promise<unknown> }) => producer()),
  TTL: { RANKED_KEYWORDS: 1 },
}));

import { getRankedKeywords } from '../../lib/dataforseo';
import { needsTermEnrichment, mergeNlpTerms, discoverRankingKeywords } from '../../lib/articleKeywordDiscovery';
import type { NlpTerm } from '../../lib/contentScore';

const mockGetRankedKeywords = getRankedKeywords as jest.MockedFunction<typeof getRankedKeywords>;

describe('needsTermEnrichment', () => {
  it('returns true for thin term lists', () => {
    expect(needsTermEnrichment([], 'detektyw warszawa')).toBe(true);
  });

  it('returns true when most terms are trivial PK splits', () => {
    const terms: NlpTerm[] = [
      { term: 'detektyw', target_count: 1 },
      { term: 'warszawa', target_count: 1 },
      { term: 'detektyw warszawa', target_count: 1 },
    ];
    expect(needsTermEnrichment(terms, 'detektyw warszawa')).toBe(true);
  });
});

describe('mergeNlpTerms', () => {
  it('keeps higher target_count on duplicates', () => {
    const a: NlpTerm[] = [{ term: 'biuro detektywistyczne', target_count: 1, current_count: 0 }];
    const b: NlpTerm[] = [{ term: 'biuro detektywistyczne', target_count: 3, current_count: 0 }];
    const merged = mergeNlpTerms(a, b);
    expect(merged).toHaveLength(1);
    expect(merged[0].target_count).toBe(3);
  });
});

describe('discoverRankingKeywords', () => {
  beforeEach(() => {
    mockGetRankedKeywords.mockReset();
  });

  it('keeps user seed as primary even when DFS returns a higher-scoring domain keyword', async () => {
    mockGetRankedKeywords.mockResolvedValue([
      { keyword: 'gemini chatgpt', position: 3 },
      { keyword: 'other topic', position: 8 },
    ]);

    const { primaryKeyword, keywords } = await discoverRankingKeywords({
      pageUrl: '',
      workspaceDomain: 'example.com',
      userKeywords: ['detektyw'],
      country: 'PL',
      languageCode: 'pl',
    });

    expect(primaryKeyword).toBe('detektyw');
    expect(keywords.some((k) => k.keyword === 'detektyw')).toBe(true);
  });
});
