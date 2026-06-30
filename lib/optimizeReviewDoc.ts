import type { SectionEvent } from './optimizeSectionEvents';

/** Escape a value for safe interpolation into a double-quoted HTML attribute. */
const escAttr = (v: string | number): string =>
   String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Build the review-mode article HTML from ordered section events.
 *  Changed sections become a contentOptimizer atom div (carrying sectionId/index/status);
 *  unchanged sections are emitted verbatim. The FIRST changed section is 'active', the rest 'pending'. */
export function buildReviewDoc(events: SectionEvent[]): string {
   let firstChangedSeen = false;
   return events.map((e) => {
      if (!e.changed) return e.oldHtml;
      const status = firstChangedSeen ? 'pending' : 'active';
      firstChangedSeen = true;
      return `<div data-content-optimizer data-section-id="${escAttr(e.sectionId)}" data-index="${escAttr(e.index)}" data-status="${escAttr(status)}"></div>`;
   }).join('\n');
}
