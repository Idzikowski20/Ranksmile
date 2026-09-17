import { buildContentIdeas, dedupeGscKeywords } from '@/src/core/domain/recommendations/contentIdeas';

describe('dedupeGscKeywords', () => {
  it('keeps one row per keyword (best score wins) and sorts best first', () => {
    const out = dedupeGscKeywords([
      { keyword: 'audyt seo cena', impressions: 10, position: 60, clicks: 0, page: '/a' },
      { keyword: 'Audyt SEO cena', impressions: 126, position: 58.9, clicks: 1, page: '/b' },
      { keyword: 'koszt audytu seo', impressions: 42, position: 54.6, clicks: 0 },
      { keyword: '', impressions: 999, position: 1, clicks: 50 },
    ]);
    expect(out.map((k) => [k.keyword, k.impressions])).toEqual([
      ['Audyt SEO cena', 126],
      ['koszt audytu seo', 42],
    ]);
  });
});

describe('buildContentIdeas', () => {
  const gsc = [
    { keyword: 'audyt seo cena', impressions: 126, position: 58.9, clicks: 0 },
    { keyword: 'ile kosztuje audyt seo', impressions: 54, position: 45.5, clicks: 0 },
    { keyword: 'low traffic', impressions: 20, position: 10, clicks: 0 },
    { keyword: 'already written', impressions: 300, position: 5, clicks: 3 },
  ];

  it('lists GSC keywords with more than 20 impressions that no article covers', () => {
    const ideas = buildContentIdeas({ gscKeywords: gsc, covered: ['Already Written'] });
    expect(ideas.map((i) => i.keyword)).toEqual(['audyt seo cena', 'ile kosztuje audyt seo']);
    expect(ideas[0]).toMatchObject({ impressions: 126, position: 58.9, volume: null });
  });

  it('puts scan-suggested topics (create recommendations) first, skipping covered and duplicate ones', () => {
    const ideas = buildContentIdeas({
      recs: [
        { title: 'Integracja subiekt gt woocommerce', type: 'create', search_volume: 90 },
        { title: 'Fix slow pages', type: 'optimize', search_volume: 50 },
        { title: 'already written', type: 'create', search_volume: 10 },
        { title: 'audyt seo cena', type: 'create', search_volume: null },
      ],
      gscKeywords: gsc,
      covered: ['already written'],
    });
    expect(ideas.map((i) => i.keyword)).toEqual([
      'Integracja subiekt gt woocommerce', 'audyt seo cena', 'ile kosztuje audyt seo',
    ]);
    expect(ideas[0]).toMatchObject({ impressions: 0, volume: 90 });
  });

  it('caps the list', () => {
    expect(buildContentIdeas({ gscKeywords: gsc, covered: [], limit: 1 })).toHaveLength(1);
  });
});
