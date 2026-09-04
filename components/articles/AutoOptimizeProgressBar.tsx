import React from 'react';
import ProgressPill, { Check, phaseState, type ProgressStep } from '../common/ProgressPill';

export type AutoOptimizeProgressProps = {
   state: 'optimizing' | 'reviewing';
   /** Rounds the run has reported (`progress` events) and the total it announced (`meta`). */
   processed: number;
   total: number;
   /** The run's own status line — "Round 3 — SEO 82 · AI 61". */
   status: string;
   /** Review: sections still carrying an unresolved change, and how many changed at all. */
   remaining: number;
   changedCount: number;
   saving: boolean;
   onCancel: () => void;
   onSave: () => void;
   rightReserve?: number;
};

/**
 * The three phases the optimize stream evidences: `meta` closes term enrichment,
 * `progress` rounds are the rewrite, `done` opens the review. Nothing is inferred.
 */
type StepInputs = Pick<AutoOptimizeProgressProps, 'state' | 'processed' | 'total' | 'status' | 'remaining' | 'changedCount'>;

export function optimizeSteps(p: StepInputs): ProgressStep[] {
   const reviewing = p.state === 'reviewing';
   const rewriting = p.total > 0;
   return [
      { label: 'Enriching terms', state: rewriting || reviewing ? 'done' : 'active' },
      {
         label: 'Rewriting sections',
         state: phaseState(rewriting || reviewing, reviewing),
         detail: rewriting && !reviewing ? `${p.processed} / ${p.total} rounds · ${p.status}` : undefined,
      },
      {
         label: 'Review changes',
         state: reviewing ? 'active' : 'idle',
         detail: reviewing ? `${p.remaining} of ${p.changedCount} sections left` : undefined,
      },
   ];
}

/** Auto-Optimize progress and review, in the same pill as every other long job. */
const AutoOptimizeProgressBar = (p: AutoOptimizeProgressProps) => {
   const reviewing = p.state === 'reviewing';
   return (
      <ProgressPill
         title="Auto-Optimize"
         steps={optimizeSteps(p)}
         ariaLabel="Auto-Optimize details"
         rightReserve={p.rightReserve}
         // The review is the reader's turn, not the machine's — a tick, not a spinner.
         leadIcon={reviewing ? <Check size={24} /> : undefined}
         footer={reviewing ? 'Review the changes in the article, then Save to apply them.' : undefined}
         actions={reviewing
            ? [
               { label: 'Cancel', onClick: p.onCancel },
               { label: p.saving ? 'Saving…' : 'Save', onClick: p.onSave, primary: true, busy: p.saving },
            ]
            : [{ label: 'Cancel', onClick: p.onCancel }]}
      />
   );
};

export default AutoOptimizeProgressBar;
