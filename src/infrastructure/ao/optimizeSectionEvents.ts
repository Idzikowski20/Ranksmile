import type { Section } from '@/src/infrastructure/articles/articleSections';
import { splitSections, normalizeHtmlForDiff } from '@/src/infrastructure/articles/articleSections';
import type { SectionResult } from '@/components/articles/optimizeStore';
import type { StepFocus, EditMode, PlanStep } from '@/src/infrastructure/ao/optimizationPlanner';

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

const FAQ_HEADING_HINT = /faq|najcz[eę]ściej zadawane pytania|frequently asked questions|pytania i odpowiedzi/i;

/** Infer review label focus from section content — never hardcode whole-doc ai-coverage. */
export function inferSectionDiffFocus(ev: {
   headingText: string;
   oldHtml: string;
   newHtml: string;
}): StepFocus {
   const head = `${ev.headingText}\n${ev.newHtml.slice(0, 400)}`;
   if (FAQ_HEADING_HINT.test(head)) return 'ai-coverage';
   if (!ev.oldHtml.trim() && ev.newHtml.trim()) return 'ai-coverage';
   return 'seo-terms';
}

/**
 * BEFORE/AFTER article → ordered SectionEvents for review (contentOptimizer + wordDiff).
 * Uses BEFORE section ids so the client can map onto splitSections(preHtml).
 * Extra AFTER sections (e.g. new FAQ H2) are appended as new changed events.
 * When meta.focus is omitted, each changed event gets a per-section inferred focus.
 */
export function buildArticleSectionDiffEvents(
   beforeHtml: string,
   afterHtml: string,
   meta?: SectionDiffMeta,
): SectionEvent[] {
   const before = splitSections(beforeHtml);
   const after = splitSections(afterHtml);

   // Pair by heading, not by index: one restored section shifts every later index, and
   // pairing by position then diffed each section against its neighbour and flagged
   // eight untouched sections as changed. The intro (no heading) pairs with the intro.
   const key = (s: Section) => s.headingText.replace(/\s+/g, ' ').trim().toLowerCase();
   const unusedBefore = [...before];
   const pairOf = new Map<Section, Section | undefined>();
   for (const a of after) {
      const i = unusedBefore.findIndex((b) => key(b) === key(a));
      pairOf.set(a, i >= 0 ? unusedBefore.splice(i, 1)[0] : undefined);
   }
   const removedAfterBefore = new Map<Section | null, Section[]>();
   for (const b of unusedBefore) {
      // A removed section is reported right after the nearest surviving predecessor.
      let anchor: Section | null = null;
      for (let i = b.index - 1; i >= 0; i -= 1) {
         if (!unusedBefore.includes(before[i])) { anchor = before[i]; break; }
      }
      removedAfterBefore.set(anchor, [...(removedAfterBefore.get(anchor) ?? []), b]);
   }

   const decorate = (base: Omit<SectionEvent, 'focus' | 'mode' | 'reason'>, mode: EditMode | undefined): SectionEvent => {
      const focus = meta?.focus ?? inferSectionDiffFocus(base);
      const resolvedMode = meta?.mode ?? mode;
      return {
         ...base,
         focus,
         ...(resolvedMode ? { mode: resolvedMode } : {}),
         ...(meta?.reason ? { reason: meta.reason } : {}),
      };
   };
   const removedEvent = (b: Section): SectionEvent => ({
      sectionId: b.id,
      index: b.index,
      headingText: b.headingText,
      oldHtml: b.html,
      newHtml: '',
      changed: true,
      focus: meta?.focus ?? 'seo-terms',
      ...(meta?.mode ? { mode: meta.mode } : {}),
      ...(meta?.reason ? { reason: meta.reason } : {}),
   });

   const events: SectionEvent[] = [];
   for (const b of removedAfterBefore.get(null) ?? []) events.push(removedEvent(b));
   for (const a of after) {
      const b = pairOf.get(a);
      if (b) {
         const changed = normalizeHtmlForDiff(b.html) !== normalizeHtmlForDiff(a.html);
         const base = {
            sectionId: b.id, index: b.index, headingText: b.headingText, oldHtml: b.html, newHtml: a.html, changed,
         };
         events.push(changed ? decorate(base, undefined) : base);
         if (changed && !meta?.mode) {
            const last = events[events.length - 1];
            last.mode = last.focus === 'ai-coverage' ? 'less' : 'normal';
         }
         for (const r of removedAfterBefore.get(b) ?? []) events.push(removedEvent(r));
      } else {
         events.push(decorate({
            sectionId: a.id, index: a.index, headingText: a.headingText, oldHtml: '', newHtml: a.html, changed: true,
         }, 'less'));
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
