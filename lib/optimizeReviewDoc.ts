import { splitSections } from './articleSections';
import type { SectionEvent } from './optimizeSectionEvents';

/** Escape a value for safe interpolation into a double-quoted HTML attribute. */
const escAttr = (v: string | number): string =>
   String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export type OptimizerStatus = 'queued' | 'scanning' | 'pending' | 'active' | 'improved';

export const WHOLE_ARTICLE_ID = 'article-whole';

export function optimizerAtom(sectionId: string, index: number, status: OptimizerStatus): string {
   return `<div data-content-optimizer data-section-id="${escAttr(sectionId)}" data-index="${escAttr(index)}" data-status="${escAttr(status)}"></div>`;
}

/** Build the review-mode article HTML from ordered section events.
 *  Changed sections become a contentOptimizer atom div (carrying sectionId/index/status);
 *  unchanged sections are emitted verbatim. The FIRST changed section is 'active', the rest 'pending'. */
export function buildReviewDoc(events: SectionEvent[]): string {
   let firstChangedSeen = false;
   return events.map((e) => {
      if (!e.changed) return e.oldHtml;
      const status = firstChangedSeen ? 'pending' : 'active';
      firstChangedSeen = true;
      return optimizerAtom(e.sectionId, e.index, status);
   }).join('\n');
}

/** Live streaming doc: every section is a contentOptimizer node.
 *  - processed + unchanged → original HTML
 *  - processed + changed → improved (inline diff)
 *  - scanningSectionId → scanning (text shimmer)
 *  - rest → queued (dimmed) */
/** Review doc for whole-article AO — single contentOptimizer node. */
export function buildWholeArticleReviewDoc(status: OptimizerStatus): string {
   return optimizerAtom(WHOLE_ARTICLE_ID, 0, status);
}

export function buildStreamingDoc(preHtml: string, events: SectionEvent[], scanningSectionId: string | null): string {
   const sections = splitSections(preHtml);
   const eventMap = new Map(events.map((e) => [e.sectionId, e]));
   return sections.map((s) => {
      const ev = eventMap.get(s.id);
      if (ev) {
         if (!ev.changed) return ev.oldHtml;
         return optimizerAtom(s.id, s.index, 'improved');
      }
      if (s.id === scanningSectionId) return optimizerAtom(s.id, s.index, 'scanning');
      return optimizerAtom(s.id, s.index, 'queued');
   }).join('\n');
}
