import { isKeywordOnTopic, filterOnTopicTerms, filterNlpTermsForAnalysis } from '../../lib/topicRelevance';

describe('topicRelevance', () => {
  it('rejects legal/education noise unrelated to detektyw warszawa', () => {
    const seed = 'detektyw warszawa';
    const garbage = [
      'test z lektury akademia pana kleksa klasa 4',
      'subkonto zus jak sprawdzic po zmar ej osobie',
      'hierarchia aktow prawnych w polsce schemat',
      'prawa boskie a prawa ludzkie',
      'walidacja a weryfikacja',
    ];
    for (const g of garbage) {
      expect(isKeywordOnTopic(g, seed)).toBe(false);
    }
  });

  it('accepts on-topic detective phrases', () => {
    const seed = 'detektyw warszawa';
    expect(isKeywordOnTopic('prywatny detektyw', seed)).toBe(true);
    expect(isKeywordOnTopic('biuro detektywistyczne warszawa', seed)).toBe(true);
    expect(isKeywordOnTopic('detektyw warszawa zdrady', seed)).toBe(true);
    expect(isKeywordOnTopic('wykrywanie zdrady', seed)).toBe(false);
  });

  it('does not match via substring of warszawa (e.g. letter "a")', () => {
    expect(isKeywordOnTopic('jak sprawdzic waznosc e recepty', 'detektyw warszawa')).toBe(false);
  });

  it('filterOnTopicTerms removes garbage from list', () => {
    const terms = [
      { term: 'detektyw warszawa' },
      { term: 'test z lektury pan tadeusz' },
      { term: 'prywatny detektyw' },
    ];
    const out = filterOnTopicTerms(terms, 'detektyw warszawa');
    expect(out.map((t) => t.term)).toEqual(['detektyw warszawa', 'prywatny detektyw']);
  });
});

describe('filterNlpTermsForAnalysis', () => {
  it('falls back to soft filter when strict matching removes too many SERP terms', () => {
    const seed = 'sposoby na wykrycie zdrady';
    const terms = [
      { term: 'sposoby na wykrycie zdrady' },
      { term: 'oznaki zdrady partnera' },
      { term: 'podejrzewa zdrady' },
      { term: 'telefon partnera' },
      { term: 'zmiany w zwiazku' },
      { term: 'test z lektury pan tadeusz' },
      { term: 'nastroj partnera' },
      { term: 'zachowanie partnera' },
      { term: 'historia wiadomosci' },
      { term: 'brak zaufania' },
      { term: 'relacja partnerska' },
      { term: 'sygnaly ostrzegawcze' },
      { term: 'kontrola telefonu' },
    ];
    const out = filterNlpTermsForAnalysis(terms, seed);
    expect(out.length).toBeGreaterThanOrEqual(3);
    expect(out.map((t) => t.term)).not.toContain('test z lektury pan tadeusz');
    expect(out.map((t) => t.term)).toContain('oznaki zdrady partnera');
  });

  it('keeps Polish inflections and related SERP competitor terms for hybrid-war keyword', () => {
    const seed = 'wojna hybrydowa w polsce';
    const terms = [
      { term: 'wojna hybrydowa' },
      { term: 'konflikt hybrydowy' },
      { term: 'wojny hybrydowej' },
      { term: 'dzialania hybrydowe' },
      { term: 'dezinformacja' },
      { term: 'cyberataki' },
      { term: 'bezpieczenstwo panstwa' },
      { term: 'granica polsko bialoruska' },
      { term: 'test z lektury pan tadeusz' },
    ];
    const out = filterNlpTermsForAnalysis(terms, seed);
    const labels = out.map((t) => t.term);
    expect(labels).toContain('wojna hybrydowa');
    expect(labels).toContain('konflikt hybrydowy');
    expect(labels).toContain('wojny hybrydowej');
    expect(labels).toContain('dzialania hybrydowe');
    expect(labels).toContain('dezinformacja');
    expect(labels).not.toContain('test z lektury pan tadeusz');
    // Off-seed multi-word without stem overlap is no longer free-passed
    expect(labels).not.toContain('bezpieczenstwo panstwa');
    expect(out.length).toBeGreaterThanOrEqual(5);
  });

  it('rejects gaming/book related-search pollution even when seed token matches', () => {
    const seed = 'szantaz';
    const terms = [
      { term: 'szantaz' },
      { term: 'szantaz metin2' },
      { term: 'szantaz emocjonalny ksiazka' },
      { term: 'szantaz policja' },
      { term: 'grozba bezprawna' },
    ];
    const out = filterNlpTermsForAnalysis(terms, seed);
    const labels = out.map((t) => t.term);
    expect(labels).not.toContain('szantaz metin2');
    expect(labels).not.toContain('szantaz emocjonalny ksiazka');
    expect(labels).toContain('szantaz');
  });
});

describe('isKeywordOnTopic Polish stems', () => {
  it('matches hybrydowa / hybrydowy / hybrydowej inflection family', () => {
    const seed = 'wojna hybrydowa w polsce';
    expect(isKeywordOnTopic('konflikt hybrydowy', seed)).toBe(true);
    expect(isKeywordOnTopic('wojny hybrydowej', seed)).toBe(true);
    expect(isKeywordOnTopic('dzialania hybrydowe', seed)).toBe(true);
  });
});

/**
 * Measured against Surfer's published term list for "prywatny detektyw warszawa".
 * The seed-overlap rule kept 12 of these 39 and every survivor contained "detektyw" —
 * the vocabulary that actually differentiates the article was thrown away.
 */
describe('filterNlpTermsForAnalysis keeps corpus-backed vocabulary', () => {
  const KEYWORD = 'prywatny detektyw warszawa';
  const term = (t: string, doc_freq = 3) => ({ term: t, doc_freq });

  const OFF_SEED = [
    'wykrywanie podsłuchów', 'sprawy rozwodowej', 'materiałów dowodowych',
    'wywiadzie gospodarczym', 'ubezpieczenie oc', 'kancelarie prawne',
    'nieuczciwej konkurencji', 'postępowaniach sądowych', 'sprawach rodzinnych',
  ];

  it('keeps terms several competitors used even without the keyword in them', () => {
    const kept = filterNlpTermsForAnalysis(OFF_SEED.map((t) => term(t)), KEYWORD);

    expect(kept.map((t) => t.term)).toEqual(expect.arrayContaining(OFF_SEED));
  });

  it('still keeps the strict seed matches', () => {
    const kept = filterNlpTermsForAnalysis(
      [term('prywatny detektyw'), term('biuro detektywistyczne'), ...OFF_SEED.map((t) => term(t))],
      KEYWORD,
    );

    expect(kept.map((t) => t.term)).toEqual(expect.arrayContaining(['prywatny detektyw', 'biuro detektywistyczne']));
    expect(new Set(kept.map((t) => t.term)).size).toBe(kept.length);
  });

  /** Corpus evidence is the licence to skip seed matching — one stray page is not. */
  it('does not let a single-document off-topic phrase in', () => {
    const kept = filterNlpTermsForAnalysis(
      [term('prywatny detektyw'), term('subkonto zus', 1), term('test z lektury', 1)],
      KEYWORD,
    );

    expect(kept.map((t) => t.term)).not.toEqual(expect.arrayContaining(['subkonto zus', 'test z lektury']));
  });

  it('rejects known noise however many competitors repeat it', () => {
    const kept = filterNlpTermsForAnalysis(
      [term('prywatny detektyw'), term('metin2', 9), term('lubimyczytac', 9)],
      KEYWORD,
    );

    expect(kept.map((t) => t.term)).toEqual(['prywatny detektyw']);
  });
});
