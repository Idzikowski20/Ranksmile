/**
 * Strict topic matching for keyword/term enrichment — prevents DFS/GSC noise
 * (e.g. "test z lektury…" matching seed "warszawa" via substring "a").
 */
import { foldPolishLetters, isDictionaryQueryNoise, isUsefulTerm, normalizeTerm } from '@/src/core/domain/terms/termUtils';

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

/**
 * A search query that happens to contain the keyword, rather than vocabulary an article
 * can use.
 *
 * `enrichNlpTermsIfNeeded` merges up to 80 DataForSEO keyword suggestions into the NLP
 * term list, and every seed check waves them through because they repeat the keyword.
 * Article 84 was graded against "szantaż emocjonalny po angielsku", "szantaż emocjonalny
 * po angielskiego" (autocomplete, not even grammatical), "susan forward szantaż
 * emocjonalny pdf" and "czy szantaż emocjonalny jest karalny" — 64 of its 111 terms went
 * uncovered, which is 60% of the SEO score's term component gone by construction. A
 * Polish article about emotional blackmail cannot contain the phrase "po angielsku"
 * without being about translation.
 *
 * Two shapes, both queries rather than terms:
 *  - format/translation modifiers — the searcher wants a file or a translation;
 *  - a leading interrogative — that is a question for the coverage checklist, and the
 *    article answers it in prose rather than repeating the query verbatim.
 */
const QUERY_MODIFIER_RE = /\b(pdf|epub|ebook|chomikuj|cda|torrent|po (?:angielsku|ang|niemiecku|polsku)|angielski|angielskiego|tlumaczenie|synonim|cytaty|memy|film|ksiazka|audiobook|streszczenie|wikipedia)\b/;
const QUESTION_PREFIX_RE = /^(czy|co|jak|jakie|jaki|jaka|kiedy|ile|gdzie|dlaczego|czym|kto|komu)\b/;

/**
 * An interrogative anywhere in the phrase, not just at the front.
 *
 * Google's autocomplete puts the keyword first: "szantaż emocjonalny czy jest karalny",
 * "szantaż emocjonalny jak się bronić", "szantaż emocjonalny co to". Anchoring the rule
 * to the start of the string missed every one of them, which is most of the list.
 */
const QUESTION_TOKEN_RE = /(^|\s)(czy|jak|jakie|jaki|jaka|kiedy|ile|gdzie|dlaczego|czym|kto|komu|co to|co grozi)(\s|$)/;

function isQueryShapedTerm(term: string): boolean {
  if (QUERY_MODIFIER_RE.test(term)) return true;
  // Only multiword phrases: "co" or "jak" alone is a stopword the useful-term check
  // already handles, and a two-word phrase can still be real vocabulary.
  const words = term.split(/\s+/).filter(Boolean).length;
  if (QUESTION_PREFIX_RE.test(term) && words >= 3) return true;
  return QUESTION_TOKEN_RE.test(term) && words >= 4;
}

/**
 * Corpus evidence a keyword long-tail needs before it counts as vocabulary.
 *
 * "szantaż emocjonalny" plus one or two words is the shape of a Google autocomplete
 * suggestion, and the SERP path ships dozens of them: article 87 was graded on
 * "szantaż emocjonalny teściowej", "… empik", "… gwp", "… alkoholika" and "…
 * paragraf" — 54 of its 94 terms went uncovered and almost all of them looked like
 * this. Two competitor pages is not enough for a phrase the article has no reason to
 * contain; a genuine subtopic ("szantaż emocjonalny w związku") clears the bar because
 * several ranking pages actually discuss it.
 */
const LONGTAIL_EVIDENCE_MIN_DOCS = 3;

type TermEvidence = { doc_freq?: number; relevance?: number; type?: string };

