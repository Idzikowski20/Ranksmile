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
}

export function countOccurrences(text: string, term: string): number {
   if (!text || !term) return 0;
   const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
   const matches = text.match(new RegExp(escaped, 'gi'));
   return matches ? matches.length : 0;
}

// ── Signal helpers ────────────────────────────────────────────────────────────

/**
 * Keyword placement in key positions (max 15).
 *   +6  keyword found in H1
 *   +5  keyword found in at least one H2
 *   +4  keyword found in first 100 words
 */
function _kwPlacement(html: string, keyword: string): number {
   const kw = keyword.toLowerCase().trim();
   if (!kw) return 0;
   let score = 0;

   const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
   if (h1 && h1[1].replace(/<[^>]+>/g, '').toLowerCase().includes(kw)) score += 6;

   const h2s = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)];
   if (h2s.some(m => m[1].replace(/<[^>]+>/g, '').toLowerCase().includes(kw))) score += 5;

   const first100 = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      .split(/\s+/).slice(0, 100).join(' ').toLowerCase();
   if (first100.includes(kw)) score += 4;

   return score; // max 15
}

/**
 * Paragraph readability — average words per <p> tag (max 10).
 * Optimal range 40–100 words. Long walls of text are penalised.
 */
function _readability(html: string): number {
   const paras = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
   if (paras.length < 2) return 0;

   const avg = paras.reduce((sum, m) => {
      const words = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().split(/\s+/).filter(Boolean).length;
      return sum + words;
   }, 0) / paras.length;

   if (avg >= 40 && avg <= 100) return 10;
   if (avg < 40) return Math.max(3, (avg / 40) * 10);
   // Drops from 10 at 100 words to 2 at ≥200 words
   return Math.max(2, 10 - ((avg - 100) / 10) * 0.8);
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
 * Title tag quality (max 7).
 * Checks <title> tag: keyword presence (+4) and optimal length 50-60 chars (+3, partial +1).
 * _kwPlacement already checks H1/H2 — this targets the <title> element specifically.
 * Returns null when no <title> tag is present (e.g. article body HTML) so the slot
 * is excluded from the denominator rather than permanently wasting 7 points.
 */
function _titleQuality(html: string, keyword: string): number | null {
   const kw = keyword.toLowerCase().trim();
   if (!kw) return null;
   const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
   if (!match) return null; // no <title> → skip slot entirely
   const title = match[1].replace(/<[^>]+>/g, '').trim();
   let score = 0;
   if (title.toLowerCase().includes(kw)) score += 4;
   const len = title.length;
   if (len >= 50 && len <= 60) score += 3;
   else if (len >= 40 && len <= 70) score += 1;
   return score; // max 7
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
): number {
   if (!scoreData?.terms?.length) return 0;

   // Slot accumulator: earned / possible, normalised to 100 at the end
   let earned = 0;
   let possible = 0;

   const add = (score: number, max: number) => {
      earned += Math.min(Math.max(score, 0), max);
      possible += max;
   };

   // ── Core signals (always present) ──
   add(Math.min(wordCount / Math.max(scoreData.words_target, 1), 1) * 20, 20);
   add(Math.min(headingCount / Math.max(scoreData.headings_target, 1), 1) * 10, 10);

   const totalWeight = scoreData.terms.reduce((s, t) => s + Math.max(t.target_count, 1), 0);
   const termsRatio = scoreData.terms.reduce((s, t) => {
      const actual = countOccurrences(plainText, t.term);
      return s + Math.min(actual / Math.max(t.target_count, 1), 1) * Math.max(t.target_count, 1);
   }, 0) / Math.max(totalWeight, 1);
   add(termsRatio * 25, 25);

   if (scoreData.paragraphs_target && paragraphCount !== undefined) {
      add(Math.min(paragraphCount / Math.max(scoreData.paragraphs_target, 1), 1) * 5, 5);
   }

   // ── HTML + keyword signals ──
   if (html && keyword) {
      add(_kwPlacement(html, keyword), 15);
      add(_readability(html), 10);
      add(_externalLinks(html), 5);
      const titleScore = _titleQuality(html, keyword);
      if (titleScore !== null) add(titleScore, 7);
      const metaScore = _metaDescQuality(html, keyword);
      if (metaScore !== null) add(metaScore, 5);
   }

   // ── HTML-only signals ──
   if (html) {
      const imgScore = _imageAltCoverage(html);
      if (imgScore !== null) add(imgScore, 4);
      add(_listUsage(html), 3);
   }

   // ── FAQ coverage ──
   if (html && scoreData.paa_questions?.length) {
      add(_faqCoverage(html, scoreData.paa_questions), 10);
   }

   // ── Keyword coverage ──
   if (keywordCoverage !== undefined && keywordCoverage.length > 0) {
      const coveredCount = keywordCoverage.filter((k) => k.is_covered).length;
      add((coveredCount / keywordCoverage.length) * 10, 10);
   }

   // Normalise to 100
   const raw = possible > 0 ? (earned / possible) * 100 : 0;

   // Internal links small bonus (max +3, within the 100 cap)
   let bonus = 0;
   if (internalLinksCount !== undefined && internalLinksCount > 0) {
      bonus = Math.min(3, internalLinksCount);
   }

   return Math.min(100, Math.round(raw + bonus));
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
