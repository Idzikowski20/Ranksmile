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

  /**
   * The word-count line is gone from the rendered outline, so detection is by shape:
   * an H2 followed by its instruction list, with no prose paragraph. A section without a
   * budget used to be invisible to this check — and review mode reads the LIVE editor
   * document, where the outline is the content, so a miss here turns review off while the
   * reviewer is still reading it.
   */
  it('recognises a section that carries no word budget, by its shape', () => {
    const noBudget = reviewOutlineToHtml([
      { level: 2, text: 'Kontakt', instructions: ['Podaj formy kontaktu.'] },
    ]);
    expect(isReviewOutlineHtml(noBudget)).toBe(true);
  });

  /** The article written from that outline must not read as one. */
  it('does not fire on the written article', () => {
    const article = '<h2>Kontakt</h2><p>'
      + 'Szantaż emocjonalny to forma manipulacji wykorzystująca emocje — strach, poczucie winy '
      + 'i lęk przed odrzuceniem — by kontrolować drugą osobę, i właśnie dlatego tak trudno go rozpoznać.'
      + '</p><ul><li>Pierwszy sygnał</li></ul>';
    expect(isReviewOutlineHtml(article)).toBe(false);
  });

  /** All bullets deleted: the renderer emits `<p></p>`, and that is still an outline. */
  it('recognises a section whose instructions were all removed', () => {
    const emptied = reviewOutlineToHtml([
      { level: 2, text: 'Kontakt', instructions: [] },
      { level: 2, text: 'FAQ', instructions: ['Odpowiedz na dwa pytania.'] },
    ]);
    expect(isReviewOutlineHtml(emptied)).toBe(true);
  });

  /** Outlines whose sections are H3 are outlines too — only H2 used to count. */
  it('recognises an outline built from lower heading levels', () => {
    const nested = reviewOutlineToHtml([
      { level: 1, text: 'Tytuł' },
      { level: 3, text: 'Podsekcja', instructions: ['Opisz krok po kroku.'] },
    ]);
    expect(isReviewOutlineHtml(nested)).toBe(true);
  });

  /**
   * A list-heavy article: one section has a list, the next is prose. Counting
   * heading/list pairs let the later list satisfy the earlier heading.
   */
  it('does not fire when one section is prose and another has a list', () => {
    const article = '<h2>Objawy</h2><ul><li>Lęk</li><li>Poczucie winy</li></ul>'
      + '<h2>Co dalej</h2><p>Skontaktuj się ze specjalistą i zabezpiecz wiadomości.</p>';
    expect(isReviewOutlineHtml(article)).toBe(false);
  });
});
