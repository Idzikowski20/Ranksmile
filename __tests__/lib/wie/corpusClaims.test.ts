import { extractCorpusClaims, extractCorpusClaimsByUrl } from '../../../lib/wie/corpusClaims';

const BODY = [
  'Detektyw w Krakowie prowadzi sprawy rozwodowe oraz gospodarcze.',
  'Licencja detektywistyczna jest wymagana przez ustawe z 2001 roku.',
  'Stawka godzinowa wynosi zwykle od 150 do 300 zlotych.',
  'This website uses cookies to improve your experience.',
  'Wszelkie prawa zastrzezone.',
  'Raport koncowy moze zostac wykorzystany jako dowod w postepowaniu sadowym.',
].join(' ');

describe('extractCorpusClaims', () => {
  it('keeps sentences that name the topic, carry a figure, or assert a property', () => {
    const claims = extractCorpusClaims(BODY, 'detektyw krakow');

    expect(claims).toEqual(expect.arrayContaining([
      expect.stringContaining('Licencja detektywistyczna'),
      expect.stringContaining('150 do 300'),
    ]));
  });

  /** Boilerplate promoted to a "claim" poisons the whole Target Knowledge Graph. */
  it('drops cookie banners and rights notices', () => {
    const claims = extractCorpusClaims(BODY, 'detektyw krakow');

    expect(claims.join(' ')).not.toMatch(/cookies|prawa zastrzezone/i);
  });

  /**
   * Every one of these came back as a "Cover: …" instruction in a real outline. The last
   * one is why this is a correctness guard and not a taste one: told to cover it, the
   * writer would put a competitor's licence number in our client's article.
   */
  it.each([
    ['first-person service copy', 'Zapewniamy detektywistyczną ochronę i pełną dyskrecję każdemu klientowi.'],
    ['trademark slogan', 'Expertus ® to bezpieczeństwo Twojej prywatności i biznesu!'],
    ['our-company boilerplate', 'Nasze biuro detektywistyczne świadczy w pełni profesjonalne usługi dla klientów.'],
    ['welcome line', 'Witamy w firmie Top Detektyw i zapraszamy do kontaktu z naszym biurem.'],
    ['call to action', 'Skontaktuj się z Agencją Detektywistyczną ALERT i sprawdź, jak możemy Ci pomóc.'],
    ["competitor's own licence", 'Nasza firma detektywistyczna wpisana jest do rejestru pod numerem RD-145/2015.'],
  ])('rejects competitor self-promotion: %s', (_label, sentence) => {
    expect(extractCorpusClaims(sentence, 'prywatny detektyw warszawa')).toEqual([]);
  });

  it('keeps third-person statements about the topic itself', () => {
    const claims = extractCorpusClaims(
      'Licencja detektywistyczna jest wymagana przez ustawę o usługach detektywistycznych z 2001 roku. '
      + 'Stawka godzinowa detektywa wynosi zwykle od 150 do 300 złotych za godzinę obserwacji.',
      'prywatny detektyw warszawa',
    );

    expect(claims).toHaveLength(2);
  });

  it('respects the per-document cap', () => {
    const long = Array.from({ length: 60 }, (_, i) => `Usluga numer ${i} kosztuje ${i * 10} zlotych.`).join(' ');
    expect(extractCorpusClaims(long, 'usluga').length).toBeLessThanOrEqual(24);
  });

  it('returns nothing for an empty body', () => {
    expect(extractCorpusClaims('', 'detektyw')).toEqual([]);
    expect(extractCorpusClaims('   ', 'detektyw')).toEqual([]);
  });

  /**
   * Keyed, never positional: the corpus omits competitors whose fetch returned nothing,
   * so an index-aligned array would file one competitor's claims under another and
   * invent agreement between pages that never agreed.
   */
  it('keys claims by url and skips pages that yielded none', () => {
    const byUrl = extractCorpusClaimsByUrl(
      { 'https://a.pl': BODY, 'https://b.pl': 'Cookie policy.' },
      'detektyw krakow',
    );

    expect(Object.keys(byUrl)).toEqual(['https://a.pl']);
  });
});

/**
 * Every one of these came back inside a real reviewed outline. They are grouped here
 * because they are one failure — the extractor had no way to tell a page's furniture
 * and self-description from a statement about the topic.
 */