function isWeakKeywordLongTail(term: string, seedKeyword: string, evidence: TermEvidence): boolean {
  const seed = normalizeTerm(seedKeyword);
  if (!seed || !term.includes(seed)) return false;
  // The keyword itself, and simple inflections of it, are the article's own topic.
  const extra = term.replace(seed, ' ').split(/\s+/).filter(Boolean);
  if (!extra.length) return false;

  // A missing doc_freq is unknown evidence, not zero. Treating it as junk was tried and
  // reverted: it also deleted "szantaż emocjonalny w związku", "… w pracy" and "… u
  // dzieci", which are real subtopics a competitor set discusses. Dropping those lifts
  // the term score by shrinking what the article is measured against, which is scoring
  // theatre rather than a better article. Query SHAPE is the honest signal, and
  // isQueryShapedTerm carries it.
  if (typeof evidence.doc_freq !== 'number') return false;
  return evidence.doc_freq < LONGTAIL_EVIDENCE_MIN_DOCS;
}

/**
 * Rows evidenced by the competitor corpus (doc_freq / relevance / type present).
 *
 * Surfer's exported guideline for "szantaż emocjonalny" — the ground truth this
 * pipeline is measured against — contains ONLY corpus n-grams; every autocomplete
 * shape lives in its separate questions list. Our keyword-suggestion rows carry no
 * corpus metadata, and once the corpus harvest is rich they are pure dead weight:
 * article 99 carried 12 of them ("szantaż emocjonalny empik", "… gwp", "foch …",
 * "teściowa …"), all at zero coverage by construction. They are dropped only when
 * enough evidenced rows exist — on a thin corpus the suggestions still fill the gap,
 * which is why an unconditional version of this rule was reverted earlier.
 */
const CORPUS_RICH_MIN_ROWS = 25;
const LIST_RICH_MIN_ROWS = 40;

export function dropSuggestionTailsWhenCorpusRich<T extends { term: string } & TermEvidence>(
  terms: T[],
  seedKeyword: string,
): T[] {
  const evidenced = terms.filter(
    (t) => typeof t.doc_freq === 'number' || t.relevance !== undefined || Boolean(t.type),
  );
  // Two ways to be "rich": enough rows still carrying corpus metadata, or a long list
  // overall. The second matters because evidence fields do not survive the round-trip
  // through article_terms (the table has no doc_freq/type/relevance columns), so a list
  // rebuilt from stored rows can be 50 corpus terms that all LOOK unevidenced — article
  // 100 counted 29 evidenced against a threshold of 30 and kept every junk tail.
  if (evidenced.length < CORPUS_RICH_MIN_ROWS && terms.length < LIST_RICH_MIN_ROWS) return terms;
  const seed = normalizeTerm(seedKeyword);
  if (!seed) return terms;
  return terms.filter((t) => {
    const hasEvidence = typeof t.doc_freq === 'number' || t.relevance !== undefined || Boolean(t.type);
    if (hasEvidence) return true;
    const term = normalizeTerm(t.term);
    // Only the keyword-plus-tail shape is a suggestion; a plain phrase with no
    // metadata may be a legitimate manual or legacy row.
    if (!term.includes(seed)) return true;
    return term === seed;
  });
}

/**
 * Question-shaped keyword suggestions, routed to where Surfer keeps them.
 *
 * Surfer's exported guideline holds "Co grozi za szantaż emocjonalny?" and "Gdzie
 * zgłosić szantaż emocjonalny?" in QUESTIONS TO ANSWER — never in terms. Our filters
 * correctly drop these rows from the term list, but they were discarded entirely: on a
 * zero-PAA SERP the coverage checklist ended up with a single question-shaped row while
 * the suggestions carrying exactly Surfer's questions went to waste. This recovers them
 * for scoreData.paa_questions, which feeds both the planner and the coverage build.
 */
export function questionsFromSuggestions<T extends { term: string }>(
  terms: T[],
  seedKeyword: string,
  cap = 8,
): string[] {
  const seeds = seedTokens(seedKeyword);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of terms) {
    const raw = (t.term || '').trim();
    const norm = normalizeTerm(raw);
    if (!norm || !isQueryShapedTerm(norm)) continue;
    // Format/translation noise is a query shape too — but not a question.
    if (QUERY_MODIFIER_RE.test(norm)) continue;
    const words = norm.split(/\s+/).filter((w) => w.length >= 3);
    if (!sharesAnySeedToken(words, seeds)) continue;
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(/\?$/.test(raw) ? raw : `${raw}?`);
    if (out.length >= cap) break;
  }
  return out;
}

