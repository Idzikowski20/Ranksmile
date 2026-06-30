import type { Section } from './articleSections';
import type { SectionResult } from '../components/articles/optimizeStore';

export type SectionEvent = {
   sectionId: string;
   index: number;
   headingText: string;
   oldHtml: string;
   newHtml: string;
   changed: boolean;
};

/** Map split sections + a per-section results map → ordered section SSE payloads.
 *  Sections absent from `results` pass through unchanged (oldHtml === newHtml, changed: false). */
export function buildSectionEvents(sections: Section[], results: Map<string, SectionResult>): SectionEvent[] {
   return sections.map((s) => {
      const r = results.get(s.id);
      return {
         sectionId: s.id,
         index: s.index,
         headingText: s.headingText,
         oldHtml: r ? r.oldHtml : s.html,
         newHtml: r ? r.newHtml : s.html,
         changed: r ? r.changed : false,
      };
   });
}
