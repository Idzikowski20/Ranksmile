import { isNonClaimSentence, isNoiseEntity, normalizeCandidates } from '@/src/core/domain/knowledgeEngine/extract';

// Every string here was scraped by a real run (article 15, "prywatny detektyw warszawa")
// and reached the writer as something to cover.
describe('isNonClaimSentence', () => {
  it.each([
    ['a competitor FAQ heading', 'Ile kosztuje godzina pracy prywatnego detektywa w Warszawie?'],
    ['first-person marketing', 'Nasi detektywi zagwarantują Państwu dyskrecję i wysoką skuteczność działań.'],
    ['reader-addressed sales copy', 'Chcecie sprawdzić swoich kontrahentów oraz lojalność pracowników w firmie?'],
    ['a heading cut at an abbreviation', 'Agencja Detektywistyczna Ochrony Biznesu ds.'],
    ['a contentless generality', 'Ich zakres usług jest bardzo szeroki.'],
  ])('rejects %s', (_label, sentence) => {
    expect(isNonClaimSentence(sentence)).toBe(true);
  });

  it.each([
    'Usługi detektywistyczne w Polsce mogą być świadczone tylko przez osoby posiadające licencję MSWiA.',
    'Detektywi w Polsce nie mają prawa zdobywać bilingów telefonicznych ani podsłuchiwać bez zgody sądu.',
    'Wykrywanie podsłuchów wymaga nowoczesnego sprzętu oraz specjalistycznej wiedzy technicznej.',
  ])('keeps the neutral statement %#', (sentence) => {
    expect(isNonClaimSentence(sentence)).toBe(false);
  });
});

describe('isNoiseEntity', () => {
  it.each(['adres:', 'Telefon:', 'a l e r t', 'opinie naszych klientów', 'Jak umówić się na konsultacje?'])(
    'rejects scraped heading furniture: %s',
    (term) => {
      expect(isNoiseEntity(term)).toBe(true);
    },
  );

  it.each(['wywiad gospodarczy', 'ustawa o usługach detektywistycznych', 'RODO'])(
    'keeps the real entity: %s',
    (term) => {
      expect(isNoiseEntity(term)).toBe(false);
    },
  );
});

describe('normalizeCandidates', () => {
  it('drops non-claim sentences and noise entities together', () => {
    const result = normalizeCandidates({
      sentences: [
        {
          text: 'Obserwacja osób dostarcza materiał dowodowy wykorzystywany w sprawach rozwodowych.',
          url: 'https://a.pl',
          serpPosition: 1,
          score: 50,
          authority: 0.5,
        },
        {
          text: 'Nasi detektywi zagwarantują Państwu dyskrecję i wysoką skuteczność działań.',
          url: 'https://b.pl',
          serpPosition: 2,
          score: 50,
          authority: 0.5,
        },
      ],
      entityCandidates: ['wywiad gospodarczy', 'adres:'],
      headings: [{ text: 'Zakres usług', url: 'https://a.pl', serpPosition: 1 }],
    });

    expect(result.sentences.map((s) => s.url)).toEqual(['https://a.pl']);
    expect(result.entityCandidates).toEqual(['wywiad gospodarczy']);
  });
});
