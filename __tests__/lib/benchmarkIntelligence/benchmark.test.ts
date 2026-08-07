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

  /**
   * `h2` here is every heading a competitor renders — H3s, nav, footer — not its count of
   * top-level sections. Taken literally it asked for 22 H2 on a 2200-word budget: ~100
   * words each, and a section brief too long for the model's output cap, which silently
   * dropped the whole brief. The reference tool reports the same wide heading range for
   * this keyword and still briefs six H2; the rest are H3 inside a section.
   */
  it('caps the section target at what the word budget supports', () => {
    const shortSectioned = (wordCount: number, h2: number) => ({
      wordCount,
      h2,
      faq: 8,
      tables: 2,
      lists: 12,
      images: 4,
      examples: 6,
      citations: 14,
      sectionLens: [Math.round(wordCount / h2)],
      introLen: 100,
      paragraphLens: [50],
    });

    const t = toPlannerTargets(buildStructuralBenchmark([
      shortSectioned(2100, 22),
      shortSectioned(2200, 24),
    ]));

    expect(t.h2).toBe(11);
    expect(t.h2SoftCeiling).toBe(t.h2);
    expect(Math.round(t.words / t.h2)).toBeGreaterThan(150);
  });

  /**
   * The real SERP for "prywatny detektyw warszawa": 447-1440 words, median 920, and the
   * reference tool recommends 1110-1277 across seven H2. The old 2200 floor overrode the
   * measurement and asked for twice the article, which the section count is derived from —
   * eleven sections of ~200 words, several covering the same ground.
   */
  it('follows a short SERP instead of doubling it', () => {
    const page = (wordCount: number, h2: number) => ({
      wordCount,
      h2,
      faq: 5,
      tables: 1,
      lists: 8,
      images: 2,
      examples: 4,
      citations: 6,
      sectionLens: [Math.round(wordCount / h2)],
      introLen: 90,
      paragraphLens: [45],
    });

    const t = toPlannerTargets(buildStructuralBenchmark([
      page(628, 8), page(1440, 14), page(1080, 12), page(447, 6), page(920, 10),
    ]));

    expect(t.words).toBeLessThan(1400);
    expect(t.h2).toBe(7);
  });
});
