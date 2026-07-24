import type { ScoreData } from './contentScore';
import { countOccurrences } from './contentScore';

/** Strip HTML tags/entities to plain text for term counting. */
function toPlainText(html: string): string {
   return html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

export type TermUsageStatus = 'missing' | 'low' | 'ok' | 'overuse';

/** Per-term usage vs target — shared by Auto-Optimize prompts and SEO gap lists. */
export type TermUsageGap = {
   term: string;
   current: number;
   target: number;
   status: TermUsageStatus;
};

/**
 * Article-wide NLP term usage vs targets (missing / low / ok / overuse).
 * Thresholds match get_content_score: min ≈ 70% of target, max ≈ 150%.
 */
export function computeTermUsageGaps(scoreData: ScoreData | undefined, articleHtml: string): TermUsageGap[] {
   if (!scoreData?.terms?.length) return [];
   const plainText = toPlainText(articleHtml);
   return scoreData.terms.map((t) => {
      const current = countOccurrences(plainText, t.term);
      const min = Math.max(1, Math.round(t.target_count * 0.7));
      const max = Math.round(t.target_count * 1.5);
      const status: TermUsageStatus =
         current === 0 ? 'missing' : current < min ? 'low' : current > max ? 'overuse' : 'ok';
      return { term: t.term, current, target: t.target_count, status };
   });
}

/**
 * Article-wide missing/underused NLP terms, computed ONCE from `scoreData.terms`
 * vs the full article plain text. A term is reported when it is absent (0 hits)
 * or present below ~70% of its target count. No SERP/competitor scrape.
 */
export function computeMissingTerms(scoreData: ScoreData | undefined, articleHtml: string): string[] {
   return computeTermUsageGaps(scoreData, articleHtml)
      .filter((g) => g.status === 'missing' || g.status === 'low')
      .map((g) => g.term);
}

/** Terms present above ~150% of target — candidates to rephrase / thin out. */
export function computeOverusedTerms(scoreData: ScoreData | undefined, articleHtml: string): string[] {
   return computeTermUsageGaps(scoreData, articleHtml)
      .filter((g) => g.status === 'overuse')
      .map((g) => g.term);
}

/** Remove markdown code fences the model occasionally wraps the section in, then trim.
 *  The opening fence's language tag is optional/generic (```, ```html, ```HTML, …). */
export function stripFences(raw: string): string {
   return raw.trim().replace(/^```[a-z]*\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
}

// Sections are split at <h2>, so a real section is comfortably longer than this;
// anything shorter is empty/garbage and should be skipped (keep the original).
const MIN_USABLE_LENGTH = 20;

/** A cleaned section edit is usable only if it is non-empty and not suspiciously short. */
export function isUsableEdit(cleaned: string): boolean {
   return cleaned.length >= MIN_USABLE_LENGTH;
}

/** Whole-article rewrites must be complete. A token-limited or half-length response would
 * replace the user's article during review/save, so keep the original instead. */
export function isUsableWholeArticleEdit(cleaned: string, originalHtml: string, finishReason?: unknown): boolean {
   if (!isUsableEdit(cleaned)) return false;
   if (finishReason === 'length') return false;
   return cleaned.length >= Math.max(MIN_USABLE_LENGTH, originalHtml.length * 0.5);
}

/** Charge the org token pool only when the run actually produced changes (and spent tokens).
 *  No changes ⇒ "We didn't find anything to improve — no credit deducted." */
export function shouldChargeCredit(changedCount: number, aiTokens: number): boolean {
   return changedCount > 0 && aiTokens > 0;
}

/** Why Auto-Optimize ended with zero (or some) HTML changes — client must not call every
 *  zero-change run "well-optimized" (e.g. truncated LLM rewrite from the #50 guard). */
export type OptimizeDoneOutcome = 'improved' | 'already_optimal' | 'no_usable_edit' | 'no_change';

export function resolveOptimizeDoneOutcome(opts: {
   changedCount: number;
   rejectedUnusable: number;
   initialSeo: number;
   initialAi: number;
   initialContent: number;
   targetSeo: number;
   targetAi: number;
   targetContent: number;
}): OptimizeDoneOutcome {
   if (opts.changedCount > 0) return 'improved';
   if (opts.rejectedUnusable > 0) return 'no_usable_edit';
   const already =
      opts.initialContent >= opts.targetContent
      || (opts.initialSeo >= opts.targetSeo && opts.initialAi >= opts.targetAi);
   return already ? 'already_optimal' : 'no_change';
}
