import { isCorpusNoiseSentence } from '../../lib/corpusNoiseFilter';
import { foldPolishLetters } from '../../lib/termUtils';

/** Every form the same sentence can reach us in from a scrape. */
const forms = (sentence: string) => ({
  composed: sentence.normalize('NFC'),
  decomposed: sentence.normalize('NFD'),
  stripped: sentence.normalize('NFD').replace(/[̀-ͯ]/g, ''),
});

describe('foldPolishLetters', () => {
  it('folds composed and decomposed Polish letters alike', () => {
    expect(foldPolishLetters('Zgodę')).toBe('zgode');
    expect(foldPolishLetters('Zgodę'.normalize('NFD'))).toBe('zgode');
    expect(foldPolishLetters('WIADOMOŚĆ')).toBe('wiadomosc');
  });

  /** The whole reason this is separate from normalizeTerm: it has to survive a regex. */
  it('leaves regex metacharacters untouched', () => {
    expect(foldPolishLetters('\\bczy chcesz,?\\s*żebym\\b')).toBe('\\bczy chcesz,?\\s*zebym\\b');
  });
});

describe('isCorpusNoiseSentence', () => {
  /**
   * These three never fired, on any input, before the fold. JavaScript's `\b` is
   * ASCII-only, so a word boundary after `ę`, `ć` or `ś` cannot match — the patterns
   * were dead the day they were written and the boilerplate sailed through as fact.
   */
  const asciiBoundaryVictims: Array<[string, string]> = [
    ['wyrażam zgodę', 'Niniejszym wyrażam zgodę na przetwarzanie moich danych osobowych przez serwis.'],
    ['twoja wiadomość', 'Wpisz imie oraz twoja wiadomość zostanie wysłana do naszego biura obsługi.'],
    ['czy chciałbyś', 'Powiedz proszę czy chciałbyś otrzymywać od nas dodatkowe informacje handlowe.'],
  ];

  it.each(asciiBoundaryVictims)('rejects boilerplate ending in a Polish letter: %s', (_label, sentence) => {
    expect(isCorpusNoiseSentence(sentence)).toBe(true);
  });

  /** Scraped HTML arrives NFC or NFD depending on the source CMS. Both are the same text. */
  it.each([
    ['wszelkie prawa zastrzeżone', 'Wszelkie prawa zastrzeżone przez właściciela serwisu internetowego dzisiaj.'],
    ['dowiedz się więcej', 'Kliknij poniżej i dowiedz się więcej o naszej ofercie usług detektywistycznych.'],
    ['polecane księgarnie', 'Polecane księgarnie internetowe znajdziesz w zestawieniu na dole tej strony.'],
  ])('rejects %s in every normalization form', (_label, sentence) => {
    const f = forms(sentence);
    expect(isCorpusNoiseSentence(f.composed)).toBe(true);
    expect(isCorpusNoiseSentence(f.decomposed)).toBe(true);
    expect(isCorpusNoiseSentence(f.stripped)).toBe(true);
  });

  /** Folding lowercases and strips punctuation-adjacent context, so these stay on raw text. */
  it.each([
    ['street address', 'Nasze biuro mieści się przy ul. Floriańskiej w samym centrum Krakowa.'],
    ['phone number', 'Zadzwoń do nas pod numer +48 123 456 789 w godzinach pracy biura.'],
    ['contact email', 'Napisz na admin@example.com jeśli potrzebujesz dodatkowych informacji.'],
  ])('still rejects %s, which folding would have broken', (_label, sentence) => {
    expect(isCorpusNoiseSentence(sentence)).toBe(true);
  });

  /** A street address is boilerplate in any casing — CMSes are not careful about it. */
  it.each([
    'Nasze biuro znajduje się przy ul. warszawska 12 obok dworca kolejowego.',
    'Adres korespondencyjny to UL. Warszawska 12 w centrum stolicy kraju.',
    'Zapraszamy do biura przy ulicy Złotej w samym sercu miasta stołecznego.',
  ])('rejects a street address whatever its case: %s', (sentence) => {
    expect(isCorpusNoiseSentence(sentence)).toBe(true);
  });

  /** "ulicach" is a plural noun in a sentence about the work, not an address. */
  it('keeps a topical sentence that merely mentions streets', () => {
    expect(isCorpusNoiseSentence(
      'Obserwacja prowadzona na ulicach Warszawy oraz w galeriach handlowych centrum.',
    )).toBe(false);
  });

  /** A phone number is boilerplate; a figure with a plus sign is the kind of claim we want. */
  it('does not mistake a statistic for a phone number', () => {
    expect(isCorpusNoiseSentence('Ruch organiczny wzrósł o +20 000 wizyt w skali całego kwartału.')).toBe(false);
  });

  it('keeps real topical sentences in every normalization form', () => {
    const f = forms('Licencja detektywistyczna jest wymagana przez ustawę o usługach detektywistycznych.');
    expect(isCorpusNoiseSentence(f.composed)).toBe(false);
    expect(isCorpusNoiseSentence(f.decomposed)).toBe(false);
    expect(isCorpusNoiseSentence(f.stripped)).toBe(false);
  });

  it('still applies the length and shape guards', () => {
    expect(isCorpusNoiseSentence('Za krótkie.')).toBe(true);
    expect(isCorpusNoiseSentence('SPRZEDAŻ HURTOWA ORAZ DETALICZNA W CAŁYM KRAJU DZISIAJ')).toBe(true);
  });
});
