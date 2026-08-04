import { buildStructuralBenchmark, toPlannerTargets } from '../../../lib/benchmarkIntelligence';

describe('Benchmark Intelligence', () => {
  it('uses median not mean when outlier present', () => {
    const b = buildStructuralBenchmark([
      {
        wordCount: 3000, h2: 14, faq: 6, tables: 1, lists: 10, images: 3, examples: 4, citations: 10,
        sectionLens: [200], introLen: 80, paragraphLens: [40, 45],
      },
      {
        wordCount: 3200, h2: 15, faq: 7, tables: 2, lists: 11, images: 3, examples: 5, citations: 12,
        sectionLens: [220], introLen: 90, paragraphLens: [42],
      },
      {
        wordCount: 9000, h2: 40, faq: 20, tables: 8, lists: 40, images: 20, examples: 30, citations: 50,
        sectionLens: [800], introLen: 200, paragraphLens: [100],
      },
    ]);
    expect(b.words.median).toBeLessThan(4000);
    expect(b.words.mean).toBeGreaterThan(b.words.median);
    expect(b.words.p25).toBeLessThanOrEqual(b.words.median);
    expect(b.words.p75).toBeGreaterThanOrEqual(b.words.median);
  });

  it('toPlannerTargets prefers median floors', () => {
    const b = buildStructuralBenchmark([
      {
        wordCount: 3600, h2: 16, faq: 8, tables: 2, lists: 12, images: 4, examples: 6, citations: 14,
        sectionLens: [250], introLen: 100, paragraphLens: [50],
      },
      {
        wordCount: 3700, h2: 17, faq: 9, tables: 2, lists: 13, images: 4, examples: 6, citations: 15,
        sectionLens: [260], introLen: 110, paragraphLens: [52],
      },
    ]);
    const t = toPlannerTargets(b);
    expect(t.words).toBeGreaterThanOrEqual(2200);
    expect(t.h2).toBeGreaterThanOrEqual(7);
    expect(t.wordsSoftCeiling).toBeGreaterThanOrEqual(t.words);
  });
});
