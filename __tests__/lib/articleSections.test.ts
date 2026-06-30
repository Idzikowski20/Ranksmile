import { splitSections, normalizeHtmlForDiff, sectionId } from '../../lib/articleSections';

describe('articleSections', () => {
  const html = '<p>intro</p><h2>One</h2><p>a</p><h2>Two</h2><p>b</p>';

  it('splits into an intro section + one per H2', () => {
    const secs = splitSections(html);
    expect(secs.map((s) => s.headingText)).toEqual(['', 'One', 'Two']);
    expect(secs[0].html).toContain('intro');
    expect(secs[1].html).toMatch(/<h2[^>]*>One<\/h2>/);
    expect(secs[1].html).toContain('a');
    expect(secs[2].html).toContain('b');
  });

  it('handles an H2 with nested markup for the heading text', () => {
    const secs = splitSections('<h2><span>Title</span> Two</h2><p>x</p>');
    expect(secs[0].headingText).toBe('Title Two');
  });

  it('gives a stable id from heading text + index', () => {
    expect(sectionId('One', 1)).toBe(sectionId('One', 1));
    expect(sectionId('One', 1)).not.toBe(sectionId('One', 2));
  });

  it('normalizes whitespace so trivial diffs are equal', () => {
    expect(normalizeHtmlForDiff('<p>  hi   there </p>')).toBe(normalizeHtmlForDiff('<p>hi there</p>'));
    expect(normalizeHtmlForDiff('<p>hi</p>')).toBe(normalizeHtmlForDiff('<p>hi</p>\n'));
  });

  it('strips HTML comments when normalizing', () => {
    expect(normalizeHtmlForDiff('<p>hi<!--note--></p>')).toBe(normalizeHtmlForDiff('<p>hi</p>'));
  });

  it('does NOT reorder attributes (attribute order is preserved, not normalized away)', () => {
    // two different attribute orders are NOT forced equal — we don't sort attrs
    expect(normalizeHtmlForDiff('<p class="x" id="y">hi</p>')).not.toBe(normalizeHtmlForDiff('<p id="y" class="x">hi</p>'));
  });
});
