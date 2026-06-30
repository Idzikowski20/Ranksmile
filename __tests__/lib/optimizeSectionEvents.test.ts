import { buildSectionEvents } from '../../lib/optimizeSectionEvents';
import type { SectionResult } from '../../components/articles/optimizeStore';

const sections = [
  { id: 'a1', index: 0, headingText: '', html: '<p>Intro</p>' },
  { id: 'b2', index: 1, headingText: 'Why', html: '<h2>Why</h2><p>Body</p>' },
];

describe('buildSectionEvents', () => {
  it('passes sections through unchanged when results map is empty', () => {
    const ev = buildSectionEvents(sections, new Map());
    expect(ev).toHaveLength(2);
    expect(ev[0]).toEqual({ sectionId: 'a1', index: 0, headingText: '', oldHtml: '<p>Intro</p>', newHtml: '<p>Intro</p>', changed: false });
    expect(ev[1].changed).toBe(false);
    expect(ev[1].oldHtml).toBe(ev[1].newHtml);
  });

  it('reflects a result entry for a matching sectionId, others stay passthrough', () => {
    const results = new Map<string, SectionResult>([
      ['b2', { oldHtml: '<h2>Why</h2><p>Body</p>', newHtml: '<h2>Why</h2><p>Better body</p>', changed: true }],
    ]);
    const ev = buildSectionEvents(sections, results);
    expect(ev[0].changed).toBe(false);                       // a1 passthrough
    expect(ev[1]).toMatchObject({ sectionId: 'b2', changed: true, newHtml: '<h2>Why</h2><p>Better body</p>' });
  });

  it('preserves section order and index', () => {
    const ev = buildSectionEvents(sections, new Map());
    expect(ev.map((e) => e.index)).toEqual([0, 1]);
  });
});
