/**
 * Polish diacritic → ASCII fold table. Single source shared by termMatch's
 * length-preserving `normalizePl` and termUtils' NFD-adding `foldPolishLetters`,
 * so term counting and term dedupe can never disagree on which letters fold.
 */
export const PL_DIACRITICS: Record<string, string> = {
  ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z',
};
