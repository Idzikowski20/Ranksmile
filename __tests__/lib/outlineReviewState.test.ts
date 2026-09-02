import { isOutlineAwaitingReview } from '@/src/infrastructure/articles/outlineReviewState';
import { reviewOutlineToHtml } from '@/src/infrastructure/contentPlanner/reviewOutline';
import { resolveArticleEntry } from '@/src/core/domain/articles/articleFlow';

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

/**
 * The page feeds this the LIVE editor document, not `article.content`. That field is only
 * refreshed on load and on save, so straight after a generation it still holds the
 * outline while the editor already shows the article. Deriving the flag from the stale
 * copy pushed the editor back into review over the article it had just revealed — and
 * autosave, suspended during review, would have dropped every later edit to it.
 */
describe('the flag follows the live document', () => {
  const STALE_OUTLINE = OUTLINE;

  it('clears as soon as the editor holds a written article', () => {
    // What the page passes: `editorHtml || article?.content`.
    expect(isOutlineAwaitingReview({ content: ARTICLE || STALE_OUTLINE, scoreData: WITH_PLAN })).toBe(false);
  });

  it('would have stayed true on the stale field, which is the bug', () => {
    expect(isOutlineAwaitingReview({ content: STALE_OUTLINE, scoreData: WITH_PLAN })).toBe(true);
  });

  it('falls back to the stored content before the editor has emitted', () => {
    const notYetEmitted = '';
    expect(isOutlineAwaitingReview({ content: notYetEmitted || STALE_OUTLINE, scoreData: WITH_PLAN })).toBe(true);
  });
});


/**
 * `isUsableArticleHtml` demands 80 plain characters. Using it as an emptiness check
 * reopened a short but deliberately authored draft in outline review and suspended its
 * autosave, so the author's own words stopped being saved.
 */
describe('short authored drafts are not outlines', () => {
  it('treats a few written words as written, even with planner metadata present', () => {
    expect(isOutlineAwaitingReview({ content: '<h1>Detektyw</h1><p>Krotki wstep.</p>', scoreData: WITH_PLAN }))
      .toBe(false);
  });

  it.each(['', '<p></p>', '<p>   </p>', '<h1></h1><p>&nbsp;</p>'])(
    'still reopens review for genuinely empty content %p',
    (content) => {
      expect(isOutlineAwaitingReview({ content, scoreData: WITH_PLAN })).toBe(true);
    },
  );
});

/**
 * The status the planner writes is the primary signal; the shape-based rules below it
 * only exist for rows written before it did.
 */
describe('the recorded status', () => {
  it('resumes review from status alone, with no planner bundle to infer from', () => {
    expect(isOutlineAwaitingReview({ content: '', scoreData: '{"terms":[]}', status: 'review' })).toBe(true);
  });

  it('never overrides a written article', () => {
    expect(isOutlineAwaitingReview({ content: ARTICLE, scoreData: WITH_PLAN, status: 'review' })).toBe(false);
  });

  /**
   * Article 162: a 'draft' whose content persisted empty (a lost generation) still carries
   * the planner bundle it got at planning time. The bundle branch treated that as
   * "outline, never written" and pushed it into review — which suspends autosave, which
   * keeps content empty: a deadlock. The 'review' status is the ONLY awaiting-review
   * signal; content-plan only sets it while content is empty, so a 'draft' is never one.
   */
  it('does not push an empty-content draft with a stale planner bundle into review', () => {
    // The status-less empty+bundle legacy case is already covered above ("recognises an
    // empty draft that already has a planner bundle"); this only adds the new 'draft' guard.
    expect(isOutlineAwaitingReview({ content: '', scoreData: WITH_PLAN, status: 'draft' })).toBe(false);
  });
});
