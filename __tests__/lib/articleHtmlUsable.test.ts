import { stripHtmlToPlain, isUsableArticleHtml } from '../../lib/articleHtmlUsable';

describe('isUsableArticleHtml', () => {
  it('rejects empty and tiny stubs', () => {
    expect(isUsableArticleHtml('')).toBe(false);
    expect(isUsableArticleHtml('<p>hi</p>')).toBe(false);
  });

  it('accepts real article body', () => {
    const html = `<h1>Jak pozycjonować stronę</h1><p>${'Lorem ipsum dolor sit amet. '.repeat(8)}</p>`;
    expect(isUsableArticleHtml(html)).toBe(true);
    expect(stripHtmlToPlain(html).length).toBeGreaterThan(80);
  });
});
