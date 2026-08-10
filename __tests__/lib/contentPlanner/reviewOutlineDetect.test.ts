import { isReviewOutlineHtml, reviewOutlineToHtml } from '../../../lib/contentPlanner/reviewOutline';
import { isUsableArticleHtml } from '../../../lib/articleHtmlUsable';

const OUTLINE = reviewOutlineToHtml([
  { level: 1, text: 'Prywatny detektyw Warszawa – licencjonowana agencja dla osób prywatnych i firm' },
  {
    level: 2,
    text: 'Prywatny detektyw Warszawa – licencja, koszty i zakres pomocy',
    instructions: [
      'Odpowiedz w pierwszych dwóch zdaniach, że prywatny detektyw powinien posiadać licencję.',
      'Wyjaśnij punkt o uprawnieniach: wskaż ustawę o usługach detektywistycznych oraz RODO.',
    ],
    targetWords: 80,
  },
]);

describe('isReviewOutlineHtml', () => {
  it('recognises the document reviewOutlineToHtml produces', () => {
    expect(isReviewOutlineHtml(OUTLINE)).toBe(true);
  });

  /**
   * The reason this detector has to exist: an outline carries five or six instruction
   * sentences per heading, so it clears the usable-article length bar comfortably and
   * length alone cannot tell a plan from an article. Articles saved before autosave was
   * suspended during review still hold one in `articles.content`.
   */
  it('is needed because the outline passes the usable-article check', () => {
    expect(isUsableArticleHtml(OUTLINE)).toBe(true);
  });

  it('does not fire on written prose', () => {
    const article = '<h1>Prywatny detektyw Warszawa</h1><p>Biuro detektywistyczne ProDetektyw to '
      + 'licencjonowana agencja detektywistyczna w Warszawie, która obsługuje osoby prywatne i firmy.</p>';
    expect(isReviewOutlineHtml(article)).toBe(false);
  });

  it.each(['', '<p></p>'])('does not fire on empty content %p', (html) => {
    expect(isReviewOutlineHtml(html)).toBe(false);
  });

  it('tolerates the spacing the editor may reflow it into', () => {
    expect(isReviewOutlineHtml('<p>Target length:  ~ 120  words</p>')).toBe(true);
  });

  it('omits the marker when a section carries no word budget', () => {
    const noBudget = reviewOutlineToHtml([
      { level: 2, text: 'Kontakt', instructions: ['Podaj formy kontaktu.'] },
    ]);
    expect(isReviewOutlineHtml(noBudget)).toBe(false);
  });
});
