import { mergeArticleTermSources } from '../../lib/mergeArticleTerms';
import type { NlpTerm } from '../../lib/contentScore';

describe('mergeArticleTermSources', () => {
  it('keeps corpus terms that strict topic filter would drop', () => {
    const scoreDataTerms: NlpTerm[] = [
      { term: 'detektyw warszawa', target_count: 4 },
      { term: 'detektyw', target_count: 36 },
      { term: 'warszawa', target_count: 8 },
    ];
    const tableTerms = [
      { term: 'obserwacji', target_min: 1, target_max: 2, importance: 1, current_count: 0, term_type: 'topic', source: 'serp' },
      { term: 'dyskrecja', target_min: 1, target_max: 2, importance: 1, current_count: 0, term_type: 'topic', source: 'serp' },
      { term: 'wywiad', target_min: 1, target_max: 3, importance: 2, current_count: 0, term_type: 'topic', source: 'serp' },
    ] as const;
    const merged = mergeArticleTermSources({
      scoreDataTerms,
      tableTerms: [...tableTerms],
    });
    expect(merged.length).toBeGreaterThanOrEqual(6);
    expect(merged.some((t) => t.term === 'dyskrecja')).toBe(true);
    expect(merged.some((t) => t.term === 'obserwacji')).toBe(true);
  });

  it('prefers richer table list over thin score_data', () => {
    const thin: NlpTerm[] = [
      { term: 'detektyw warszawa', target_count: 4 },
      { term: 'detektyw', target_count: 36 },
    ];
    const tableTerms = Array.from({ length: 20 }, (_, i) => ({
      term: `detektyw term ${i + 1}`,
      target_min: 1,
      target_max: 2,
      importance: 1,
      current_count: 0,
      term_type: 'topic' as const,
      source: 'serp' as const,
    }));
    const merged = mergeArticleTermSources({ scoreDataTerms: thin, tableTerms });
    expect(merged.length).toBeGreaterThanOrEqual(20);
  });
});
