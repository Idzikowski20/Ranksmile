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

/** Remove markdown code fences the model occasionally wraps the section in, then trim. */
export function stripFences(raw: string): string {
   return raw.trim().replace(/^```html?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
}

/** A cleaned section edit is usable only if it is non-empty and not suspiciously short. */
export function isUsableEdit(cleaned: string): boolean {
   return cleaned.length >= 20;
}
