import type { CoverageItem } from './aiCoverage';
import { computeCompetitorContentScore } from './competitorContentScore';
import {
   aiExtractabilityScore,
   datesAuthorScore,
   earlyAnswerScore,
   keywordStuffingScore,
   thinOriginalityScore,
   titleQueryScore,
} from './contentEffort';
import { termSalienceWeight } from './termSalienceCore';
import { countOccurrences, normalizePl, tokenize, wordMatch } from './termMatch';

export { countOccurrences } from './termMatch';

// Content Score formula — targets derived from average of top-10 competitor pages.
//
// Signal slots (each 0–max, normalised to 100):
//   Core (always):   word_count(20) + heading_count(10) + nlp_terms(25)
//   Optional core:   paragraphs(5)           — when paragraphs_target is set
//   HTML+keyword:    keyword_placement(15) + readability(10) + external_links(5)
//   PAA questions:   faq_coverage(10)        — when paa_questions[] is in scoreData
//
// Missing signals reduce the denominator, so the score stays normalised to 100.
// Score is always capped at 100.

export interface NlpTerm {
   term: string;
   target_count: number;
   current_count?: number;
   /** Competitor-derived usage range (Surfer "suggested" column). */
   suggested_min?: number;
   suggested_max?: number;
   relevance?: number;
   doc_freq?: number;
   /** 0–100 prominence from competitor H2/bold/font-weight zones (Surfer NLP salience v2). */
   salience?: number;
}

export interface ScoreData {
   terms: NlpTerm[];
   words_target: number;
   words_min: number;
   words_max: number;
   headings_target: number;
   headings_min: number;
   headings_max: number;
   paragraphs_target?: number;
   paragraphs_min?: number;
   paragraphs_max?: number;
   /** How many competitor pages were used to derive the targets (0 = local estimate) */
   competitor_count?: number;
   /** People Also Ask questions fetched from Serper — used for FAQ coverage signal */
   paa_questions?: string[];
   /** When set, content score uses Surfer-style competitor benchmarking. */
   scoring_model?: 'competitor' | 'legacy';
   content_targets?: { avgWords: number; avgHeadings: number; avgPs: number };
   /** Full Surfer-style audit payload (factors, terms, internal links). */
   audit_result?: import('./auditTypes').AuditResult;
   /** On-page SEO score from audit factor verdicts. */
   seo_score?: number;
   /** AI Search score (Facts + Intent) — persisted after deep-analysis. */
   ai_score?: number;
   /** Persisted gauge values (not part of scoring formula). */
   _heading_count?: number;
   _paragraph_count?: number;
   _computed_score?: number;
   _content_score?: number;
   /** Content effort insight (heuristic or LLM) — not Google NSR. */
   content_effort?: {
      score: number;
      reasons: string[];
      source: 'heuristic' | 'llm';
      at?: string;
      history?: Array<{ score: number; at: string; source: 'heuristic' | 'llm' }>;
   };
}

/**
 * For a single text node, return each term's match ranges (char offsets into
 * `text`) using the same inflection-tolerant matching as countOccurrences. Tokenizes
 * the text once for all terms — used by the editor's term-highlight decorations.
 * normalizePl is length-preserving, so indices map straight back onto `text`.
 */
export function findTermRangesBatch(text: string, terms: string[]): Array<{ term: string; ranges: Array<[number, number]> }> {
   if (!text || !terms.length) return [];
   const norm = normalizePl(text);
   const toks: Array<{ w: string; start: number; end: number }> = [];
   const re = /[a-z0-9]+/g;
   let m: RegExpExecArray | null = re.exec(norm);
   while (m !== null) { toks.push({ w: m[0], start: m.index, end: m.index + m[0].length }); m = re.exec(norm); }
   if (!toks.length) return terms.map((term) => ({ term, ranges: [] }));
   return terms.map((term) => {
      const Q = tokenize(term);
      const ranges: Array<[number, number]> = [];
      if (Q.length) {
         for (let i = 0; i + Q.length <= toks.length; i += 1) {
            let ok = true;
            for (let j = 0; j < Q.length; j += 1) { if (!wordMatch(toks[i + j].w, Q[j])) { ok = false; break; } }
            if (ok) ranges.push([toks[i].start, toks[i + Q.length - 1].end]);
         }
      }
      return { term, ranges };
   });
}

