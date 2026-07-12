import { inferPageKeyword, keywordFromUrl, pickBenchmarkKeyword } from '../../lib/inferPageKeyword';

describe('inferPageKeyword', () => {
  it('prefers GSC keyword for the page URL', () => {
    const gsc = new Map([['prodetektyw.pl/jak-sprawdzic', 'jak sprawdzic czy ktos mnie sledzi']]);
    const kw = inferPageKeyword(
      'https://prodetektyw.pl/jak-sprawdzic-czy-ktos-mnie-sledzi/',
      'Jak sprawdzić…',
      ['detektyw warszawa'],
      gsc,
    );
    expect(kw).toBe('jak sprawdzic czy ktos mnie sledzi');
  });

  it('uses URL slug when GSC is missing', () => {
    const kw = inferPageKeyword(
      'https://prodetektyw.pl/prywatny-detektyw-warszawa-kiedy-warto/',
      'Prywatny detektyw Warszawa',
      ['detektyw warszawa'],
      new Map(),
    );
    expect(kw).toContain('detektyw');
  });

  it('keywordFromUrl strips hyphens', () => {
    expect(keywordFromUrl('https://example.com/jak-sprawdzic-test/')).toBe('jak sprawdzic test');
  });

  it('pickBenchmarkKeyword reuses nearest cached SERP', () => {
    expect(pickBenchmarkKeyword('cyber detektyw', ['detektyw warszawa', 'prywatny detektyw'], 'x'))
      .toBe('detektyw warszawa');
  });
});
