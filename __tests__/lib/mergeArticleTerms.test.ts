import { importantTermsFromScoreData, mergeArticleTermSources } from '../../lib/mergeArticleTerms';
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

/**
 * The compiled write plan takes the first N of this list, so what falls past the cap is
 * what the writer never weaves in. `mergeNlpTerms` returns Map insertion order — table
 * rows first, in query order — so before ranking, a core term from the analysis could be
 * cut while a marginal activated term survived, and a different one went each time the
 * rows came back in a different order.
 */
describe('importantTermsFromScoreData ranks before it truncates', () => {
  const scoreData = {
    terms: [
      { term: 'prywatny detektyw', target_count: 25 },
      { term: 'wywiad gospodarczy', target_count: 9 },
    ],
  };
  const tableTerms = [
    { term: 'marginalny termin', importance: 1, target_min: 1, target_max: 1, current_count: 0 },
    { term: 'wykrywanie podsluchow', importance: 14, target_min: 3, target_max: 14, current_count: 0 },
  ] as unknown as Parameters<typeof importantTermsFromScoreData>[1] extends { tableTerms?: infer T } ? T : never;

  it('keeps the strongest terms when the cap bites', () => {
    const kept = importantTermsFromScoreData(scoreData, { max: 2, tableTerms });

    expect(kept).toEqual(['prywatny detektyw', 'wykrywanie podsluchow']);
  });

  it('returns the same list whatever order the table rows arrive in', () => {
    const forward = importantTermsFromScoreData(scoreData, { max: 4, tableTerms });
    const reversed = importantTermsFromScoreData(scoreData, {
      max: 4,
      tableTerms: [...(tableTerms as unknown[])].reverse() as typeof tableTerms,
    });

    expect(reversed).toEqual(forward);
  });
});
