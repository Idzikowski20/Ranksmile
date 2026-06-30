import { buildReviewDoc } from '../../lib/optimizeReviewDoc';
import type { SectionEvent } from '../../lib/optimizeSectionEvents';

const ev = (over: Partial<SectionEvent>): SectionEvent => ({
  sectionId: 'x',
  index: 0,
  headingText: '',
  oldHtml: '',
  newHtml: '',
  changed: false,
  ...over,
});

describe('buildReviewDoc', () => {
  it('returns concatenated oldHtml with no optimizer divs when all sections unchanged', () => {
    const out = buildReviewDoc([
      ev({ sectionId: 'a', index: 0, oldHtml: '<p>Intro</p>', changed: false }),
      ev({ sectionId: 'b', index: 1, oldHtml: '<h2>Why</h2><p>Body</p>', changed: false }),
    ]);
    expect(out).not.toContain('data-content-optimizer');
    expect(out).toContain('<p>Intro</p>');
    expect(out).toContain('<h2>Why</h2><p>Body</p>');
  });

  it('emits an optimizer div for a changed section with the right attributes', () => {
    const out = buildReviewDoc([
      ev({ sectionId: 'sec-1', index: 0, oldHtml: '<h2>A</h2>', newHtml: '<h2>A!</h2>', changed: true }),
    ]);
    expect(out).toContain('data-content-optimizer');
    expect(out).toContain('data-section-id="sec-1"');
    expect(out).toContain('data-index="0"');
    expect(out).toContain('data-status="active"');
    // the raw section HTML is NOT inlined — the NodeView reads it from the store
    expect(out).not.toContain('<h2>A!</h2>');
  });

  it('marks the first changed section active and later changed sections pending', () => {
    const out = buildReviewDoc([
      ev({ sectionId: 'a', index: 0, oldHtml: '<p>Intro</p>', changed: false }),
      ev({ sectionId: 'b', index: 1, oldHtml: '<h2>B</h2>', newHtml: '<h2>B!</h2>', changed: true }),
      ev({ sectionId: 'c', index: 2, oldHtml: '<h2>C</h2>', newHtml: '<h2>C!</h2>', changed: true }),
    ]);
    const bIdx = out.indexOf('data-section-id="b"');
    const cIdx = out.indexOf('data-section-id="c"');
    expect(out.slice(bIdx)).toContain('data-status="active"');
    // c's div should be pending
    const cDiv = out.slice(cIdx);
    expect(cDiv).toContain('data-status="pending"');
  });

  it('preserves order: unchanged section before the changed div', () => {
    const out = buildReviewDoc([
      ev({ sectionId: 'a', index: 0, oldHtml: '<p>Intro</p>', changed: false }),
      ev({ sectionId: 'b', index: 1, oldHtml: '<h2>B</h2>', newHtml: '<h2>B!</h2>', changed: true }),
    ]);
    expect(out.indexOf('<p>Intro</p>')).toBeLessThan(out.indexOf('data-content-optimizer'));
  });
});
