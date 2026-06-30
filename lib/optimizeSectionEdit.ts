import type { ScoreData } from './contentScore';
import { countOccurrences } from './contentScore';

/** Strip HTML tags/entities to plain text for term counting. */
function toPlainText(html: string): string {
   return html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Article-wide missing/underused NLP terms, computed ONCE from `scoreData.terms`
 * vs the full article plain text. A term is reported when it is absent (0 hits)
 * or present below ~70% of its target count. No SERP/competitor scrape.
 */
export function computeMissingTerms(scoreData: ScoreData | undefined, articleHtml: string): string[] {
   if (!scoreData?.terms?.length) return [];
   const plainText = toPlainText(articleHtml);
   const out: string[] = [];
   for (const t of scoreData.terms) {
      const actual = countOccurrences(plainText, t.term);
      const min = Math.max(1, Math.round(t.target_count * 0.7));
      if (actual < min) out.push(t.term);
   }
   return out;
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

/** Charge the org token pool only when the run actually produced changes (and spent tokens).
 *  No changes ⇒ "We didn't find anything to improve — no credit deducted." */
export function shouldChargeCredit(changedCount: number, aiTokens: number): boolean {
   return changedCount > 0 && aiTokens > 0;
}
