/** Per-changed-section word deltas + total words added across an Auto-Optimize run.
 *  Pure + presentation-free so the results panel can render without re-deriving counts. */

export type OptimizeAdjustment = { heading: string; wordDelta: number };
export type OptimizeStats = { wordsAdded: number; adjustments: OptimizeAdjustment[] };

/** Strip HTML tags/entities to plain text (same shape as optimizeSectionEdit's helper). */
function toPlainText(html: string): string {
   return html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

/** Word count of plain text — empty string counts as 0. */
function wordCount(html: string): number {
   const text = toPlainText(html);
   return text ? text.split(/\s+/).length : 0;
}

/**
 * Per-changed-section word deltas (newHtml vs oldHtml plain-text word counts) and the
 * total words added (sum of every delta, including shrinks, so the headline net is honest).
 */
export function computeOptimizeStats(
   changed: Array<{ headingText: string; oldHtml: string; newHtml: string }>,
): OptimizeStats {
   const adjustments: OptimizeAdjustment[] = changed.map((c) => ({
      heading: c.headingText,
      wordDelta: wordCount(c.newHtml) - wordCount(c.oldHtml),
   }));
   const wordsAdded = adjustments.reduce((sum, a) => sum + a.wordDelta, 0);
   return { wordsAdded, adjustments };
}
