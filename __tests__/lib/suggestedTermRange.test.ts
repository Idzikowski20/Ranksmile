import { suggestedTermRange, MAX_TERM_OCCURRENCES } from '@/src/core/domain/terms/termUtils';
import { filterNlpTermsForAnalysis } from '@/src/core/domain/relevance/topicRelevance';

describe('suggestedTermRange', () => {
  it('caps a corpus occurrence total and keeps the band proportional', () => {
    // extract_nlp_terms returns the corpus total; article 86 was told to use it 41-95
    // times. Flattening min onto the cap produced `need 12-12` — a point target the
    // article can only overshoot — so the min scales down with the max.
    const { min, max } = suggestedTermRange({ target_count: 59 });
    expect(max).toBe(MAX_TERM_OCCURRENCES);
    expect(min).toBeLessThan(max);
    expect(min).toBeGreaterThanOrEqual(1);
  });

  it('lets the range breathe when the article word target is known', () => {
    // Surfer's guideline for this keyword allows "szantaż: 44-87" against ~2500 words.
    const { min, max } = suggestedTermRange({ suggested_min: 44, suggested_max: 87 }, 2500);
    expect(max).toBe(87);
    expect(min).toBe(44);
  });

  it('keeps a sane explicit range untouched', () => {
    expect(suggestedTermRange({ target_count: 4, suggested_min: 2, suggested_max: 5 }))
      .toEqual({ min: 2, max: 5 });
  });

  it('never returns min above max', () => {
    const { min, max } = suggestedTermRange({ target_count: 3, suggested_min: 40, suggested_max: 90 });
    expect(min).toBeLessThanOrEqual(max);
  });
});

describe('weak keyword long-tail', () => {
  const seed = 'szantaż emocjonalny';

  it('drops autocomplete long-tails backed by one or two pages', () => {
    const kept = filterNlpTermsForAnalysis(
      [
        { term: 'szantaż emocjonalny teściowej', doc_freq: 2 },
        { term: 'szantaż emocjonalny empik', doc_freq: 1 },
        { term: 'szantaż emocjonalny w związku', doc_freq: 6 },
        { term: 'przemoc psychiczna', doc_freq: 5 },
      ],
      seed,
    ).map((t) => t.term);

    expect(kept).toContain('szantaż emocjonalny w związku');
    expect(kept).toContain('przemoc psychiczna');
    expect(kept).not.toContain('szantaż emocjonalny teściowej');
    expect(kept).not.toContain('szantaż emocjonalny empik');
  });

  it('keeps the keyword itself', () => {
    const kept = filterNlpTermsForAnalysis([{ term: 'szantaż emocjonalny', doc_freq: 1 }], seed)
      .map((t) => t.term);

    expect(kept).toEqual(['szantaż emocjonalny']);
  });
});
