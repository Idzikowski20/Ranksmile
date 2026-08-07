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
