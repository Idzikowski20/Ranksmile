import {
  collectApprovedOutline,
  reviewOutlineFromBundle,
  reviewOutlineToHtml,
} from '../../../lib/contentPlanner/reviewOutline';
import type { ContentPlannerBundle } from '../../../lib/contentPlanner/types';

describe('review outline', () => {
  it('exposes editable section prompts and word targets from planner briefs', () => {
    const bundle = {
      outline: { h1: 'Article title', sections: [{ id: 'one', heading: 'First section' }] },
      briefs: [{
        sectionId: 'one',
        heading: 'First section',
        objective: 'Answer the urgent question.',
        claimIds: ['claim-1'],
        mustAnswer: ['What should the reader do now?'],
        evidence: [{ kind: 'example', hint: 'A realistic scenario' }],
        freshnessNotes: [],
        budget: { words: 210 },
      }],
      targetKg: { claims: [{ id: 'claim-1', statement: 'Do not pay the blackmailer.' }] },
    } as unknown as ContentPlannerBundle;

    expect(reviewOutlineFromBundle(bundle)).toEqual([
      { level: 1, text: 'Article title' },
      {
        level: 2,
        text: 'First section',
        instructions: [
          'Answer the urgent question.',
          'Cover: Do not pay the blackmailer.',
          'Answer: What should the reader do now?',
          'Include example: A realistic scenario',
        ],
        targetWords: 210,
      },
    ]);
  });

  it('round-trips edited prompts and target length through TipTap JSON', () => {
    const outline = [
      { level: 1, text: 'Article title' },
      { level: 2, text: 'First section', instructions: ['Explain the risk.', 'Give three steps.'], targetWords: 210 },
    ];
    const html = reviewOutlineToHtml(outline);
    expect(html).toContain('<li>Explain the risk.</li>');
    expect(html).toContain('Target length: ~210 words');

    expect(collectApprovedOutline({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Article title' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Edited section' }] },
        {
          type: 'bulletList',
          content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Edited instruction.' }] }] },
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Keep this separate.' }] }],
          },
          ],
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'Target length: ~240 words' }] },
      ],
    })).toEqual([
      { level: 1, text: 'Article title' },
      { level: 2, text: 'Edited section', instructions: ['Edited instruction.', 'Keep this separate.'], targetWords: 240 },
    ]);
  });
});
