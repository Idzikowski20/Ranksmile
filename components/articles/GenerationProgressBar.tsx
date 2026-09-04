import React from 'react';
import ProgressPill, { phaseState, type ProgressStep } from '../common/ProgressPill';

/**
 * The three phases the sidecar reports while writing an article, read off its status line
 * — the same evidence rule as the AI Visibility bar, nothing invented:
 *   1. planning  — everything before the first "Writing section i/n"
 *   2. sections  — the "Writing section i/n" counter itself
 *   3. finishing — the "Checking links & images" status the sidecar posts after the write
 */
export function generationSteps(status: string): ProgressStep[] {
   const writing = /Writing section (\d+)\/(\d+)/.exec(status);
   const finishing = /Checking links/i.test(status);
   const planningDone = Boolean(writing) || finishing;
   return [
      {
         label: 'Planning the article',
         state: planningDone ? 'done' : 'active',
         detail: !planningDone && status ? status.replace(/…$/, '') : undefined,
      },
      {
         label: 'Writing sections',
         state: phaseState(planningDone, finishing),
         detail: writing ? `${writing[1]} / ${writing[2]} sections` : undefined,
      },
      {
         label: 'Checking links & images',
         state: finishing ? 'active' : 'idle',
      },
   ];
}

/**
 * Outline planning as the planner reports it: one call per section brief, counted as
 * they land. Before the first count the request is reading competitors and planning
 * the structure; a saved outline being read back has no count at all.
 */
export function outlineSteps(progress?: { done: number; total: number }, planningLabel?: string): ProgressStep[] {
   if (planningLabel) return [{ label: planningLabel, state: 'active' }];
   const briefing = Boolean(progress && progress.total > 0);
   return [
      { label: 'Reading competitors and planning the structure', state: briefing ? 'done' : 'active' },
      {
         label: 'Writing section briefs',
         state: briefing ? 'active' : 'idle',
         detail: briefing ? `${progress?.done} / ${progress?.total} sections` : undefined,
      },
   ];
}

type Props = {
   mode: 'outline' | 'article';
   /** The sidecar's status line (article). */
   status?: string;
   /** Overrides the outline label — reading a saved outline back is not planning one. */
   planningLabel?: string;
   /** Section briefs written so far (outline) — from the content-plan stream. */
   outlineProgress?: { done: number; total: number };
   rightReserve?: number;
};

/** Progress for planning an outline or writing an article, in the AI Visibility bar's shape. */
const GenerationProgressBar = ({ mode, status = '', planningLabel, outlineProgress, rightReserve }: Props) => {
   if (mode === 'outline') {
      return (
         <ProgressPill
            title="Planning your outline"
            steps={outlineSteps(outlineProgress, planningLabel)}
            ariaLabel="Outline progress details"
            rightReserve={rightReserve}
         />
      );
   }
   return (
      <ProgressPill
         title="Writing your article"
         steps={generationSteps(status)}
         ariaLabel="Article progress details"
         rightReserve={rightReserve}
         footer="You can leave this page — the article keeps writing in the background."
      />
   );
};

export default GenerationProgressBar;
