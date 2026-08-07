import { foldPolishLetters } from './termUtils';

/**
 * Boilerplate patterns, written with Polish diacritics and matched against text that has
 * been folded to ASCII by `foldPolishLetters` — the patterns are folded the same way at
 * module load, so both sides always agree.
 *
 * Two bugs made this necessary. JavaScript's `\b` is ASCII-only, so a boundary after
 * `ę`/`ć`/`ś` can never match: `wyrażam zgodę\b`, `twoja wiadomość\b` and `czy
 * chciałbyś\b` never once fired, on any input. And scraped HTML arrives in NFC or NFD
 * depending on the source CMS, so even the patterns that did work missed decomposed
 * text. Folding both sides fixes both: every letter becomes ASCII, so `\b` behaves and
 * normalization stops mattering.
 */
const CORPUS_NOISE: RegExp[] = [
  /\blubimyczytac\b/i,
  /\bporównywark/i,
  /\bksiążk/i,
  /\bcreative commons\b/i,
  /\bparsoid\b/i,
  /\bcookie/i,
  /\bprivacy policy\b/i,
  /\bwyrażam zgodę\b/i,
  /\bwszelkie prawa zastrzeżone\b/i,
  /\bdowiedz się więcej\b/i,
  /\binfolinia\b/i,
  /\bjooble\b/i,
  /\bofert pracy\b/i,
  /\bpraca\b.*\bpilne\b/i,
  /\bfacebook\b/i,
  /\blinkedin\b/i,
  /\bwikipedia\b/i,
  /\bzgłoszenie jej na adres\b/i,
  /\bstrona została wyrenderowana\b/i,
  /\btekst udostępniany na licencji\b/i,
  /\bthis website uses cookies\b/i,
  /\bnecessary always enabled\b/i,
  /\bformularz\b/i,
  /\btwoja wiadomość\b/i,
  /\bimie\b.*\bnazwa firmy\b/i,
  /\bpolecane księgarnie\b/i,
  /\boferta dnia\b/i,
  /\bczy chcesz,?\s*żebym\b/i,
  /\bczy chciałbyś\b/i,
  /\bczy chcesz\b.*\b(pomóc|wyjaśni)/i,
  /\bpomógł (?:ci )?(znaleźć|wyjaśni)/i,
  /\bwyjaśnił coś bardziej szczegółowo\b/i,
  /\bwięcej informacji na (?:ten )?temat\b/i,
].map((re) => new RegExp(foldPolishLetters(re.source), re.flags));

/**
 * Patterns that hinge on characters folding would change — case, punctuation, symbols —
 * so they run against the raw sentence instead.
 */
const CORPUS_NOISE_RAW: RegExp[] = [
  /\badmin@/i,
  // Full 9-digit number, and no leading `\b`. That boundary could never match — `+` is a
  // non-word character, so `\b\+` only fires mid-word ("tel+48") and never after a space,
  // which left this pattern as dead as the Polish ones above. Matching the whole number
  // rather than `+NN NNN` also keeps it off statistics like "+20 000 zł".
  /\+\d{2}[\s-]?(?:\d[\s-]?){9}/,
  /\bul\.\s*[A-ZĄĆĘŁŃÓŚŹŻ]/,
  /\bo nas\s*-->/i,
];

/** Folded once here rather than per sentence — this runs over whole competitor bodies. */
const BOILERPLATE_STARTS = [
  'answer the main question',
  'set expectations',
  'identify who',
  'explain why',
  'poniżej znajdują się różne znaczenia',
  'mimo że dokładamy starań',
].map(foldPolishLetters);

export function isCorpusNoiseSentence(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < 20 || t.length > 200) return true;
  if (CORPUS_NOISE_RAW.some((re) => re.test(t))) return true;
  const low = foldPolishLetters(t);
  if (CORPUS_NOISE.some((re) => re.test(low))) return true;
  if (BOILERPLATE_STARTS.some((p) => low.startsWith(p))) return true;
  const words = low.split(/\s+/);
  if (words.length < 4) return true;
  const upperRatio = (t.match(/[A-ZĄĆĘŁŃÓŚŹŻ]/g) || []).length / t.length;
  if (upperRatio > 0.35) return true;
  return false;
}
