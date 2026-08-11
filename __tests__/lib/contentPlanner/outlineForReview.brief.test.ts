/**
 * The brief writer's output used to live only in the POST reply. Every re-entry — a
 * refresh, a second generation, the same keyword after deleting the article — rebuilt
 * the mechanical version from the bundle, so a reviewer who had already been shown a
 * good brief got "Pokryj <heading> z przypisanymi claims" back instead.
 */
import { outlineForReview } from '../../../lib/contentPlanner/reviewOutline';

const BRIEF = [
  { level: 1, text: 'Szantaż emocjonalny — jak go rozpoznać' },
  {
    level: 2,
    text: 'Czym jest szantaż emocjonalny?',
    instructions: ['Krótki wstęp (2-3 zdania), że nacisk odbiera wolność wyboru.'],
    targetWords: 300,
  },
];

describe('outlineForReview', () => {
  it('replays the persisted brief instead of rebuilding from the bundle', () => {
    const out = outlineForReview({ approvedOutline: null, brief: BRIEF });

    expect(out).toEqual(BRIEF);
    expect(JSON.stringify(out)).not.toContain('Pokryj');
  });

  it('still lets the reviewer\'s own edits win over the brief', () => {
    const edited = [{ level: 1, text: 'Mój własny tytuł' }];

    const out = outlineForReview({ approvedOutline: edited, brief: BRIEF });

    expect(out).toEqual(edited);
  });

  /** Empty, not the old mechanical rebuild: the caller must ask for a real brief. */
  it('returns nothing when no brief was stored', () => {
    expect(outlineForReview({ approvedOutline: null, brief: null })).toEqual([]);
  });
});