/** Filter keyword rows to those on-topic for the primary seed. */
export function filterOnTopicKeywords<T extends { keyword: string }>(rows: T[], seedKeyword: string): T[] {
  return rows.filter((r) => isKeywordOnTopic(r.keyword, seedKeyword));
}

/**
 * Filter NLP term list to on-topic phrases only.
 *
 * Query-shaped entries are dropped here and NOT in `isKeywordOnTopic`, which also serves
 * `filterOnTopicKeywords` — a keyword row is *supposed* to look like a query.
 */
export function filterOnTopicTerms<T extends { term: string }>(terms: T[], seedKeyword: string): T[] {
  return terms.filter((t) => (
    isKeywordOnTopic(t.term, seedKeyword) && !isQueryShapedTerm(normalizeTerm(t.term))
  ));
}

/**
 * Competitor documents a term must appear in before the corpus itself counts as proof
 * of topicality. It only means anything while `doc_freq` really is a distinct-document
 * count — `semantic_terms.py` used to fill it with a per-heading chunk count, so one
 * page saying something twice bought a free pass past every topic check.
 *
 * Two used to be the bar, on the reasoning that "more than one page thought this
 * mattered". Measured against a live SERP that reasoning is backwards: boilerplate is
 * exactly what repeats across competitors. A detective-services term set carried
 * `e mail` (5 docs), `zobacz` (5), `numer` (4) and a competitor's street name — footers
 * and nav, present on every page of every site, so `doc_freq` is *maximal* for the
 * junk. Only near-universal presence separates a corpus topic from a corpus template.
 */
const CORPUS_EVIDENCE_MIN_DOCS = 2;
const CORPUS_EVIDENCE_RATIO = 0.8;

/**
 * How many documents the corpus actually spans, inferred from the most widespread term.
 * An absolute floor cannot work across SERP sizes: six of ten competitors is evidence,
 * six of six is a template. Nothing passes the term list its corpus size, and the
 * busiest term is a sound proxy for it.
 */
function corpusEvidenceFloor(terms: ReadonlyArray<TermEvidence>): number {
  const widest = terms.reduce((max, t) => Math.max(max, t.doc_freq ?? 0), 0);
  return Math.max(CORPUS_EVIDENCE_MIN_DOCS, Math.ceil(widest * CORPUS_EVIDENCE_RATIO));
}

/**
 * Longest phrase a content term ever is. Beyond this it is a search suggestion, not
 * vocabulary: the reference tool's longest entry is four words ("agencja detektywistyczna
 * w warszawie"), while article 17 was graded against "philip prywatny detektyw z książek
 * raymonda chandlera" and "agencja detektywistyczna kob group prywatny detektyw warszawa
 * śródmieście" — 92 of its 151 terms were uncoverable by construction.
 */
const MAX_TERM_WORDS = 5;

/** Polish cities, so a suggestion for another one cannot pose as this article's topic. */
const CITIES = [
  'warszawa', 'krakow', 'wroclaw', 'poznan', 'gdansk', 'lodz', 'katowice', 'szczecin',
  'lublin', 'bialystok', 'gdynia', 'rzeszow', 'czestochowa', 'radom', 'torun', 'kielce',
  'olsztyn', 'opole', 'zabrze', 'gliwice', 'bytom', 'sosnowiec', 'bielsko',
  'jelenia gora', 'zielona gora',
];
const CITY_RE = new RegExp(`(^|\\s)(${CITIES.join('|')})(\\s|$)`, 'i');

/**
 * A phrase naming a city the article is not about.
 *
 * "prywatny detektyw jelenia gora cennik" reached a Warsaw article's term list because it
 * contains "detektyw" — every seed check passed it. The keyword's own city is exempt.
 */
