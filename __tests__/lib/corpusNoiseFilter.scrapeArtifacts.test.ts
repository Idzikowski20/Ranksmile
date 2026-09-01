import { isCorpusNoiseClaim } from '@/src/core/domain/corpus/corpusNoiseFilter';

/**
 * Article 147 planned 75 claims and more than a third were scrape artefacts. The writer
 * is told to cover every claim, so a Wikipedia reference list surfaced in the body as
 * "obowiazku, forward, forward s." and a competitor's worked example became a paragraph
 * about a 17-year-old named Ola. Every string here is verbatim from that plan.
 */
describe('isCorpusNoiseClaim — scrape artefacts', () => {
  const noise: Array<[string, string]> = [
    ['bibliography row', ', Kontrola emocji u ofiar i sprawców szantażu emocjonalnego w bliskich związkach , „Innowacje Psychologiczne” (I), 2005 .'],
    ['wiki backlink', '↑ Przemoc wobec dzieci [online] [dostęp 2018-10-26] ( ang.'],
    ['footnote markers', 'Szantaż emocjonalny kwalifikuje się jako przejaw przemocy emocjonalnej [ 4 ] [ 5 ] .'],
    ['wiki section furniture', 'Wpływ szantażu emocjonalnego na ofiary [ edytuj | edytuj kod ] Ofiary są narażone na stres.'],
    ['table of contents', 'Spis treści Co to jest szantaż emocjonalny i na czym polega?'],
    ['worked example marker', 'Przykład nr 2: Ola ma 17 lat.'],
    ['court boilerplate', 'Sygn. akt IV KK 100/20. WYROK. W IMIENIU RZECZYPOSPOLITEJ POLSKIEJ.'],
    ['result-page lead-in', 'Treść do orzeczenia w sprawie I ACa 686/15 z dnia 13 czerwca 2016.'],
    ['truncated at abbreviation', 'Oznacza to, że nie każdy, kto go stosuje, robi to z premedytacją i z wyrachowania, jak np.'],
    ['dangling initial', ', Szantaż emocjonalny w relacjach rówieśniczych , Jacek J.'],
    ['narration', 'Zastanówmy się jak wygląda mechanizm szantażu emocjonalnego.'],
    ['narration, first person', 'Kiedy kręgosłup się łamie, wiemy, że nie jest dobrze.'],
    ['biography', 'Beata od 6 miesięcy jest w związku z mężczyzną, który samotnie wychowuje syna.'],
  ];

  it.each(noise)('drops %s', (_label, text) => {
    expect(isCorpusNoiseClaim(text)).toBe(true);
  });

  /** The filter deliberately keeps short factual fragments — those are real claims. */
  const real = [
    'Kara do 2 lat pozbawienia wolności.',
    'Szantaż emocjonalny może stanowić jeden z elementów uporczywego nękania.',
    'Technika „cierpiętnik” wywołuje wyrzuty sumienia u osoby manipulowanej.',
    'Ustawa ma 3 lata i nadal obowiązuje.',
    'Interwencja trwa od 8:00 do 20:00, a raport powstaje tego samego dnia.',
  ];

  it.each(real)('keeps a real claim: %s', (text) => {
    expect(isCorpusNoiseClaim(text)).toBe(false);
  });
});
