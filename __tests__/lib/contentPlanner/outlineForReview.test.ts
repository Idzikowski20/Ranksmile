import { outlineForReview } from '../../../lib/contentPlanner/reviewOutline';

/**
 * There is no planner-bundle fallback any more. Rebuilding an outline from the bundle
 * produced "Pokryj <heading> z przypisanymi claims" plus sentences scraped off
 * competitor pages, and it ran on every re-entry. The only two sources left are the
 * reviewer's own edits and the persisted LLM brief.
 */
const brief = [
  { level: 1, text: 'Brief title' },
  { level: 2, text: 'Brief section', instructions: ['Brief instruction.'] },
];

describe('outlineForReview', () => {
  it('prefers the reviewer’s saved outline over the brief', () => {
    const saved = [
      { level: 1, text: 'My title' },
      { level: 2, text: 'My section', instructions: ['My instruction.'], targetWords: 420 },
    ];
    expect(outlineForReview({ approvedOutline: saved, brief })).toEqual(saved);
  });

  it('uses the persisted brief when nothing was saved', () => {
    expect(outlineForReview({ approvedOutline: null, brief })).toEqual(brief);
  });

  it('ignores a saved outline that carries no usable heading', () => {
    expect(outlineForReview({ approvedOutline: [{ level: 2, text: '  ' }], brief })).toEqual(brief);
  });

  it('accepts a saved outline straight from JSON storage', () => {
    const raw = JSON.parse('[{"level":2,"text":"From storage","targetWords":200}]');
    expect(outlineForReview({ approvedOutline: raw, brief })).toEqual([
      { level: 2, text: 'From storage', targetWords: 200 },
    ]);
  });

  /** Empty, not a mechanical stand-in: the caller has to ask for a real brief. */
  it('returns nothing when there is neither a saved outline nor a brief', () => {
    expect(outlineForReview({ approvedOutline: null, brief: null })).toEqual([]);
  });

  /**
   * The guard that is not vacuous: a brief whose text DOES contain the mechanical
   * wording must still be replayed verbatim rather than re-derived. The earlier version
   * asserted that a fixture without "Pokryj" contained no "Pokryj" — it could not fail.
   */
  it('replays the stored brief verbatim, whatever it says', () => {
    const legacyLooking = [
      { level: 1, text: 'Tytuł' },
      { level: 2, text: 'Szybka odpowiedź', instructions: ['Pokryj Szybka odpowiedź z przypisanymi claims.'] },
    ];

    expect(outlineForReview({ approvedOutline: null, brief: legacyLooking })).toEqual(legacyLooking);
  });

  /** With neither source there is nothing to show — and nothing to invent. */
  it('cannot produce headings out of a bundle any more', () => {
    const out = outlineForReview({
      approvedOutline: null,
      brief: null,
    } as Parameters<typeof outlineForReview>[0]);

    expect(out).toEqual([]);
  });
});
