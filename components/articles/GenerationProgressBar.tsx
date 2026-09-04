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

type Props = {
   mode: 'outline' | 'article';
   /** The sidecar's status line (article) — unused for the outline, which reports nothing. */
   status?: string;
   /** Overrides the outline label — reading a saved outline back is not planning one. */
   planningLabel?: string;
   rightReserve?: number;
};

/** Progress for planning an outline or writing an article, in the AI Visibility bar's shape. */
const GenerationProgressBar = ({ mode, status = '', planningLabel, rightReserve }: Props) => {
   if (mode === 'outline') {
      // One call, no counters to show: the request returns the whole outline at once.
      return (
         <ProgressPill
            title="Planning your outline"
            steps={[{ label: planningLabel || 'Reading competitors and writing section briefs', state: 'active' }]}
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
