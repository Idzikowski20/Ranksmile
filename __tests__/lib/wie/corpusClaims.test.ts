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
