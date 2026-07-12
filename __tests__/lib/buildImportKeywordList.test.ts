import { buildImportKeywordList } from '../../lib/buildImportKeywordList';

describe('buildImportKeywordList', () => {
  it('merges GSC page queries with inferred primary keyword', () => {
    const { primaryKeyword, keywords } = buildImportKeywordList({
      pageUrl: 'https://prodetektyw.pl/jak-sprawdzic-czy-ktos-mnie-sledzi/',
      title: 'Jak sprawdzić czy ktoś mnie śledzi',
      gscRows: [
        { keyword: 'jak sprawdzić czy ktoś mnie śledzi', page: 'https://prodetektyw.pl/jak-sprawdzic-czy-ktos-mnie-sledzi/', impressions: 500 },
        { keyword: 'cuckolding', page: 'https://prodetektyw.pl/inny-artykul/', impressions: 9000 },
      ],
    });
    expect(primaryKeyword.toLowerCase()).toContain('sprawdz');
    expect(keywords.some((k) => k.toLowerCase().includes('cuckolding'))).toBe(false);
    expect(keywords.some((k) => k.toLowerCase().includes('sprawdz'))).toBe(true);
  });
});
