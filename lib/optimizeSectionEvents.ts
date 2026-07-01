import type { Section } from './articleSections';
import type { SectionResult } from '../components/articles/optimizeStore';
import type { StepFocus, EditMode, PlanStep } from './optimizationPlanner';

export type SectionEvent = {
   sectionId: string;
   index: number;
   headingText: string;
   oldHtml: string;
   newHtml: string;
   changed: boolean;
   focus?: StepFocus;
   mode?: EditMode;
   reason?: string;
};

/** One section + optional result → its SSE payload.
 *  When `result` is undefined the section passes through unchanged (oldHtml === newHtml, changed: false).
 *  When `step` is provided, its `focus`/`mode`/`reason` are copied onto the event verbatim (UX contract). */
export function buildSectionEvent(section: Section, result?: SectionResult, step?: PlanStep): SectionEvent {
   return {
      sectionId: section.id,
      index: section.index,
      headingText: section.headingText,
      oldHtml: result ? result.oldHtml : section.html,
      newHtml: result ? result.newHtml : section.html,
      changed: result ? result.changed : false,
      ...(step ? { focus: step.focus, mode: step.mode, reason: step.reason } : {}),
   };
}

/** Map split sections + a per-section results map → ordered section SSE payloads.
 *  Sections absent from `results` pass through unchanged (oldHtml === newHtml, changed: false). */
export function buildSectionEvents(sections: Section[], results: Map<string, SectionResult>): SectionEvent[] {
   return sections.map((s) => buildSectionEvent(s, results.get(s.id)));
}
