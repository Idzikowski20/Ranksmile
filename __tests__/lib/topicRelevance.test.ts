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
});
