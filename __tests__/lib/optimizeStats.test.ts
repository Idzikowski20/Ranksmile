import { computeOptimizeStats } from '../../lib/optimizeStats';

describe('computeOptimizeStats', () => {
  it('returns zeroed stats for an empty changed list', () => {
    expect(computeOptimizeStats([])).toEqual({ wordsAdded: 0, adjustments: [] });
  });

  it('reports a positive wordDelta and carries the heading through for a section that grew', () => {
    const stats = computeOptimizeStats([
      { headingText: 'Why it matters', oldHtml: '<p>One two three.</p>', newHtml: '<p>One two three four five six.</p>' },
    ]);
    expect(stats.adjustments).toEqual([{ heading: 'Why it matters', wordDelta: 3 }]);
    expect(stats.wordsAdded).toBe(3);
  });

  it('strips tags/entities and sums per-section deltas including a shrink', () => {
    const stats = computeOptimizeStats([
      // +4 words (6 → 10), with tags/entities that must be stripped
      { headingText: 'Intro', oldHtml: '<h2>Intro</h2><p>a b c d e f</p>', newHtml: '<h2>Intro</h2><p>a b&nbsp;c d e f g h i j</p>' },
      // -2 words (5 → 3)
      { headingText: 'Trim', oldHtml: '<p>one two three four five</p>', newHtml: '<p>one two three</p>' },
    ]);
    expect(stats.adjustments).toEqual([
      { heading: 'Intro', wordDelta: 4 },
      { heading: 'Trim', wordDelta: -2 },
    ]);
    // wordsAdded is the sum of every per-section delta (positive + negative)
    expect(stats.wordsAdded).toBe(2);
    expect(stats.wordsAdded).toBe(stats.adjustments.reduce((sum, a) => sum + a.wordDelta, 0));
  });
});
