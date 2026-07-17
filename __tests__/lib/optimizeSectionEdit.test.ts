import {
  computeMissingTerms,
  stripFences,
  isUsableEdit,
  isUsableWholeArticleEdit,
  shouldChargeCredit,
} from '../../lib/optimizeSectionEdit';
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

  it('removes a bare opening fence (no language tag)', () => {
    expect(stripFences('```\n<p>Hi</p>\n```')).toBe('<p>Hi</p>');
  });

  it('removes an uppercase HTML language tag', () => {
    expect(stripFences('```HTML\n<p>Hi</p>\n```')).toBe('<p>Hi</p>');
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

describe('isUsableWholeArticleEdit', () => {
  const original = '<h1>Title</h1><p>Long article body that must not be replaced by a truncated completion.</p>';

  it('rejects token-limited completions even when the HTML is otherwise long enough', () => {
    expect(isUsableWholeArticleEdit(`${original}<p>Extra paragraph.</p>`, original, 'length')).toBe(false);
  });

  it('rejects suspiciously short whole-article edits', () => {
    expect(isUsableWholeArticleEdit('<h1>Title</h1><p>Only the beginning.</p>', original, 'stop')).toBe(false);
  });

  it('accepts a complete whole-article edit', () => {
    expect(isUsableWholeArticleEdit(`${original}<p>Useful addition.</p>`, original, 'stop')).toBe(true);
  });
});

describe('shouldChargeCredit', () => {
  it('charges when there are changes and tokens were spent', () => {
    expect(shouldChargeCredit(2, 1500)).toBe(true);
  });

  it('does not charge when there are no changes (no credit deducted)', () => {
    expect(shouldChargeCredit(0, 1500)).toBe(false);
  });

  it('does not charge when no tokens were measured', () => {
    expect(shouldChargeCredit(3, 0)).toBe(false);
  });
});
