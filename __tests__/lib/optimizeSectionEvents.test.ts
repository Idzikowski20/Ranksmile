import { buildSectionEvents, buildSectionEvent, buildArticleSectionDiffEvents } from '../../lib/optimizeSectionEvents';
import type { SectionResult } from '../../components/articles/optimizeStore';

const sections = [
  { id: 'a1', index: 0, headingText: '', html: '<p>Intro</p>' },
  { id: 'b2', index: 1, headingText: 'Why', html: '<h2>Why</h2><p>Body</p>' },
];

describe('buildArticleSectionDiffEvents', () => {
  it('marks only changed sections and keeps before section ids', () => {
    const before = '<p>Intro</p><h2>Why</h2><p>Old</p>';
    const after = '<p>Intro</p><h2>Why</h2><p>New body text</p>';
    const ev = buildArticleSectionDiffEvents(before, after, { reason: 'test', mode: 'less', focus: 'ai-coverage' });
    expect(ev.length).toBe(2);
    expect(ev[0].changed).toBe(false);
    expect(ev[1].changed).toBe(true);
    expect(ev[1].oldHtml).toContain('Old');
    expect(ev[1].newHtml).toContain('New body');
    expect(ev[1].reason).toBe('test');
    // id from BEFORE split — stable for client mapping
    expect(ev[1].sectionId).toMatch(/^sec_/);
  });

  it('appends new FAQ section as changed event', () => {
    const before = '<h2>A</h2><p>aaa</p>';
    const after = '<h2>A</h2><p>aaa</p><h2>FAQ</h2><h3>Q?</h3><p>Answer text here.</p>';
    const ev = buildArticleSectionDiffEvents(before, after);
    expect(ev.some((e) => e.changed && e.newHtml.includes('FAQ'))).toBe(true);
  });
});

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

describe('buildSectionEvent', () => {
  it('passes a section through unchanged when result is undefined', () => {
    expect(buildSectionEvent(sections[0])).toEqual({
      sectionId: 'a1', index: 0, headingText: '', oldHtml: '<p>Intro</p>', newHtml: '<p>Intro</p>', changed: false,
    });
  });

  it('reflects a provided result', () => {
    const r: SectionResult = { oldHtml: '<h2>Why</h2><p>Body</p>', newHtml: '<h2>Why</h2><p>New</p>', changed: true };
    expect(buildSectionEvent(sections[1], r)).toEqual({
      sectionId: 'b2', index: 1, headingText: 'Why', oldHtml: '<h2>Why</h2><p>Body</p>', newHtml: '<h2>Why</h2><p>New</p>', changed: true,
    });
  });
});
