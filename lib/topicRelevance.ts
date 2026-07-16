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

const MIN_ANALYSIS_TERMS = 12;

function isKnownNoiseTerm(term: string): boolean {
  if (!term || !isUsefulTerm(term)) return true;
  if (isDictionaryQueryNoise(term)) return true;
  return OFF_TOPIC_PATTERNS.some((re) => re.test(term));
}

/**
 * Deep-analysis term filter — strict seed matching first, soft fallback when SERP
 * terms are topical but don't share seed tokens (e.g. "sposoby na wykrycie zdrady").
 *
 * Soft path trusts competitor-SERP phrases: multi-word useful terms and longer
 * unigrams that aren't known off-topic noise. Stem matching covers Polish endings.
 */
export function filterNlpTermsForAnalysis<T extends { term: string }>(terms: T[], seedKeyword: string): T[] {
  const strict = filterOnTopicTerms(terms, seedKeyword);
  if (!terms.length) return [];
  // Only skip soft expansion once we already have a Surfer-like term floor.
  // (Do not early-return on keep-ratio — 3/9 seed matches would otherwise drop
  // related competitor phrases like "dezinformacja".)
  if (strict.length >= MIN_ANALYSIS_TERMS) return strict;

  const seeds = seedTokens(seedKeyword);
  const soft = terms.filter((t) => {
    const term = normalizeTerm(t.term);
    if (isKnownNoiseTerm(term)) return false;
    const words = term.split(/\s+/).filter((w) => w.length >= 3);
    if (!words.length) return false;
    if (sharesAnySeedToken(words, seeds)) return true;
    // Competitor SERP phrases without exact seed overlap (related entities).
    if (words.length >= 2) return true;
    return words.length === 1 && words[0].length >= 6;
  });

  return soft.length > strict.length ? soft : strict;
}