function namesAnotherCity(term: string, seedKeyword: string): boolean {
  const match = CITY_RE.exec(foldPolishLetters(term));
  if (!match) return false;
  return !foldPolishLetters(seedKeyword).includes(match[2]);
}

function isKnownNoiseTerm(term: string, seedKeyword = ''): boolean {
  if (!term || !isUsefulTerm(term)) return true;
  if (isDictionaryQueryNoise(term)) return true;
  if (term.split(/\s+/).filter(Boolean).length > MAX_TERM_WORDS) return true;
  if (isQueryShapedTerm(term)) return true;
  if (seedKeyword && namesAnotherCity(term, seedKeyword)) return true;
  return OFF_TOPIC_PATTERNS.some((re) => re.test(term));
}

/**
 * Noise removal WITHOUT the seed-token rules.
 *
 * The competitor-corpus scrape establishes topicality by construction — the phrases come
 * off the pages that already rank — so `filterNlpTermsForAnalysis` is too strict there
 * and its caller deliberately skipped it. Skipping it entirely also let the stopwords,
 * autocomplete long-tails and query shapes through, which is how "bezpłatna", "zyciu" and
 * "szantaż emocjonalny empik" reached a graded term list from that branch.
 */
export function dropNoisyTerms<T extends { term: string } & TermEvidence>(
  terms: T[],
  seedKeyword: string,
): T[] {
  return terms.filter((t) => {
    const term = normalizeTerm(t.term);
    if (isKnownNoiseTerm(term, seedKeyword)) return false;
    return !isWeakKeywordLongTail(term, seedKeyword, t);
  });
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
  T extends { term: string } & TermEvidence,
>(terms: T[], seedKeyword: string): T[] {
  if (!terms.length) return [];
  // Noise has to be cut from the strict set too: a search suggestion like
  // "prywatny detektyw jelenia gora cennik" repeats the keyword, so every seed check
  // waves it through and it was never reaching the soft branch's filter at all.
  const strict = filterOnTopicTerms(terms, seedKeyword)
    .filter((t) => !isKnownNoiseTerm(normalizeTerm(t.term), seedKeyword))
    .filter((t) => !isWeakKeywordLongTail(normalizeTerm(t.term), seedKeyword, t));
  const strictTerms = new Set(strict.map((t) => t.term));

  const seeds = seedTokens(seedKeyword);
  const strictSeeds = new Set<string>();
  for (const t of strict) {
    for (const w of normalizeTerm(t.term).split(/\s+/).filter((x) => x.length >= 3)) {
      strictSeeds.add(w);
    }
  }
  const relatedSeeds = [...seeds, ...strictSeeds];

  const evidenceFloor = corpusEvidenceFloor(terms);
  // Whether the extraction handed us any corpus evidence at all. With it, `doc_freq` is
  // the signal to judge an off-seed term by; without it (older analyses, and any path
  // that never counted documents) length is the only thing left to fall back on.
  const hasCorpusEvidence = terms.some((t) => (t.doc_freq ?? 0) > 0);

  const soft = terms.filter((t) => {
    if (strictTerms.has(t.term)) return false;
    const term = normalizeTerm(t.term);
    if (isKnownNoiseTerm(term, seedKeyword)) return false;
    if (isWeakKeywordLongTail(term, seedKeyword, t)) return false;
    const words = term.split(/\s+/).filter((w) => w.length >= 3);
    if (!words.length) return false;
    // Near every competitor used it — that is the corpus establishing the topic, not us.
    if ((t.doc_freq ?? 0) >= evidenceFloor) return true;
    if (sharesAnySeedToken(words, relatedSeeds)) return true;
    // Last resort: a lone long word, kept only once the strict pass proved the
    // extraction was sane. Length carries no topical test, so it applies only where the
    // corpus told us nothing — with document counts in hand this rule was a noise pump,
    // admitting eighteen terms on a live SERP (`Całodobowo`, `mazowieckie`,
    // `profesjonalne`, `Jesteśmy`) against two worth keeping.
    if (hasCorpusEvidence) return false;
    return words.length === 1 && words[0].length >= 8 && strict.length > 0;
  });

  return [...strict, ...soft];
}
