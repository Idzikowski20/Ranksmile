import { calibrateTermRangesFromCorpus, filterUsefulNlpTerms, isWeakTermList, scaleTermRangesToWordCount, hasMinCompetitorDomains } from '@/src/core/domain/competitors/termCalibration';
import type { NlpTerm } from '@/src/infrastructure/contentScore';
import { computeAiSearchScore } from '@/src/core/domain/aiScore/aiSearchScore';

describe('competitorTermCalibration', () => {
  /**
   * The whole point of shipping term_words_regexps from the sidecar is that calibration
   * counts inflected corpus forms, not just the base form. Nothing asserted that the
   * regexps actually reach countOccurrences, so the ranges could silently fall back to
   * exact matching and every suggested_min/max would quietly halve.
   */
  it('counts inflected corpus forms when term_words_regexps are present', () => {
    const corpus = [
      'Usługi detektywistyczne w Krakowie. Usług detektywistycznych szukają firmy.',
      'Oferujemy usługa detektywistyczna oraz usługi detektywistyczne dla klientów.',
    ];
    const withRegexps: NlpTerm[] = [{
      term: 'usługi detektywistyczne',
      target_count: 1,
      term_words_regexps: [
        '(?:usługi|usług|usługa)',
        '(?:detektywistyczne|detektywistycznych|detektywistyczna)',
      ],
    }];
    // Same term, regexps that only admit the base form. Comparing against this rather
    // than against the no-regexp case isolates the annotated path: countOccurrences has
    // its own fuzzy fallback, so a bare term already counts some inflections and the two
    // would tie without proving the regexps were read at all.
    const baseFormOnly: NlpTerm[] = [{
      term: 'usługi detektywistyczne',
      target_count: 1,
      term_words_regexps: ['(?:usługi)', '(?:detektywistyczne)'],
    }];

    const [lemma] = calibrateTermRangesFromCorpus(withRegexps, corpus);
    const [base] = calibrateTermRangesFromCorpus(baseFormOnly, corpus);

    expect(lemma.doc_freq).toBe(2);
    expect(lemma.target_count).toBeGreaterThan(base.target_count ?? 0);
    expect(lemma.suggested_max).toBeGreaterThanOrEqual(lemma.target_count ?? 0);
    expect(lemma.suggested_min).toBeGreaterThan(0);
  });

  it('filters Polish stopwords from term lists', () => {
    const raw: NlpTerm[] = [
      { term: 'oraz', target_count: 2 },
      { term: 'prywatny detektyw', target_count: 5 },
      { term: 'jest', target_count: 1 },
      { term: 'biuro detektywistyczne', target_count: 4 },
    ];
    const filtered = filterUsefulNlpTerms(raw);
    // Equal salience/words/doc_freq: localeCompare now orders them deterministically.
    expect(filtered.map((t) => t.term)).toEqual(['biuro detektywistyczne', 'prywatny detektyw']);
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

describe('calibrateTermRangesFromCorpus floors', () => {
  const term: NlpTerm[] = [{ term: 'agencja detektywistyczna', target_count: 1 }];

  it('floors at the average usage, not the single lowest page on the SERP', () => {
    // One page uses it once; the rest lean on it heavily. Taking the minimum published
    // "1-29" and gave the writer no reason to weave the head term in more than once.
    const corpus = [
      'agencja detektywistyczna',
      Array(12).fill('agencja detektywistyczna').join(' i '),
      Array(16).fill('agencja detektywistyczna').join(' oraz '),
    ];

    const [calibrated] = calibrateTermRangesFromCorpus(term, corpus);

    expect(calibrated.suggested_min).toBeGreaterThan(1);
    expect(calibrated.suggested_min).toBe(calibrated.target_count);
    expect(calibrated.suggested_max).toBeGreaterThanOrEqual(calibrated.suggested_min ?? 0);
  });

  it('never lets the floor cross the ceiling', () => {
    const [calibrated] = calibrateTermRangesFromCorpus(term, ['agencja detektywistyczna']);
    expect(calibrated.suggested_min).toBeLessThanOrEqual(calibrated.suggested_max ?? 0);
  });
});