describe('page furniture and competitor identity', () => {
  const KW = 'prywatny detektyw warszawa';

  it.each([
    ['consent copy', 'https://www.detektywipl.pl/', 'Zapoznałem się z polityką prywatności serwisu.'],
    ['cookie banner', 'https://www.detektywipl.pl/', 'Oznacza to, że za każdym razem musisz ponownie włączyć lub wyłączyć ciasteczka.'],
    ['flattened nav', 'https://www.detektywipl.pl/', 'Detektywi pl O firmie Opinie Blog Misja Oferta Dowody Cennik Kontakt.'],
    ['nav with brand', 'https://agencjatemida.pl/x', 'Referencje News Kariera Zespół Kontakt Detektyw Warszawa Profesjonalna Pomoc.'],
    ['own brand name', 'https://expertus.pl/', 'Agencja Detektywistyczna Expertus dba o najwyższy standard usług dla klientów.'],
    ['staff trivia', 'https://agencjatemida.pl/x', 'Marcin Miklaszewski posiada również Stopień G5 w Krav Maga.'],
    ['testimonial', 'https://www.detektywipl.pl/', 'Już drugi raz skorzystałem z usług tego biura detektywistycznego.'],
    // Both reached a real outline as claims the planner then demanded a section for.
    ['present-tense testimonial', 'https://www.detektywipl.pl/', 'Teraz z pełną odpowiedzialnością polecam agencję detektywistyczną Detektywi PL.'],
    ['first-person promise', 'https://expertus.pl/', 'Ustalamy co jest możliwe w sprawie, nie obiecujemy żadnych cudów klientom.'],
    ['street address', 'https://agencjatemida.pl/x', 'Siedziba znajduje się przy ulicy Złotej 7/18 w Śródmieściu Warszawy.'],
  ])('drops %s', (_label, url, sentence) => {
    expect(extractCorpusClaims(sentence, KW, 24, url)).toEqual([]);
  });

  /** The rules have to be narrow enough to leave the facts an article is built from. */
  it.each([
    'Licencja detektywistyczna jest wymagana przez ustawę o usługach detektywistycznych z 2001 roku.',
    'Stawka godzinowa detektywa wynosi zwykle od 150 do 300 złotych za godzinę obserwacji.',
    'Wpis do rejestru MSWiA jest wymagany dla każdej agencji detektywistycznej.',
    'Raport końcowy może zostać wykorzystany jako dowód w postępowaniu sądowym.',
  ])('keeps %s', (sentence) => {
    expect(extractCorpusClaims(sentence, KW, 24, 'https://x.pl/')).toHaveLength(1);
  });

  /** Institutions a real claim needs must survive — this is why there is no blanket
   * "reject any proper noun" rule, which would take MSWiA and PZU with the brands. */
  it('keeps institution acronyms while dropping the source brand', () => {
    const url = 'https://expertus.pl/';
    expect(extractCorpusClaims('Polisa OC w PZU jest obowiązkowa dla agencji.', KW, 24, url)).toHaveLength(1);
    expect(extractCorpusClaims('Expertus posiada polisę OC w PZU.', KW, 24, url)).toEqual([]);
  });
});

/**
 * The filters run over Polish, and each of these is a case where the rule matched the
 * wrong thing — either because folding erased the letter the rule depended on, or because
 * `\b` cannot see a Polish one.
 */
