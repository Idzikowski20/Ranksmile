/**
 * Strict topic matching for keyword/term enrichment — prevents DFS/GSC noise
 * (e.g. "test z lektury…" matching seed "warszawa" via substring "a").
 */
import { isDictionaryQueryNoise, isUsefulTerm, normalizeTerm } from './termUtils';

const SEED_NOISE_TOKENS = new Set([
  'znaczy', 'znaczenie', 'definicja', 'slownik', 'tlumacz', 'tlumaczenie', 'oznacza',
]);

  const OFF_TOPIC_PATTERNS = [
  /\btest z lektury\b/,
  /\bsubkonto zus\b/,
  /\bustaw(?:a|y)\b.*\bnawrocki\b/,
  /\bzdolnosc prawna\b/,
  /\bhierarchia aktow prawnych\b/,
  /\bprzeglad kominiarski\b/,
  /\bprawa boskie\b/,
  /\bdzialalnosc nierejestrowana\b/,
  /\bwotum (?:zaufania|nieufnosci)\b/,
  /\bwaznosc e recepty\b/,
  /\bproces legislacyjny\b/,
  /\buchwala a ustawa\b/,
  /\bpostepowanie (?:nakazowe|upominawcze)\b/,
  /\bimmunitet (?:materialny|formalny)\b/,
  /\btotalitaryzm\b/,
  /\bautorytaryzm\b/,
  /\bwalidacja a weryfikacja\b/,
  /\bustawa a rozporzadzenie\b/,
  /\badministracji publicznej\b/,
  /\bwarunkowanie sprawcze\b/,
  // Related-search / game / book pollution (e.g. "szantaz metin2", "… ksiazka")
  /\bmetin2?\b/,
  /\bminecraft\b/,
  /\bfortnite\b/,
  /\broblox\b/,
  /\bksiazka\b/,
  /\blektur\b/,
  /\blubimyczytac\b/,
];

/** Seed words used for whole-token matching (min 3 chars). */
export function seedTokens(seedKeyword: string): string[] {
  return normalizeTerm(seedKeyword)
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !SEED_NOISE_TOKENS.has(w));
}

/** Polish inflection-aware token match (hybrydowa ≈ hybrydowy / hybrydowej). */
export function tokensShareStem(a: string, b: string): boolean {
  if (a === b) return true;
  const minLen = Math.min(a.length, b.length);
  if (minLen < 4) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  // Require a meaningful shared stem (covers -a/-y/-ej/-e Polish endings).
  const need = minLen <= 5 ? 4 : 5;
  return i >= need;
}

function candMatchesSeed(candWord: string, seedWord: string): boolean {
  return tokensShareStem(candWord, seedWord);
}

function sharesAnySeedToken(candWords: string[], seeds: string[]): boolean {
  return seeds.some((sw) => candWords.some((cw) => candMatchesSeed(cw, sw)));
}

/** True when `candidate` is on the same topic as `seedKeyword` (whole-word / stem overlap). */
export function isKeywordOnTopic(candidate: string, seedKeyword: string): boolean {
  const cand = normalizeTerm(candidate);
  const normSeed = normalizeTerm(seedKeyword);
  if (!cand || !normSeed) return false;
  if (isDictionaryQueryNoise(cand)) return false;
  if (!isUsefulTerm(cand)) return false;

  for (const re of OFF_TOPIC_PATTERNS) {
    if (re.test(cand)) return false;
  }

  const seeds = seedTokens(normSeed);
  if (!seeds.length) return false;

  const candWords = cand.split(/\s+/).filter((w) => w.length >= 3);
  if (!candWords.length) return false;

  const matchedSeeds = seeds.filter((sw) => candWords.some((cw) => candMatchesSeed(cw, sw)));
  if (!matchedSeeds.length) return false;

  // Multi-word phrase with at least one seed token (e.g. "prywatny detektyw").
  if (candWords.length >= 2) return true;

  // Single-token term must stem-match a seed word.
  return candWords.length === 1 && seeds.some((sw) => candMatchesSeed(candWords[0], sw));
}

