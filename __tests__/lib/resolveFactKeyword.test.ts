import { resolveFactKeyword } from '../../lib/resolveFactKeyword';

describe('resolveFactKeyword', () => {
  it('rejects domain GSC noise when article is about detektyw', () => {
    const article = 'Prywatny detektyw w Warszawie oferuje usługi inwigilacji i obserwacji małżeńskiej.';
    const kw = resolveFactKeyword({
      keyword: 'cuckolding co znaczy',
      articleText: article,
      title: 'Prywatny detektyw Warszawa',
      pageUrl: 'https://prodetektyw.pl/prywatny-detektyw-warszawa/',
    });
    expect(kw.toLowerCase()).not.toContain('cuckold');
    expect(kw.toLowerCase()).toMatch(/detektyw|inwigilac|warszawa/);
  });
});
