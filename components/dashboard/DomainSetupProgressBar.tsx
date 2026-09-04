import React from 'react';
import type { SetupStatus } from '../../services/domainPipeline';
import ProgressPill, { type ProgressStep } from '../common/ProgressPill';

type StageKey = keyof SetupStatus['stages'];

const STAGE_ORDER: StageKey[] = ['gsc', 'keywords', 'topics', 'competitors', 'recommendations'];

const STAGE_LABELS: Record<StageKey, string> = {
   gsc: 'Getting Search Console and site data',
   keywords: 'Extracting and expanding keywords',
   topics: 'Clustering and modeling topics',
   competitors: 'Analyzing competitors and coverage',
   recommendations: 'Getting and evaluating recommendations',
};

/**
 * The five stages the domain pipeline runs, straight off the job row: each stage's state
 * is what the sidecar reported for it, and the only detail shown is the running stage's
 * own progress figure — nothing is inferred from time or position.
 */
export function setupSteps(setup: SetupStatus): ProgressStep[] {
   return STAGE_ORDER.map((key) => {
      const state = setup.stages[key];
      const running = state === 'running';
      return {
         label: STAGE_LABELS[key],
         state: state === 'done' ? 'done' : running ? 'active' : 'idle',
         detail: running && setup.stagePercent > 0 && setup.stagePercent < 100 ? `${Math.round(setup.stagePercent)}%` : undefined,
      };
   });
}

/** True while the pill has something to show: the job is queued, running, or stopped. */
export function isSetupShown(setup?: SetupStatus): boolean {
   return setup?.status === 'queued' || setup?.status === 'running' || setup?.status === 'failed';
}

/**
 * Domain analysis after workspace setup, as a pinned pill instead of a card in the
 * Recommendations section. The job runs in the sidecar and the dashboard only polls it
 * (useSetupStatus), so the footer's promise holds. A failed run keeps the pill, marks the
 * stage it died in, and offers Retry — the one control the state needs.
 */
const DomainSetupProgressBar = ({ setup, onRetry }: { setup?: SetupStatus; onRetry: () => void }) => {
   if (!setup || !isSetupShown(setup)) return null;
   const steps = setupSteps(setup);
   if (setup.status === 'failed') {
      // The stage the job died in is the one still marked running on the row; a job that
      // never claimed a stage failed before the first.
      const at = Math.max(0, STAGE_ORDER.findIndex((k) => setup.stages[k] === 'running'));
      steps[at] = { ...steps[at], state: 'failed', detail: undefined };
      return (
         <ProgressPill
            title="We couldn't finish analyzing your domain"
            steps={steps}
            ariaLabel="Domain analysis details"
            error={setup.error || 'The analysis stopped before it finished.'}
            actions={[{ label: 'Retry', onClick: onRetry, primary: true }]}
         />
      );
   }
   // Queued: the sidecar has not claimed the job yet, so no stage is running. The first
   // stage is shown as the one being waited on, not as work in progress.
   if (!steps.some((s) => s.state === 'active')) steps[0] = { ...steps[0], state: 'active', detail: 'queued' };
   return (
      <ProgressPill
         title="Analyzing your domain"
         steps={steps}
         ariaLabel="Domain analysis details"
         footer="You can leave this page — the analysis keeps running in the background."
      />
   );
};

export default DomainSetupProgressBar;
