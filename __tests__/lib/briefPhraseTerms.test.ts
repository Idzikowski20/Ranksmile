/**
 * The exact term list a real run handed the brief writer for "szantaż emocjonalny".
 * It produced the instruction:
 *   "Wpleć frazy: emocjonalne, emocjonalnego, szantaż, szantaż emocjonalny,
 *    szantazu emocjonalnego, osobe, relacji, poczucie, emocje, pomocy, problem"
 * — the same stem twice, two spellings of one phrase, and bare function words.
 */
import { briefPhraseTerms } from '../../lib/contentPlanner/briefWriter';

const REAL_TERMS = [
  'emocjonalne',
  'emocjonalnego',
  'szantaż',
  'szantaż emocjonalny',
  'szantażu emocjonalnego',
  'szantazu emocjonalnego',
  'osobe',
  'relacji',
  'manipulacja emocjonalna',
  'poczucie',
  'poczucie winy',
  'emocje',
  'pomocy',
  'problem',
];

describe('briefPhraseTerms', () => {
  it('keeps one spelling of a phrase, the one with diacritics', () => {
    const out = briefPhraseTerms(REAL_TERMS, 24);

    expect(out).toContain('szantażu emocjonalnego');
    expect(out).not.toContain('szantazu emocjonalnego');
  });

  /**
   * The reference brief names a handful of phrases and not one bare stem. Ours listed
   * twenty-two, which is how "często" and "osobe" became things to weave in.
   */
  it('drops bare stems entirely once there are enough phrases', () => {
    const out = briefPhraseTerms(REAL_TERMS, 24);

    expect(out.every((t) => t.includes(' '))).toBe(true);
    expect(out.length).toBeLessThanOrEqual(6);
  });

  /** With too little vocabulary the stems are all there is — better than an empty list. */
  it('keeps bare stems when there are not enough phrases', () => {
    const out = briefPhraseTerms(['poczucie winy', 'partner', 'presja'], 24);

    expect(out).toContain('partner');
  });

  it('drops the bare stems first when the cap bites', () => {
    const out = briefPhraseTerms(REAL_TERMS, 4);

    expect(out).toEqual([
      'szantaż emocjonalny',
      'szantażu emocjonalnego',
      'manipulacja emocjonalna',
      'poczucie winy',
    ]);
  });

  it('survives an empty list', () => {
    expect(briefPhraseTerms([], 24)).toEqual([]);
  });

  /**
   * 63 of 119 terms in a real run carried no diacritics, because the extractor stores
   * folded variants as their own terms. They are not different words — the brief was
   * asking the writer to weave in both spellings of the same one.
   */
  it('drops a diacritic-free variant when the properly spelled word is present', () => {
    const out = briefPhraseTerms([
      'szantaż emocjonalny',
      'szantazem emocjonalnym',
      'emocjonalny szantaz',
      'związku',
      'zwiazku',
      'własne',
      'wlasne',
      'której',
      'ktorej',
      'osobę',
      'osobe',
    ], 24);

    for (const mangled of ['szantazem emocjonalnym', 'emocjonalny szantaz', 'zwiazku', 'wlasne', 'ktorej', 'osobe']) {
      expect(out).not.toContain(mangled);
    }
    expect(out).toContain('szantaż emocjonalny');
    expect(out).toContain('związku');
  });

  /** Plenty of correct Polish carries no diacritics — those must survive untouched. */
  it('keeps diacritic-free words that have no properly spelled twin', () => {
    const out = briefPhraseTerms(['poczucie winy', 'partner', 'presja', 'pomoc', 'relacji'], 24);

    for (const real of ['partner', 'presja', 'pomoc', 'relacji']) {
      expect(out).toContain(real);
    }
  });
});
