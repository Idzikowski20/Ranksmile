import { buildStructuralBenchmark, toPlannerTargets } from '../../../lib/benchmarkIntelligence';

describe('Benchmark Intelligence', () => {
  it('uses median not mean when outlier present', () => {
    const b = buildStructuralBenchmark([
      {
        wordCount: 3000,
h2: 14,
faq: 6,
tables: 1,
lists: 10,
images: 3,
examples: 4,
citations: 10,
        sectionLens: [200],
introLen: 80,
paragraphLens: [40, 45],
      },
      {
        wordCount: 3200,
h2: 15,
faq: 7,
tables: 2,
lists: 11,
images: 3,
examples: 5,
citations: 12,
        sectionLens: [220],
introLen: 90,
paragraphLens: [42],
      },
      {
        wordCount: 9000,
h2: 40,
faq: 20,
tables: 8,
lists: 40,
images: 20,
examples: 30,
citations: 50,
        sectionLens: [800],
introLen: 200,
paragraphLens: [100],
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
        wordCount: 3600,
h2: 16,
faq: 8,
tables: 2,
lists: 12,
images: 4,
examples: 6,
citations: 14,
        sectionLens: [250],
introLen: 100,
paragraphLens: [50],
      },
      {
        wordCount: 3700,
h2: 17,
faq: 9,
tables: 2,
lists: 13,
images: 4,
examples: 6,
citations: 15,
        sectionLens: [260],
introLen: 110,
paragraphLens: [52],
      },
    ]);
    const t = toPlannerTargets(b);
    expect(t.words).toBeGreaterThanOrEqual(2200);
    expect(t.h2).toBeGreaterThanOrEqual(7);
    expect(t.wordsSoftCeiling).toBeGreaterThanOrEqual(t.words);
  });

  /**
   * `b.h2` counts every heading level, so a heading-dense SERP (median 23, H3 included)
   * says nothing about how many TOP-LEVEL sections an article needs. The word budget is
   * the honest constraint: 2200/200 = 11 sections of 200 words each. Taking the measured
   * number literally, or capping it at H2_HARD_MAX, asked for sixteen.
   */
  it('sizes sections from the word budget on a heading-dense SERP', () => {
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
    // Every section long enough to be worth writing — the reference article runs ~207.
    expect(Math.round(t.words / t.h2)).toBe(200);
  });

  /**
   * The real SERP for "prywatny detektyw warszawa": 447-1440 words, median 920, max 1440.
   * The reference tool asks for 1400-1610 across the seven H2 its own article ships — the
   * top of the field, not the middle. Its low bound IS our max.
   */
  it('matches the reference tool on the real SERP', () => {
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

    // 1440 against the reference tool's 1400 — within 3%.
    expect(t.words).toBe(1440);
    // Seven, exactly what the reference article ships, straight out of 1440/200.
    expect(t.h2).toBe(7);
  });
});

/**
 * Article 18's SERP measured median 920, p75 1080, max 1440 — and the reference tool
 * asked for 1400-1610 on the same set. Median and p75 both plan an article shorter than
 * the longest page already ranking, which outranks nothing.
 */
describe('toPlannerTargets word target', () => {
  const benchmark = {
    words: { median: 920, p25: 628, p75: 1080, min: 447, max: 1440, mean: 903, n: 5 },
    h2: { median: 13, p25: 11, p75: 14, min: 8, max: 22, mean: 14, n: 5 },
    faq: { median: 5 },
tables: { median: 1 },
lists: { median: 8 },
    images: { median: 2 },
examples: { median: 4 },
citations: { median: 6 },
  } as unknown as Parameters<typeof toPlannerTargets>[0];

  it('aims at the top of the field, where the reference tool aims', () => {
    const t = toPlannerTargets(benchmark);
    expect(t.words).toBe(1440); // reference tool: 1400
    expect(t.wordsSoftCeiling).toBe(1613); // reference tool: 1610
  });

  it("plans the reference article's own section length", () => {
    const t = toPlannerTargets(benchmark);
    expect(t.h2).toBe(7);
    expect(Math.round(t.words / t.h2)).toBe(206); // the reference article runs 207
  });

  /**
   * `max` alone would let a single outlier define the brief — one competitor on the
   * "prywatny detektyw" SERP publishes 15,727 words, and the reference tool had it
   * deselected. Twice the median is the ceiling on how far one page may pull the target.
   */
  it('clamps a runaway competitor to twice the median', () => {
    const outlier = { ...benchmark, words: { ...benchmark.words, max: 15727 } } as typeof benchmark;
    expect(toPlannerTargets(outlier).words).toBe(1840);
  });

  it('falls back to the median when nothing longer was measured', () => {
    const noMax = { ...benchmark, words: { ...benchmark.words, max: 0 } } as typeof benchmark;
    expect(toPlannerTargets(noMax).words).toBe(920);
  });
});
