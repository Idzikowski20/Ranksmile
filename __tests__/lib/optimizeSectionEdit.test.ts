import { computeMissingTerms, stripFences, isUsableEdit } from '../../lib/optimizeSectionEdit';
import type { ScoreData } from '../../lib/contentScore';

const baseScore = (terms: ScoreData['terms']): ScoreData => ({
  terms,
  words_target: 1000,
  words_min: 800,
  words_max: 1200,
  headings_target: 10,
  headings_min: 8,
  headings_max: 12,
});

describe('computeMissingTerms', () => {
  it('reports a term that never appears as missing', () => {
    const score = baseScore([{ term: 'quantum computing', target_count: 3 }]);
    const out = computeMissingTerms(score, '<p>This article is about gardening and soil.</p>');
    expect(out).toContain('quantum computing');
  });

  it('does not report a term that is sufficiently present', () => {
    const score = baseScore([{ term: 'garden', target_count: 2 }]);
    const out = computeMissingTerms(score, '<p>A garden needs care. Every garden is unique. I love my garden.</p>');
    expect(out).not.toContain('garden');
  });

  it('reports an underused term (present but below ~70% of target)', () => {
    const score = baseScore([{ term: 'compost', target_count: 10 }]);
    // appears once, well below ceil(10*0.7)=7
    const out = computeMissingTerms(score, '<p>Use compost for the soil.</p>');
    expect(out).toContain('compost');
  });

  it('returns an empty array when scoreData is undefined', () => {
    expect(computeMissingTerms(undefined, '<p>anything</p>')).toEqual([]);
  });

  it('returns an empty array when there are no terms', () => {
    expect(computeMissingTerms(baseScore([]), '<p>anything</p>')).toEqual([]);
  });
});

describe('stripFences', () => {
  it('removes leading ```html fence and trailing ``` fence', () => {
    expect(stripFences('```html\n<p>Hi</p>\n```')).toBe('<p>Hi</p>');
  });

  it('removes a trailing ``` fence', () => {
    expect(stripFences('<p>Hi</p>\n```')).toBe('<p>Hi</p>');
  });

  it('leaves unfenced content untouched', () => {
    expect(stripFences('  <p>Hi</p>  ')).toBe('<p>Hi</p>');
  });
});

describe('isUsableEdit', () => {
  it('rejects empty output', () => {
    expect(isUsableEdit('')).toBe(false);
  });

  it('rejects too-short output', () => {
    expect(isUsableEdit('<p>x</p>')).toBe(false);
  });

  it('accepts a real section of HTML', () => {
    expect(isUsableEdit('<h2>Heading</h2><p>A real paragraph of content here.</p>')).toBe(true);
  });
});
