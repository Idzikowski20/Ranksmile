import { outlineForReview } from '../../../lib/contentPlanner/reviewOutline';
import type { ContentPlannerBundle } from '../../../lib/contentPlanner/types';

const bundle = {
  outline: { h1: 'Planner title', sections: [{ id: 'one', heading: 'Planner section' }] },
  briefs: [{
    sectionId: 'one',
    heading: 'Planner section',
    objective: 'Planner objective.',
    claimIds: [],
    mustAnswer: [],
    evidence: [],
    freshnessNotes: [],
    budget: { words: 300 },
  }],
  targetKg: { claims: [] },
} as unknown as ContentPlannerBundle;

describe('outlineForReview', () => {
  it('prefers the reviewer’s saved outline over the planner’s', () => {
    const saved = [
      { level: 1, text: 'My title' },
      { level: 2, text: 'My section', instructions: ['My instruction.'], targetWords: 420 },
    ];
    expect(outlineForReview({ approvedOutline: saved, bundle })).toEqual(saved);
  });

  it('falls back to the planner outline when nothing was saved', () => {
    const result = outlineForReview({ approvedOutline: null, bundle });
    expect(result[0]).toEqual({ level: 1, text: 'Planner title' });
    expect(result[1].text).toBe('Planner section');
  });

  it('ignores a saved outline that carries no usable heading', () => {
    expect(outlineForReview({ approvedOutline: [{ level: 2, text: '  ' }], bundle })[0].text)
      .toBe('Planner title');
  });

  it('accepts a saved outline straight from JSON storage', () => {
    const raw = JSON.parse('[{"level":2,"text":"From storage","targetWords":200}]');
    expect(outlineForReview({ approvedOutline: raw, bundle })).toEqual([
      { level: 2, text: 'From storage', targetWords: 200 },
    ]);
  });

  it('returns nothing when there is neither a saved outline nor a usable bundle', () => {
    expect(outlineForReview({ approvedOutline: null, bundle: null })).toEqual([]);
  });
});
