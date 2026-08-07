/**
 * Per-competitor claim extraction from the SERP corpus.
 *
 * Until this existed nothing ever populated a competitor's `claims`, so the Target
 * Knowledge Graph was built from one LLM synthesis alone — and because that synthesis
 * is attached to competitor[0], every claim carried frequency 1 and `classifyGain`
 * could not tell "all five competitors say this" (core) from "only one does"
 * (opportunity). Extracting per document restores both the volume and the frequency
 * signal the planner's gain machinery was written for.
 *
 * Deliberately heuristic, no LLM: this runs over up to five full competitor bodies on
 * every deep analysis, and the synthesis call already covers the interpretive work.
 */
import { isCorpusNoiseSentence } from '../corpusNoiseFilter';
import { seedTokens, tokensShareStem } from '../topicRelevance';
import { foldPolishLetters } from '../termUtils';

/**
 * Claims kept per competitor document — enough for gain frequency, short of a dump.
 *
 * ponytail: a flat ceiling taken off the front of the document, not a ranking. A page
 * that states its best figures late loses them. Upgrade path when that shows up in an
 * outline: score sentences (figure + seed mention) and keep the top `MAX_CLAIMS_PER_DOC`
 * instead of the first ones.
 */
const MAX_CLAIMS_PER_DOC = 24;

/** Numbers, money, dates, durations — the sentences that carry checkable substance. */
const HAS_FIGURE = /\d/;

/**
 * A competitor advertising itself, not stating something about the topic.
 *
 * This is a correctness guard, not a taste one. These sentences reach the writer as
 * "Cover: …" instructions, so a competitor's own credentials become claims our article
 * makes about itself — a real outline came back telling the writer to cover "Nasza firma
 * detektywistyczna wpisana jest do rejestru … pod numerem RD-145/2015", which is another
 * company's licence number. First-person copy can never be safely reused.
 */
const SELF_PROMOTION = new RegExp(
  '(^|\\W)('
  // First-person plural — the page talking about itself.
  + 'nasz\\w*|nam|nas|my|zapewniamy|oferujemy|dzialamy|swiadczymy|posiadamy|zatrudniamy|'
  + 'dbamy|stawiamy|realizujemy|prowadzimy|witamy|gwarantujemy|pomagamy|wspieramy|'
  + 'we |our|us|welcome to'
  + ')(\\W|$)',
  'i',
);

/** Marketing punctuation and trademark marks — never present in a factual statement. */
const MARKETING_MARKS = /[!®™]|\bzobacz wiecej\b|\bskontaktuj sie\b|\bzadzwon\b/i;

/**
 * Polish first-person past tense. A factual statement about the topic is never written
 * this way — a customer testimonial always is ("Już drugi raz skorzystałem z usług tego
 * biura", "Powierzyłam agencji śledzenie męża"), and so is consent copy ("Zapoznałem się
 * z polityką prywatności"). Both reached the outline as things to cover.
 *
 * Matched against the raw sentence, never the folded one. Folding `ł` to `l` makes the
 * verb ending `-łem` and the noun ending `-em` the same string, and the old folded
 * pattern ate ordinary instrumental nouns with it: "zabezpieczane są profilem DNA" and
 * "przekazywany kanalem szyfrowanym" were both thrown away. Requiring the `ł` itself puts
 * the check back on the verb ending instead of the noun's stem.
 *
 * ponytail: surface morphology, no lemmatiser. Two corners stay open — a noun whose stem
 * really ends in `ł` ("materiałem") still looks like an `-ałem` verb, and a page scraped
 * without diacritics is not checked at all. Upgrade path if either reaches an outline: a
 * Polish stemmer, or the sidecar's NLP pass, which already tags parts of speech.
 */
const FIRST_PERSON_PAST = /\p{L}{2,}(?:łem|łam|liśmy|łyśmy)\b/iu;

/**
 * A navigation strip that the scraper flattened into one "sentence" —
 * "Referencje News Kariera Zespol Kontakt Detektyw Warszawa…". Prose capitalises the
 * first word; four or more capitals after it means a menu, not a claim.
 */
const NAV_CAPITALS = 4;

function looksLikeNavigation(sentence: string): boolean {
  const tokens = sentence.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const capitalised = tokens
    .slice(1)
    .filter((t) => t[0] === t[0].toUpperCase() && t[0] !== t[0].toLowerCase());
  return capitalised.length >= NAV_CAPITALS;
}

/**
 * Brand tokens taken from the page's own URL, so a competitor's self-references drop out
 * precisely — without a blanket "no proper nouns" rule that would also lose the
 * institutions a real claim needs (MSWiA, PZU, RODO).
 *
 * The article's own seed tokens are excluded: a competitor at `detektyw.pl` would
 * otherwise donate the token `detektyw` and delete every sentence about the subject the
 * article is being written on.
 */
