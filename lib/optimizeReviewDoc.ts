import type { SectionEvent } from './optimizeSectionEvents';

/** Build the review-mode article HTML from ordered section events.
 *  Changed sections become a contentOptimizer atom div (carrying sectionId/index/status);
 *  unchanged sections are emitted verbatim. The FIRST changed section is 'active', the rest 'pending'. */
export function buildReviewDoc(events: SectionEvent[]): string {
   let firstChangedSeen = false;
   return events.map((e) => {
      if (!e.changed) return e.oldHtml;
      const status = firstChangedSeen ? 'pending' : 'active';
      firstChangedSeen = true;
      return `<div data-content-optimizer data-section-id="${e.sectionId}" data-index="${e.index}" data-status="${status}"></div>`;
   }).join('\n');
}
