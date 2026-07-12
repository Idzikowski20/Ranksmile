/**
 * Strict topic matching for keyword/term enrichment — prevents DFS/GSC noise
 * (e.g. "test z lektury…" matching seed "warszawa" via substring "a").
 */
import { isDictionaryQueryNoise, isUsefulTerm, normalizeTerm } from './termUtils';
import { keywordFromUrl, urlAnchorSeed } from './inferPageKeyword';

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

/** True when `candidate` is on the same topic as `seedKeyword` (whole-word overlap). */
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

  const matchedSeeds = seeds.filter((sw) => candWords.includes(sw));
  if (!matchedSeeds.length) return false;

  // Multi-word phrase with at least one seed token (e.g. "prywatny detektyw").
  if (candWords.length >= 2) return true;

  // Single-token term must exactly match a seed word.
  return candWords.length === 1 && seeds.includes(candWords[0]);
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
const MIN_ANALYSIS_KEEP_RATIO = 0.25;

/**
 * Deep-analysis term filter — strict seed matching first, soft fallback when SERP
 * terms are topical but don't share seed tokens (e.g. "sposoby na wykrycie zdrady").
 */
export function filterNlpTermsForAnalysis<T extends { term: string }>(terms: T[], seedKeyword: string): T[] {
  const strict = filterOnTopicTerms(terms, seedKeyword);
  if (
    !terms.length
    || strict.length >= MIN_ANALYSIS_TERMS
    || strict.length >= terms.length * MIN_ANALYSIS_KEEP_RATIO
  ) {
    return strict;
  }

  const soft = terms.filter((t) => {
    const term = normalizeTerm(t.term);
    if (!term || !isUsefulTerm(term)) return false;
    if (isDictionaryQueryNoise(term)) return false;
    for (const re of OFF_TOPIC_PATTERNS) {
      if (re.test(term)) return false;
    }
    if (term.split(/\s+/).filter((w) => w.length >= 3).length >= 2) {
      return seedTokens(seedKeyword).some((sw) => term.split(/\s+/).includes(sw));
    }
    return isKeywordOnTopic(term, seedKeyword);
  });

  return soft.length > strict.length ? soft : strict;
}
