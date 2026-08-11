/**
 * Page chrome that reached a reviewed outline as "Cover: …" instructions for the writer.
 *
 * Every string here is copied from the outline generated for "szantaż emocjonalny": they
 * are opening hours, a byline, a reading-time strip, a breadcrumb and a sidebar book
 * list. None of them is a claim about the subject, and each one spent a slot in the brief
 * that a real fact should have had.
 */
import { isCorpusNoiseSentence } from '../../lib/corpusNoiseFilter';

const PAGE_CHROME = [
  'od 9:00 do 21:00 ul.',
  'od 9:00 do 21:00 Sobota od 9:00 do 13:00 ul.',
  '--> Data: 30.03.2025 Czas czytania: 8 min.',
  'Historia świętych miejsc Kathryn Hurlock MAM eMOCje.',
  'Więcej o objawach nerwicy 3.',
  'Blog Związek i relacje Szantaż emocjonalny – co to jest?',
  'Zapis na bezpłatną konsultacje Co to jest szantaż emocjonalny?',
  'Visual Generation / Shutterstock Jak rozpoznać szantaż emocjonalny?',
];

/**
 * Real claims from the same run. The filter has to keep these — a boilerplate rule that
 * also eats the subject matter is worse than the noise it removes.
 */
const REAL_CLAIMS = [
  'Szantaż emocjonalny to forma manipulacji, w której jedna osoba wywołuje w drugiej lęk, poczucie winy lub obowiązku, aby osiągnąć własne cele.',
  'Karanie ciszą jest jedną z popularniejszych form szantażu emocjonalnego.',
  'Szantaż emocjonalny przebiega przez sześć etapów: żądanie, opór, presja, groźby, uległość, powtórzenie.',
  'Człowiek ulegający szantażowi zapomina o swoich potrzebach, uczuciach i pragnieniach.',
  'Warto wiedzieć, że jest to forma przemocy psychicznej, używana w celu zapewnienia sobie kontroli i władzy w relacji.',
];

describe('corpus noise filter — page chrome', () => {
  it.each(PAGE_CHROME)('rejects %s', (text) => {
    expect(isCorpusNoiseSentence(text)).toBe(true);
  });

  it.each(REAL_CLAIMS)('keeps %s', (text) => {
    expect(isCorpusNoiseSentence(text)).toBe(false);
  });
});
