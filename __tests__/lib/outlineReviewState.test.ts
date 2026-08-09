import { isOutlineAwaitingReview } from '../../lib/outlineReviewState';
import { reviewOutlineToHtml } from '../../lib/contentPlanner/reviewOutline';
import { resolveArticleEntry } from '../../lib/articleFlow';

const OUTLINE = reviewOutlineToHtml([
  { level: 1, text: 'Prywatny detektyw Warszawa – licencjonowana agencja' },
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

const ARTICLE = '<h1>Prywatny detektyw Warszawa</h1><p>Biuro detektywistyczne ProDetektyw to '
  + 'licencjonowana agencja detektywistyczna w Warszawie, obsługująca osoby prywatne i firmy.</p>';

const WITH_PLAN = JSON.stringify({ terms: [], content_planner_v2: { bundle: {} } });

describe('isOutlineAwaitingReview', () => {
  it('recognises an outline that an earlier build persisted into content', () => {
    expect(isOutlineAwaitingReview({ content: OUTLINE, scoreData: WITH_PLAN })).toBe(true);
  });

  it('recognises an empty draft that already has a planner bundle', () => {
    expect(isOutlineAwaitingReview({ content: '', scoreData: WITH_PLAN })).toBe(true);
  });

  it('leaves a written article alone', () => {
    expect(isOutlineAwaitingReview({ content: ARTICLE, scoreData: WITH_PLAN })).toBe(false);
  });

  it('says no for an empty draft with no plan — there is nothing to review', () => {
    expect(isOutlineAwaitingReview({ content: '', scoreData: '{"terms":[]}' })).toBe(false);
  });

  it('reads both a raw score_data string and a parsed object', () => {
    expect(isOutlineAwaitingReview({ content: '', scoreData: { content_planner_v2: {} } })).toBe(true);
    expect(isOutlineAwaitingReview({ content: '', scoreData: '{"content_planner_v2":{}}' })).toBe(true);
  });

  it.each([[null], [undefined]])('says no for %p', (article) => {
    expect(isOutlineAwaitingReview(article)).toBe(false);
  });
});

/**
 * Suspending autosave during review leaves a returning reviewer with an empty draft while
 * wizard_state is still set — precisely the shape resolveArticleEntry bounces back to the
 * writing-mode step. The two rules have to agree or the reviewer can never reach the editor.
 */
describe('the wizard-resume guard agrees with it', () => {
  const draft = { content: '', wizard_state: JSON.stringify({ step: 'content-type' }), status: 'draft' };

  it('bounces an unfinished wizard draft that has no plan', () => {
    expect(resolveArticleEntry(draft, {
      outlineReview: isOutlineAwaitingReview({ content: draft.content, scoreData: '{"terms":[]}' }),
    }).kind).toBe('wizard');
  });

  it('keeps a reviewer in the editor once an outline has been planned', () => {
    expect(resolveArticleEntry(draft, {
      outlineReview: isOutlineAwaitingReview({ content: draft.content, scoreData: WITH_PLAN }),
    }).kind).toBe('editor');
  });
});
