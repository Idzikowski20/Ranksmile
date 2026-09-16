import {
  collectApprovedOutline,
  isReviewOutlineHtml,
  isReviewOutlineHtmlBounded,
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

  describe('isReviewOutlineHtmlBounded', () => {
    // A long outline the list query truncated mid-block: the raw cut looks like an
    // article, but classifying up to the last complete block still reads it as an outline.
    const longOutline = reviewOutlineToHtml(
      Array.from({ length: 50 }, (_, i) => ({
        level: 2 as const,
        text: `Section ${i} heading with enough words to run past the six thousand character list cap`,
        instructions: [`Write about topic ${i} in detail`, `Cover subtopic ${i} thoroughly here`],
      })),
    );

    it('detects an outline truncated mid-block when told it was truncated', () => {
      expect(longOutline.length).toBeGreaterThan(6000);
      const cut = longOutline.slice(0, 6000);
      expect(cut.endsWith('</ul>')).toBe(false); // cut lands inside a block
      expect(isReviewOutlineHtml(cut)).toBe(false); // raw cut misreads as an article
      expect(isReviewOutlineHtmlBounded(cut, true)).toBe(true); // bounded rescues it
    });

    it('classifies the raw content when not truncated', () => {
      const article = '<h2>Intro</h2><p>Real prose that makes this an article.</p>';
      expect(isReviewOutlineHtmlBounded(article, false)).toBe(false);
    });
  });

});
