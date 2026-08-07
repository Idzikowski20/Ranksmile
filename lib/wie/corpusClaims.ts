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

/** Claims kept per competitor document — enough for gain frequency, short of a dump. */
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
 */
const FIRST_PERSON_PAST = /\b\w{3,}(lem|lam|lismy|lysmy)\b/i;

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
 */
function ownBrandTokens(url: string): string[] {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host
      .split('.')[0]
      .split('-')
      .map(foldPolishLetters)
      .filter((t) => t.length >= 5 && !['grupa', 'agencja', 'biuro', 'firma'].includes(t));
  } catch {
    return [];
  }
}

function mentionsOwnBrand(folded: string, brandTokens: string[]): boolean {
  return brandTokens.some((token) => folded.includes(token));
}

/**
 * Verbs that make a sentence a statement about the subject rather than narration.
 * Polish first (the writer's primary language), English for mixed SERPs.
 */
const ASSERTIVE = new RegExp(
  '\\b('
  + 'jest|są|wynosi|kosztuje|trwa|wymaga|wymagane|musi|powinien|powinna|powinno|'
  + 'oznacza|polega|obejmuje|zawiera|umożliwia|pozwala|zależy|dotyczy|reguluje|'
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

function mentionsSeed(sentence: string, seeds: string[]): boolean {
  if (!seeds.length) return false;
  const words = sentence.toLowerCase().split(/[^a-z0-9ąćęłńóśźż]+/i).filter((w) => w.length >= 3);
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
  const brandTokens = ownBrandTokens(sourceUrl);
  const saysSomething = (s: string) => (
    mentionsSeed(s, seeds) || HAS_FIGURE.test(s) || ASSERTIVE.test(s)
  );
  const isAboutTheTopic = (s: string) => {
    const folded = foldPolishLetters(s);
    return !SELF_PROMOTION.test(folded)
      && !MARKETING_MARKS.test(folded)
      && !FIRST_PERSON_PAST.test(folded)
      && !mentionsOwnBrand(folded, brandTokens)
      && !looksLikeNavigation(s);
  };

  const seen = new Set<string>();
  return splitSentences(bodyText || '')
    .filter((s) => !isCorpusNoiseSentence(s) && isAboutTheTopic(s) && saysSomething(s))
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
