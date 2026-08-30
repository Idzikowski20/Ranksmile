import { suggestedTermRange, MAX_TERM_OCCURRENCES } from '@/src/core/domain/terms/termUtils';
import { filterNlpTermsForAnalysis } from '@/src/core/domain/relevance/topicRelevance';

describe('suggestedTermRange', () => {
  it('caps a corpus occurrence total so the target stays reachable', () => {
    // extract_nlp_terms returns the corpus total; article 86 was told to use it 41-95 times.
    expect(suggestedTermRange({ target_count: 59 })).toEqual({ min: 12, max: MAX_TERM_OCCURRENCES });
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