function ownBrandTokens(url: string, seeds: string[]): string[] {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host
      .split('.')[0]
      .split('-')
      .map(foldPolishLetters)
      .filter((t) => t.length >= 5
        && !['grupa', 'agencja', 'biuro', 'firma'].includes(t)
        && !seeds.some((seed) => tokensShareStem(t, seed)));
  } catch {
    return [];
  }
}

/**
 * Also matched against the sentence with its spaces removed. A domain concatenates the
 * brand — `agencjatemida.pl` is one label — while the page spells it out, so "Agencja
 * Temida" never contained the token and every self-reference survived.
 */
function mentionsOwnBrand(folded: string, brandTokens: string[]): boolean {
  if (!brandTokens.length) return false;
  const joined = folded.replace(/\s+/g, '');
  return brandTokens.some((token) => folded.includes(token) || joined.includes(token));
}

/**
 * Verbs that make a sentence a statement about the subject rather than narration.
 * Polish first (the writer's primary language), English for mixed SERPs.
 *
 * Written folded, like `SELF_PROMOTION`, and matched against folded text — `\b` is
 * ASCII-only, so `\bsą\b` could never fire on the verb (the boundary after `ą` does not
 * exist) but fired happily inside "sądem" and "sądowym", where a boundary does. It both
 * missed the assertion it was written for and passed sentences that assert nothing.
 */
const ASSERTIVE = new RegExp(
  '\\b('
  // `moze` joins the modals here because the broken boundary was hiding its absence:
  // "Raport może zostać wykorzystany jako dowód" only ever qualified by matching the
  // stray "są" inside "sądowym".
  + 'jest|sa|wynosi|kosztuje|trwa|wymaga|wymagane|musi|moze|powinien|powinna|powinno|'
  + 'oznacza|polega|obejmuje|zawiera|umozliwia|pozwala|zalezy|dotyczy|reguluje|'
  + 'is|are|means|requires|must|should|includes|involves|costs|takes|depends'
  + ')\\b',
  'i',
);

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Takes the folded sentence: `seedTokens` returns ASCII-folded tokens, so comparing them
 * against a merely lowercased sentence lost every mention written with diacritics —
 * "śledztwo" never matched the seed "sledztwo".
 */
function mentionsSeed(folded: string, seeds: string[]): boolean {
  if (!seeds.length) return false;
  const words = folded.split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
  return seeds.some((seed) => words.some((word) => tokensShareStem(word, seed)));
}

/**
 * Claim-like sentences from one competitor body.
 *
 * A sentence qualifies when it survives the shared corpus-noise filter, is not the
 * competitor advertising itself, AND says something: it either names the topic, carries
 * a figure, or asserts a property. Requiring the keyword alone would drop most of an
 * article — competitors state the subject once and then write about it.
 */
export function extractCorpusClaims(
  bodyText: string,
  keyword: string,
  max: number = MAX_CLAIMS_PER_DOC,
  /** The page these sentences came from — used to drop its own brand mentions. */
  sourceUrl = '',
): string[] {
  const seeds = seedTokens(keyword || '');
  const brandTokens = ownBrandTokens(sourceUrl, seeds);
  const isClaim = (s: string) => {
    const folded = foldPolishLetters(s);
    const isAboutTheTopic = !SELF_PROMOTION.test(folded)
      && !MARKETING_MARKS.test(folded)
      // NFC first: scraped HTML arrives decomposed often enough that the `ś` of `liśmy`
      // would otherwise be two codepoints and never match.
      && !FIRST_PERSON_PAST.test(s.normalize('NFC'))
      && !mentionsOwnBrand(folded, brandTokens)
      && !looksLikeNavigation(s);
    const saysSomething = mentionsSeed(folded, seeds)
      || HAS_FIGURE.test(folded)
      || ASSERTIVE.test(folded);
    return isAboutTheTopic && saysSomething;
  };

  const seen = new Set<string>();
  return splitSentences(bodyText || '')
    .filter((s) => !isCorpusNoiseSentence(s) && isClaim(s))
    .filter((s) => {
      const key = s.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, max);
}

/**
 * `{ url: claims }` for the whole corpus. Keyed by URL rather than positional: the
 * corpus drops competitors whose body came back empty, so an index-aligned array would
 * silently attribute one competitor's claims to another.
 */
export function extractCorpusClaimsByUrl(
  corpus: Record<string, string>,
  keyword: string,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [url, text] of Object.entries(corpus)) {
    const claims = extractCorpusClaims(text, keyword, MAX_CLAIMS_PER_DOC, url);
    if (claims.length) out[url] = claims;
  }
  return out;
}