describe('Polish morphology and the source domain', () => {
  const KW = 'prywatny detektyw warszawa';

  /**
   * The first-person guard keys on the verb ending `-łem/-łam`. Folded to ASCII it also
   * matched the instrumental case of any noun whose stem ends in `l`, so ordinary facts
   * about how evidence is secured and delivered were thrown away as testimonials.
   */
  it.each([
    'Dowody zabezpieczane są profilem DNA w akredytowanym laboratorium.',
    'Raport przekazywany kanalem szyfrowanym trafia do klienta w ciagu 24 godzin.',
  ])('keeps instrumental-case nouns: %s', (sentence) => {
    expect(extractCorpusClaims(sentence, KW, 24, 'https://x.pl/')).toHaveLength(1);
  });

  /**
   * Requiring the `ł` also means a page scraped without diacritics gets no first-person
   * check at all, and its testimonials came back as things for our article to cover.
   */
  it.each([
    'Juz drugi raz skorzystalem z uslug tego biura detektywistycznego.',
    'Powierzylam agencji detektywistycznej obserwacje meza przez 2 tygodnie.',
    'Zdecydowalem sie na wspolprace z detektywem po rozmowie o kosztach 300 zlotych.',
  ])('drops a first-person testimonial written without diacritics: %s', (sentence) => {
    expect(extractCorpusClaims(sentence, KW, 24, 'https://x.pl/')).toEqual([]);
  });

  /**
   * `-lam` is a verb ending but not only a verb ending: it is also the genitive plural of
   * `reklama` and a noun in its own right, so the ASCII branch was eating ordinary facts.
   */
  it.each([
    'Obserwacja prowadzona jest bez reklam i bez ujawniania danych zleceniodawcy.',
    'Detektyw zabezpiecza szlam i osad z miejsca zdarzenia jako material porownawczy.',
  ])('keeps a fact whose noun merely ends like a verb: %s', (sentence) => {
    expect(extractCorpusClaims(sentence, KW, 24, 'https://x.pl/')).toHaveLength(1);
  });

  it('still drops a first-person sentence that also contains such a noun', () => {
    const sentence = 'Powierzylam agencji detektywistycznej sprawe zakazu reklam konkurencji.';

    expect(extractCorpusClaims(sentence, KW, 24, 'https://x.pl/')).toEqual([]);
  });

  /** A domain concatenates what the page spells out, and the brand slipped through. */
  it('drops a self-reference whose brand is concatenated in the domain', () => {
    expect(extractCorpusClaims(
      'Agencja Temida prowadzi obserwacje w całej Polsce od 2005 roku.',
      KW,
      24,
      'https://agencjatemida.pl/x',
    )).toEqual([]);
  });

  /** A competitor named after the subject must not delete the subject from the corpus. */
  it('does not treat the article keyword as the competitor brand', () => {
    expect(extractCorpusClaims(
      'Licencja detektywistyczna jest wymagana przez ustawę z 2001 roku.',
      KW,
      24,
      'https://detektyw.pl/',
    )).toHaveLength(1);
  });

  /** `\bsą\b` can never fire — the boundary after `ą` does not exist for JavaScript. */
  it('recognises an assertion whose verb ends in a Polish letter', () => {
    expect(extractCorpusClaims(
      'Dowody zebrane w toku obserwacji są dopuszczalne w postępowaniu rozwodowym.',
      KW,
      24,
      'https://x.pl/',
    )).toHaveLength(1);
  });

  /** Seed tokens arrive folded, so a keyword written properly missed its own mention. */
  it('matches a keyword mention written with diacritics', () => {
    expect(extractCorpusClaims(
      'Prywatne śledztwo bywa prowadzone dyskretnie przez kilka tygodni w terenie.',
      'śledztwo gospodarcze',
      24,
      'https://x.pl/',
    )).toHaveLength(1);
  });
  /**
   * Scraped sentences mix the two spellings freely. Choosing a single branch on "does
   * this contain any Polish letter" meant an ASCII verb carrying one accented noun was
   * routed to the rule that cannot see it, and the testimonial survived.
   */
  it('rejects a testimonial whose verb is ASCII but whose nouns are not', () => {
    expect(extractCorpusClaims(
      'Powierzylam agencji detektywistycznej sledzenie męża i otrzymalam pelen raport.',
      'prywatny detektyw warszawa',
      24,
      'https://x.pl/',
    )).toEqual([]);
  });

  /** Both spellings of the same testimonial, and the noun guard still holds. */
  it.each([
    ['fully accented', 'Powierzyłam agencji śledzenie męża i otrzymałam pełen raport z obserwacji.'],
    ['fully ASCII', 'Powierzylam agencji sledzenie meza i otrzymalam pelen raport z obserwacji.'],
  ])('rejects the %s testimonial', (_label, sentence) => {
    expect(extractCorpusClaims(sentence, 'prywatny detektyw warszawa', 24, 'https://x.pl/')).toEqual([]);
  });

  it('still keeps instrumental nouns that merely look like the verb ending', () => {
    expect(extractCorpusClaims(
      'Dowody zabezpieczane są profilem DNA oraz kanalem szyfrowanym w kazdej sprawie.',
      'prywatny detektyw warszawa',
      24,
      'https://x.pl/',
    )).toHaveLength(1);
  });
});
