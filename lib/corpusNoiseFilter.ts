import { foldPolishLetters } from '@/src/core/domain/terms/termUtils';

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
  // The Polish word for them, which `cookie` never matched — this is how a consent
  // paragraph reached a reviewed outline as something to cover.
  /\bciasteczk/i,
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
  // ── Page chrome, all of it seen in one reviewed outline as "Cover: …" ──
  // A related-links teaser, not a statement: "Więcej o objawach nerwicy 3."
  /^więcej o\s/i,
  // Breadcrumb: "Blog Związek i relacje Szantaż emocjonalny – co to jest?"
  /^blog\s/i,
  // The byline strip every Polish CMS prints above an article.
  /\bczas czytania\b/i,
  // Booking CTA glued to the heading that followed it.
  /\bbezpłatn\w*\s+konsultacj/i,
  // Stock-photo credits sit directly under the lead image and get scraped with it.
  /\bshutterstock\b|\bgetty images\b|\bunsplash\b|\bistock\b|\badobe stock\b/i,
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
  // Abbreviated and spelled out: "ul. Złota" and "przy ulicy Złotej" are both a
  // competitor's street address, and both were being handed to our writer.
  // The abbreviation is address enough on its own, whatever its case ("UL. Warszawska",
  // "ul. warszawska 12"). The spelled-out form is not: it has to be singular and followed
  // by a proper noun, or "na ulicach Warszawy" — ordinary prose — gets thrown away too.
  /\bul\.\s*[a-ząćęłńóśźż]/i,
  /\bulic[ayąę]\s*[A-ZĄĆĘŁŃÓŚŹŻ]/,
  // Any leaked HTML comment marker, not just the "o nas" one. `-->` cannot occur in
  // prose, and it arrived in a brief as "--> Data: 30.03.2025 Czas czytania: 8 min.".
  /-->/,
  // Opening hours: a clock range that also names a day or an address. The pattern used
  // to be "any two clock times in one sentence", which also threw away real claims —
  // "Interwencja trwa od 8:00 do 20:00, a raport powstaje tego samego dnia" is a fact
  // about the work, not a footer.
  /\d{1,2}:\d{2}\D{0,40}\d{1,2}:\d{2}[\s\S]{0,40}?(?<![\p{L}\p{N}_])(ul\.|pon|wt|śr|czw|pt|sob|niedz)/iu,
  // Unicode lookbehind, not `\b`: JavaScript's `\w` is ASCII, so a boundary before `ś`
  // never matches and the Wednesday branch was dead — exactly the limitation this file's
  // header documents, reintroduced. "Środa od 9:00 do 21:00" was passing straight through.
  /(?<![\p{L}\p{N}_])(pon|wt|śr|czw|pt|sob|niedz)\p{L}*[\s\S]{0,40}?\d{1,2}:\d{2}\D{0,40}\d{1,2}:\d{2}/iu,
  /**
   * A word that starts lowercase and then shouts — "MAM eMOCje", a book cover rendered as
   * text in a sidebar list. Case-sensitive, so it stays out of the folded list above.
   *
   * The shout has to END in lowercase again — `eMOCje`, a cover rendered as text. That
   * trailing letter is what separates it from a technical term, which keeps its capitals
   * to the end: `mRNA`, `iOS`, `eGFR` and `mBank` all survive, and each is something a
   * real claim may legitimately name.
   */
  /\p{Ll}+\p{Lu}{2,}\p{Ll}/u,
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

/** The pattern half: does this text look like page chrome, whatever its length? */
function matchesChromePattern(t: string): boolean {
  if (CORPUS_NOISE_RAW.some((re) => re.test(t))) return true;
  const low = foldPolishLetters(t);
  if (CORPUS_NOISE.some((re) => re.test(low))) return true;
  return BOILERPLATE_STARTS.some((p) => low.startsWith(p));
}

export function isCorpusNoiseSentence(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < 20 || t.length > 200) return true;
  if (matchesChromePattern(t)) return true;
  const words = foldPolishLetters(t).split(/\s+/);
  if (words.length < 4) return true;
  const upperRatio = (t.match(/[A-ZĄĆĘŁŃÓŚŹŻ]/g) || []).length / t.length;
  if (upperRatio > 0.35) return true;
  return false;
}

/**
 * The same chrome patterns, without the sentence-shape guards.
 *
 * A knowledge-graph claim is a fragment by nature — "Kara do 2 lat.", "Termin 14 dni." —
 * so the under-20-characters and under-4-words rules that make sense for a scraped
 * sentence would drop exactly the short, factual claims the outline is built from, and
 * shrink the coverage the planner gates on. Only the "this is page furniture" half
 * applies here.
 */
export function isCorpusNoiseClaim(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return true;
  if (t.length > 300) return true;
  return matchesChromePattern(t);
}