/** Filter keyword rows to those on-topic for the primary seed. */
export function filterOnTopicKeywords<T extends { keyword: string }>(rows: T[], seedKeyword: string): T[] {
  return rows.filter((r) => isKeywordOnTopic(r.keyword, seedKeyword));
}

/** Filter NLP term list to on-topic phrases only. */
export function filterOnTopicTerms<T extends { term: string }>(terms: T[], seedKeyword: string): T[] {
  return terms.filter((t) => isKeywordOnTopic(t.term, seedKeyword));
}

/**
 * Below this the strict pass is treated as a failed extraction and the soft pass runs
 * unconditionally. It is a floor, never a ceiling — the soft pass runs above it too.
 */
const MIN_ANALYSIS_TERMS = 12;

/**
 * Competitor documents a term must appear in before the corpus itself counts as proof
 * of topicality. Two is the smallest number that means "more than one page thought this
 * mattered", and the sidecar's extractor already requires a minimum document count.
 */
const CORPUS_EVIDENCE_MIN_DOCS = 2;

function isKnownNoiseTerm(term: string): boolean {
  if (!term || !isUsefulTerm(term)) return true;
  if (isDictionaryQueryNoise(term)) return true;
  return OFF_TOPIC_PATTERNS.some((re) => re.test(term));
}

/**
 * Deep-analysis term filter.
 *
 * Seed overlap is a weak signal for NLP terms and was being used as the only one. The
 * terms arrive from the sidecar's competitor extractor, which already establishes
 * topicality by counting how many ranking pages use a phrase — so a term appearing
 * across several competitors is on-topic whether or not it repeats the keyword.
 *
 * Requiring the keyword threw away exactly the vocabulary that makes an article rank:
 * measured against Surfer's own list for "prywatny detektyw warszawa" this kept 12 of
 * 39 terms, and every survivor contained "detektyw". Gone were "wykrywanie podsłuchów",
 * "sprawy rozwodowej", "materiałów dowodowych", "wywiad gospodarczy" — the substance.
 *
 * So: strict seed matches, plus anything the corpus vouches for, minus known noise.
 */
export function filterNlpTermsForAnalysis<
  T extends { term: string; doc_freq?: number },
>(terms: T[], seedKeyword: string): T[] {
  if (!terms.length) return [];
  const strict = filterOnTopicTerms(terms, seedKeyword);
  const strictTerms = new Set(strict.map((t) => t.term));

  const seeds = seedTokens(seedKeyword);
  const strictSeeds = new Set<string>();
  for (const t of strict) {
    for (const w of normalizeTerm(t.term).split(/\s+/).filter((x) => x.length >= 3)) {
      strictSeeds.add(w);
    }
  }
  const relatedSeeds = [...seeds, ...strictSeeds];

  const soft = terms.filter((t) => {
    if (strictTerms.has(t.term)) return false;
    const term = normalizeTerm(t.term);
    if (isKnownNoiseTerm(term)) return false;
    const words = term.split(/\s+/).filter((w) => w.length >= 3);
    if (!words.length) return false;
    // Several competitors used it — that is the corpus establishing the topic, not us.
    if ((t.doc_freq ?? 0) >= CORPUS_EVIDENCE_MIN_DOCS) return true;
    if (sharesAnySeedToken(words, relatedSeeds)) return true;
    // Single-document term with no seed overlap: keep only longer unigrams, and only
    // once the strict pass proved the extraction itself was sane.
    return words.length === 1 && words[0].length >= 8 && strict.length > 0;
  });

  const merged = [...strict, ...soft];
  // A strict pass under the floor means extraction went wrong, not that the topic is
  // narrow — take whatever the soft pass salvaged rather than shipping four terms.
  return merged.length >= strict.length ? merged : strict;
}