/** Coverage status of a term vs. its target — shared by the panel chips and the editor highlight. */
export type Coverage = 'red' | 'yellow' | 'green';
export function termCoverage(t: { current_count?: number; target_count: number }): Coverage {
   const cur = t.current_count ?? 0;
   if (cur === 0) return 'red';
   if (cur < t.target_count) return 'yellow';
   return 'green';
}
/** Human usage hint shown in the term tooltip (panel + editor highlight). */
export function termUsageHint(t: { current_count?: number; target_count: number }): string {
   const cur = t.current_count ?? 0;
   const tgt = Math.max(t.target_count, 1);
   if (cur >= tgt) return "Good job. You're in optimal range.";
   if (cur === 0) return tgt > 1 ? `Use ${tgt} times. Currently used 0 times.` : 'Use at least once. Currently used 0 times.';
   return `Use ${tgt} time${tgt !== 1 ? 's' : ''}. Currently used ${cur} time${cur !== 1 ? 's' : ''}.`;
}

// ── Signal helpers ────────────────────────────────────────────────────────────

/**
 * Keyword placement in key positions (max 15).
 *   +6  keyword found in H1
 *   +5  keyword found in at least one H2
 *   +4  keyword found in first 100 words
 */
const KW_STOP = new Set(['jak', 'co', 'czy', 'ile', 'gdzie', 'kiedy', 'w', 'we', 'i', 'na', 'do', 'z', 'ze', 'za', 'o', 'po', 'u', 'the', 'a', 'of', 'to', 'in', 'for', 'and', 'or']);
/** Meaningful keyword tokens — drops stopwords/short glue words. */
function keywordTokens(keyword: string): string[] {
   return tokenize(keyword).filter((t) => t.length >= 3 && !KW_STOP.has(t));
}
/**
 * Enough meaningful keyword tokens appear (inflection-tolerant) in the section.
 * Requires a majority (≥60%, min 2) rather than all, so a section can carry the
 * topic ("pozycjonowanie strony") without every secondary token ("google").
 */
function allTokensPresent(sectionText: string, kwToks: string[]): boolean {
   if (!kwToks.length) return false;
   const T = tokenize(sectionText);
   const required = Math.min(kwToks.length, Math.max(2, Math.ceil(kwToks.length * 0.6)));
   let hits = 0;
   for (const q of kwToks) { if (T.some((t) => wordMatch(t, q))) hits += 1; }
   return hits >= required;
}
function _kwPlacement(html: string, keyword: string): number {
   const kwToks = keywordTokens(keyword);
   if (!kwToks.length) return 0;
   let score = 0;

   const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
   if (h1 && allTokensPresent(h1[1].replace(/<[^>]+>/g, ' '), kwToks)) score += 6;

   const h2s = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)];
   if (h2s.some((m) => allTokensPresent(m[1].replace(/<[^>]+>/g, ' '), kwToks))) score += 5;

   const first100 = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(/\s+/).slice(0, 100).join(' ');
   if (allTokensPresent(first100, kwToks)) score += 4;

   return score; // max 15
}

/**
 * Paragraph readability — average characters per <p> tag (max 10).
 * Optimal range ≈120–450 characters (human editorial prose). Thin stubs and
 * walls of text are penalised — matches Auto-Optimize STRUCTURE_RULES.
 */
function _readability(html: string): number {
   const paras = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
   if (paras.length < 2) return 0;

   const avg = paras.reduce((sum, m) => {
      const chars = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().length;
      return sum + chars;
   }, 0) / paras.length;

   if (avg >= 120 && avg <= 450) return 10;
   if (avg < 120) return Math.max(2, (avg / 120) * 10);
   // Soft drop past 450 → still readable until ~700 (structure validator max)
   if (avg <= 700) return Math.max(4, 10 - ((avg - 450) / 50));
   return 2;
}

/**
 * FAQ coverage — how many PAA questions the article answers (max 10).
 * A question is "covered" when ≥70% of its content words appear in the article,
 * or when a heading matches ≥60% of the question's content words.
 */
function _faqCoverage(html: string, questions: string[]): number {
   if (!questions.length) return 0;

   const bodyText = html.replace(/<[^>]+>/g, ' ').toLowerCase();
   const headings = [...html.matchAll(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/gi)]
      .map(m => m[1].replace(/<[^>]+>/g, '').toLowerCase());

   // Short stopwords to strip from questions before matching
   const STOP = new Set(['co', 'jak', 'czy', 'ile', 'kiedy', 'gdzie', 'dlaczego', 'czym',
      'the', 'what', 'how', 'why', 'when', 'where', 'is', 'are', 'do', 'does', 'can']);

   let covered = 0;
   for (const q of questions) {
      const words = q.toLowerCase().replace(/[?!.,]/g, '').split(/\s+/)
         .filter(w => w.length > 3 && !STOP.has(w));
      if (words.length === 0) { covered++; continue; }

      const bodyHit = words.filter(w => bodyText.includes(w)).length / words.length >= 0.7;
      const headingHit = headings.some(h => words.filter(w => h.includes(w)).length / words.length >= 0.6);
      if (bodyHit || headingHit) covered++;
   }

   return (covered / questions.length) * 10;
}

