import { calibrateTermRangesFromCorpus, filterUsefulNlpTerms, isWeakTermList, scaleTermRangesToWordCount, hasMinCompetitorDomains } from '../../lib/competitorTermCalibration';
import type { NlpTerm } from '../../lib/contentScore';
import { computeAiSearchScore } from '../../lib/aiSearchScore';

describe('competitorTermCalibration', () => {
  it('filters Polish stopwords from term lists', () => {
    const raw: NlpTerm[] = [
      { term: 'oraz', target_count: 2 },
      { term: 'prywatny detektyw', target_count: 5 },
      { term: 'jest', target_count: 1 },
      { term: 'biuro detektywistyczne', target_count: 4 },
    ];
    const filtered = filterUsefulNlpTerms(raw);
    expect(filtered.map((t) => t.term)).toEqual(['prywatny detektyw', 'biuro detektywistyczne']);
  });

  it('detects weak term lists dominated by stopwords', () => {
    const weak: NlpTerm[] = [
      { term: 'oraz', target_count: 2 },
      { term: 'detektyw', target_count: 3 },
      { term: 'sprawy', target_count: 2 },
      { term: 'jest', target_count: 1 },
      { term: 'lub', target_count: 1 },
      { term: 'czy', target_count: 1 },
      { term: 'jak', target_count: 1 },
      { term: 'wielu', target_count: 1 },
      { term: 'informacji', target_count: 1 },
      { term: 'warto', target_count: 1 },
      { term: 'detektyw warszawa', target_count: 2 },
      { term: 'dzialania', target_count: 1 },
    ];
    expect(isWeakTermList(weak, 'detektyw warszawa')).toBe(true);
  });

  it('calibrates min-max ranges from competitor corpus', () => {
    const corpus = [
      'prywatny detektyw warszawa oferuje uslugi detektywistyczne',
      'prywatny detektyw prywatny detektyw biuro detektywistyczne',
      'biuro detektywistyczne w warszawie prywatny detektyw',
    ];
    const terms: NlpTerm[] = [{ term: 'prywatny detektyw', target_count: 1 }];
    const [calibrated] = calibrateTermRangesFromCorpus(terms, corpus);
    expect(calibrated.suggested_min).toBeGreaterThanOrEqual(1);
    expect(calibrated.suggested_max).toBeGreaterThanOrEqual(calibrated.suggested_min!);
    expect(calibrated.suggested_max).toBeGreaterThanOrEqual(Math.max(...corpus.map((c) => (c.match(/prywatny detektyw/g) || []).length)));
    expect(calibrated.target_count).toBeGreaterThanOrEqual(1);
  });

  it('applies max+12% ceiling on suggested_max', () => {
    const corpus = ['prywatny detektyw '.repeat(10), 'prywatny detektyw '.repeat(5)];
    const terms: NlpTerm[] = [{ term: 'prywatny detektyw', target_count: 1 }];
    const [calibrated] = calibrateTermRangesFromCorpus(terms, corpus);
    expect(calibrated.suggested_max).toBe(Math.ceil(10 * 1.12));
  });

  it('scales term ranges to article word count', () => {
    const terms: NlpTerm[] = [{ term: 'detektyw', suggested_min: 2, suggested_max: 8, target_count: 5 }];
    const scaled = scaleTermRangesToWordCount(terms, 1100, 2200);
    expect(scaled[0].suggested_max).toBeLessThan(8);
    expect(scaled[0].target_count).toBeLessThan(5);
  });

  it('requires at least 3 competitor domains', () => {
    expect(hasMinCompetitorDomains(['a.com', 'b.com'])).toBe(false);
    expect(hasMinCompetitorDomains(['a.com', 'b.com', 'c.com'])).toBe(true);
  });
});

describe('computeAiSearchScore', () => {
  it('scores content readiness, not SERP own-domain citations', () => {
    const score = computeAiSearchScore({
      prompts_total: 10,
      prompts_cited: 7,
      competitor_citations: 20,
      extractability_score: 72,
      citations: Array.from({ length: 10 }, (_, i) => ({
        prompt: `topic ${i}`,
        answer_readiness_score: i < 7 ? 80 : 30,
      })),
    });
    expect(score).toBeGreaterThan(40);
  });
});
