import type { Section } from './articleSections';
import { splitSections, normalizeHtmlForDiff } from './articleSections';
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

export type SectionDiffMeta = {
   focus?: StepFocus;
   mode?: EditMode;
   reason?: string;
};

/**
 * BEFORE/AFTER article → ordered SectionEvents for review (contentOptimizer + wordDiff).
 * Uses BEFORE section ids so the client can map onto splitSections(preHtml).
 * Extra AFTER sections (e.g. new FAQ H2) are appended as new changed events.
 */
export function buildArticleSectionDiffEvents(
   beforeHtml: string,
   afterHtml: string,
   meta?: SectionDiffMeta,
): SectionEvent[] {
   const before = splitSections(beforeHtml);
   const after = splitSections(afterHtml);
   const events: SectionEvent[] = [];
   const n = Math.max(before.length, after.length);

   for (let i = 0; i < n; i++) {
      const b = before[i];
      const a = after[i];
      if (b && a) {
         const changed = normalizeHtmlForDiff(b.html) !== normalizeHtmlForDiff(a.html);
         events.push({
            sectionId: b.id,
            index: b.index,
            headingText: b.headingText,
            oldHtml: b.html,
            newHtml: a.html,
            changed,
            ...(changed && meta ? meta : {}),
         });
      } else if (!b && a) {
         events.push({
            sectionId: a.id,
            index: a.index,
            headingText: a.headingText,
            oldHtml: '',
            newHtml: a.html,
            changed: true,
            ...(meta || {}),
         });
      } else if (b && !a) {
         events.push({
            sectionId: b.id,
            index: b.index,
            headingText: b.headingText,
            oldHtml: b.html,
            newHtml: '',
            changed: true,
            ...(meta || {}),
         });
      }
   }
   return events;
}

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
