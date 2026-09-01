import {
  collectApprovedOutline,
  reviewOutlineToHtml,
} from '@/src/infrastructure/contentPlanner/reviewOutline';

describe('review outline', () => {
  /**
   * The rendered document no longer carries "Target length: ~N words" — the reference
   * brief has no per-section word line, and applyApprovedOutline falls back to the
   * planner's own budget (`targetWords ?? base.expectedWords`), so nothing is lost.
   * collectApprovedOutline still PARSES the line, because drafts written by the old
   * format still contain it.
   */
  it('round-trips edited prompts through TipTap JSON, without a word-count line', () => {
    const outline = [
      { level: 1, text: 'Article title' },
      { level: 2, text: 'First section', instructions: ['Explain the risk.', 'Give three steps.'], targetWords: 210 },
    ];
    const html = reviewOutlineToHtml(outline);
    expect(html).toContain('<li>Explain the risk.</li>');
    expect(html).not.toContain('Target length');

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