/**
 * External links as E-E-A-T signal (max 5).
 * Articles citing sources (3–7 external links) score best.
 */
function _externalLinks(html: string): number {
   const count = (html.match(/href="https?:\/\//gi) || []).length;
   if (count === 0) return 0;
   if (count <= 2) return 2;
   if (count <= 7) return 5;
   return 3; // too many external links slightly penalised
}

/**
 * Title–query quality (max 7).
 * Keyword presence + early position; soft length band (no hard 50–60 char ranking).
 * Returns null when no <title> so the slot is excluded from the denominator.
 */
function _titleQuality(html: string, keyword: string): number | null {
   return titleQueryScore(html, keyword);
}

/**
 * Meta description quality (max 5).
 * Keyword presence (+3) and optimal length 140-165 chars (+2, partial +1).
 * Returns null when no <meta name="description"> tag is present so the slot
 * is excluded from the denominator rather than permanently wasting 5 points.
 */
function _metaDescQuality(html: string, keyword: string): number | null {
   const kw = keyword.toLowerCase().trim();
   const match = /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i.exec(html)
      || /<meta[^>]+content=["']([^"']*)[^>]+name=["']description["']/i.exec(html);
   if (!match) return null; // no meta description → skip slot entirely
   const desc = match[1].trim();
   let score = 0;
   if (kw && desc.toLowerCase().includes(kw)) score += 3;
   const len = desc.length;
   if (len >= 140 && len <= 165) score += 2;
   else if (len >= 100 && len <= 200) score += 1;
   return score; // max 5
}

/**
 * Image alt text coverage (max 4).
 * Rewards having descriptive alt text on images — an on-page SEO and accessibility signal.
 * Returns null (skip slot) if no images are found.
 */
function _imageAltCoverage(html: string): number | null {
   const imgs = html.match(/<img[^>]+>/gi) || [];
   // Filter out tiny/decorative data URIs
   const content = imgs.filter((img) => !img.includes('data:'));
   if (content.length === 0) return null; // no images → skip slot
   const withAlt = content.filter((img) => /alt=["'][^"']+["']/i.test(img)).length;
   const ratio = withAlt / content.length;
   if (ratio >= 0.8) return 4;
   if (ratio >= 0.5) return 2;
   if (ratio > 0) return 1;
   return 0;
}

/**
 * List usage — organization signal (max 3).
 * Pages using structured lists (ul/ol with ≥3 items) are better organized.
 */
function _listUsage(html: string): number {
   const lists = html.match(/<(ul|ol)[^>]*>([\s\S]*?)<\/(ul|ol)>/gi) || [];
   const substantial = lists.filter((l) => (l.match(/<li/gi) || []).length >= 3);
   if (substantial.length >= 2) return 3;
   if (substantial.length === 1) return 2;
   if (lists.length > 0) return 1;
   return 0;
}

// ── Main scoring function ─────────────────────────────────────────────────────

export type ScoreSlot = { key: string; label: string; earned: number; max: number; hint: string };

// Single source of truth for every scoring slot — both computeContentScore (sum) and
// computeContentScoreBreakdown (per-slot gaps) read from this so they can never diverge.
export function collectScoreSlots(
   plainText: string,
   wordCount: number,
   headingCount: number,
   scoreData: ScoreData,
   paragraphCount?: number,
   html?: string,
   keyword?: string,
   keywordCoverage?: Array<{ keyword: string; is_covered: boolean }>,
   coverageItems?: readonly CoverageItem[],
): ScoreSlot[] {
   const slots: ScoreSlot[] = [];
   if (!scoreData) return slots;

   const push = (key: string, label: string, score: number, max: number, hint: string) => {
      slots.push({ key, label, earned: Math.min(Math.max(score, 0), max), max, hint });
   };

   // ── Core structural signals — scored even without competitor terms, so the gauge tracks edits ──
   const wordsTarget = Math.max(scoreData.words_target || 0, 1);
   const headingsTarget = Math.max(scoreData.headings_target || 0, 1);
   push('words', 'Word count', Math.min(wordCount / wordsTarget, 1) * 20, 20,
      `Expand the article toward ~${scoreData.words_target || wordsTarget} words`);
   push('headings', 'Headings', Math.min(headingCount / headingsTarget, 1) * 10, 10,
      `Add headings toward ~${scoreData.headings_target || headingsTarget} (use H3 inside H2 sections)`);

   // ── NLP terms — prefer activated `article_terms` entity coverage items when present,
   // else fall back to the legacy scoreData.terms path (dual-read, zero regression).
   // The entity branch scores LIVE against the current plainText (not the frozen
   // snapshot `covered` flag) so the gauge keeps tracking edits after deep analysis. ──
   const entityItems = (coverageItems ?? []).filter((i) => i.type === 'entity');
   if (entityItems.length > 0) {
      const covered = entityItems.filter((i) => countOccurrences(plainText, i.label) >= 1).length;
      const earned = Math.round((covered / entityItems.length) * 25);
      push('terms', 'NLP terms', earned, 25, `${covered}/${entityItems.length} terms covered`);
   } else if (scoreData.terms?.length) {
      const totalWeight = scoreData.terms.reduce(
        (s, t) => s + Math.max(t.target_count, 1) * termSalienceWeight(t),
        0,
      );
      const termsRatio = scoreData.terms.reduce((s, t) => {
         const actual = countOccurrences(plainText, t.term);
         const w = Math.max(t.target_count, 1) * termSalienceWeight(t);
         return s + Math.min(actual / Math.max(t.target_count, 1), 1) * w;
      }, 0) / Math.max(totalWeight, 1);
      push('terms', 'NLP terms', termsRatio * 25, 25, 'Use the suggested terms at their target counts (see Keywords & Terms)');
   }

   if (scoreData.paragraphs_target && paragraphCount !== undefined) {
      push('paragraphs', 'Paragraphs', Math.min(paragraphCount / Math.max(scoreData.paragraphs_target, 1), 1) * 5, 5,
         `Aim for ~${scoreData.paragraphs_target} paragraphs`);
   }

   // ── HTML + keyword signals ──
   if (html && keyword) {
      push('kwPlacement', 'Keyword placement', _kwPlacement(html, keyword), 15,
         `Put "${keyword}" in the H1, at least one H2, and the first 100 words`);
      push('readability', 'Readability', _readability(html), 10, 'Keep paragraphs ~120–450 characters of readable prose under each heading');
      push('externalLinks', 'External links', _externalLinks(html), 5, 'Cite 3–7 authoritative external sources');
      const titleScore = _titleQuality(html, keyword);
      if (titleScore !== null) {
         push('title', 'Title tag', titleScore, 7,
            `Put "${keyword}" near the start of the title (readable length ~30–70 chars)`);
      }
      const metaScore = _metaDescQuality(html, keyword);
      if (metaScore !== null) push('meta', 'Meta description', metaScore, 5, `Include "${keyword}" in a 140–165 char meta description`);

      const stuffing = keywordStuffingScore(plainText, keyword);
      push('stuffing', 'Keyword stuffing', stuffing.earned, stuffing.max,
         'Ease off exact-match keyword repeats — density looks spammy');

      const early = earlyAnswerScore(html, plainText, keyword);
      push('earlyAnswer', 'Early answer', early.earned, early.max,
         'Answer the query in the first ~100 words / first ~5–6k HTML chars');
   }

   // ── HTML-only signals ──
   if (html) {
      const imgScore = _imageAltCoverage(html);
      if (imgScore !== null) push('imageAlt', 'Image alt text', imgScore, 4, 'Add descriptive alt text to every image');
      push('lists', 'Lists', _listUsage(html), 3, 'Add a bullet or numbered list with 3+ items');

      const datesAuthor = datesAuthorScore(html, plainText);
      push('datesAuthor', 'Author & dates', datesAuthor.earned, datesAuthor.max,
         'Show an author (and bio) plus clear publish/update dates');

      const extract = aiExtractabilityScore(html, plainText, scoreData.paa_questions);
      push('aiExtract', 'AI extractability', extract.earned, extract.max,
         'Use dense structure, descriptive alts, and findable PAA answers in plain text');
   }

   // ── Originality / replicability (plain text) ──
   if (plainText.trim().length > 0) {
      const thin = thinOriginalityScore(plainText);
      push('originality', 'Originality', thin.earned, thin.max,
         'Add unique specifics — thin or template-like text is cheap to replicate');
   }

   // ── FAQ coverage ──
   if (html && scoreData.paa_questions?.length) {
      push('faq', 'FAQ coverage', _faqCoverage(html, scoreData.paa_questions), 10, 'Answer the People-Also-Ask questions in the content');
   }

   // ── Keyword coverage ──
   if (keywordCoverage !== undefined && keywordCoverage.length > 0) {
      const coveredCount = keywordCoverage.filter((k) => k.is_covered).length;
      push('kwCoverage', 'Keyword coverage', (coveredCount / keywordCoverage.length) * 10, 10, 'Cover the remaining target keywords');
   }

   return slots;
}

export function computeContentScore(
   plainText: string,
   wordCount: number,
   headingCount: number,
   scoreData: ScoreData,
   paragraphCount?: number,
   internalLinksCount?: number,
   html?: string,
   keyword?: string,
   keywordCoverage?: Array<{ keyword: string; is_covered: boolean }>,
   coverageItems?: readonly CoverageItem[],
): number {
   if (
      scoreData.scoring_model === 'competitor'
      && scoreData.content_targets
      && scoreData.terms?.length
   ) {
      const base = computeCompetitorContentScore(
         plainText,
         wordCount,
         headingCount,
         paragraphCount ?? 0,
         scoreData.terms,
         scoreData.content_targets,
      );
      let bonus = 0;
      if (html && keyword) {
         bonus += Math.round((_kwPlacement(html, keyword) / 15) * 8);
      }
      if (internalLinksCount !== undefined && internalLinksCount > 0) {
         bonus += Math.min(2, internalLinksCount);
      }
      return Math.min(100, base + bonus);
   }

   const slots = collectScoreSlots(plainText, wordCount, headingCount, scoreData, paragraphCount, html, keyword, keywordCoverage, coverageItems);
   if (!slots.length) return 0;

   const earned = slots.reduce((s, x) => s + x.earned, 0);
   const possible = slots.reduce((s, x) => s + x.max, 0);
   const raw = possible > 0 ? (earned / possible) * 100 : 0;

   // Internal links small bonus (max +3, within the 100 cap)
   let bonus = 0;
   if (internalLinksCount !== undefined && internalLinksCount > 0) {
      bonus = Math.min(3, internalLinksCount);
   }

   return Math.min(100, Math.round(raw + bonus));
}

/**
 * Per-slot breakdown for scoring / Auto-Optimize. `missingPoints` is each slot's
 * share of the final 0–100 score still available (max − earned, normalised by total possible).
 */
export function computeContentScoreBreakdown(
   plainText: string,
   wordCount: number,
   headingCount: number,
   scoreData: ScoreData,
   paragraphCount?: number,
   html?: string,
   keyword?: string,
   keywordCoverage?: Array<{ keyword: string; is_covered: boolean }>,
   coverageItems?: readonly CoverageItem[],
): { slots: Array<ScoreSlot & { missingPoints: number }>; totalPossible: number } {
   const slots = collectScoreSlots(plainText, wordCount, headingCount, scoreData, paragraphCount, html, keyword, keywordCoverage, coverageItems);
   const totalPossible = slots.reduce((s, x) => s + x.max, 0);
   const scale = totalPossible > 0 ? 100 / totalPossible : 0;
   return {
      totalPossible,
      slots: slots.map((s) => ({ ...s, missingPoints: Math.round((s.max - s.earned) * scale) })),
   };
}

/** Actionable SEO score gaps for Auto-Optimize prompts (panel UI no longer lists these). */
export function buildWhatsMissingOptimizeGuidance(opts: {
   html: string;
   scoreData: ScoreData;
   keyword?: string;
   coverageItems?: readonly CoverageItem[];
}): string {
   const plainText = opts.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
   const words = plainText ? plainText.split(/\s+/).length : 0;
   const headings = (opts.html.match(/<h[1-6][\s>]/gi) || []).length;
   const paragraphs = (opts.html.match(/<p[\s>]/gi) || []).length;
   const { slots } = computeContentScoreBreakdown(
      plainText,
      words,
      headings,
      opts.scoreData,
      paragraphs,
      opts.html,
      opts.keyword,
      undefined,
      opts.coverageItems,
   );
   const gaps = slots
      .filter((s) => s.missingPoints > 0)
      .sort((a, b) => b.missingPoints - a.missingPoints)
      .slice(0, 10);
   if (!gaps.length) return '';
   return (
      "WHAT'S MISSING (close these SEO score gaps — highest points first):\n"
      + gaps.map((g) => `- +${g.missingPoints} pts — ${g.label}: ${g.hint}`).join('\n')
   );
}

export function scoreToColor(score: number): string {
   if (score >= 80) return '#22c55e'; // green
   if (score >= 50) return '#f97316'; // orange
   return '#ef4444'; // red
}

export function updateTermsCoverage(plainText: string, terms: NlpTerm[]): NlpTerm[] {
   return terms.map((t) => ({
      ...t,
      current_count: countOccurrences(plainText, t.term),
   }));
}
