import React, { useEffect, useRef } from 'react';
import type { AiVisScanStatus } from '../../services/aiVisibility';
import { ModelIcon } from './modelIcons';
import DomainFavicon from '../common/DomainFavicon';
import ProgressPill, { phaseState, type ProgressStep } from '../common/ProgressPill';

/**
 * Marks sit on the dark pill, so each gets its own opaque disc — the same treatment as the
 * engine badges elsewhere (bg-primary on border-primary). A translucent wash let the dark
 * surface through and every favicon read as half-faded.
 */
const MARK_BG = 'var(--koala-bg-primary)';
const MARK_BORDER = 'var(--koala-border-primary)';

type Step = ProgressStep & {
   /** Engines this step queries — an icon each, so the row names what it is working on. */
   models?: string[];
   /** The page the phase is on right now — one mark, not a trail. */
   domain?: string;
};

/**
 * The four phases the pipeline actually runs, each with the counter its own table can
 * prove — nothing here is fabricated:
 *   1. answers  — scan row's progress_done/total, i.e. (prompt × model) pairs
 *   2. sources  — ai_vis_sources rows fetched / queued
 *   3. brands   — answers still awaiting brand extraction
 *   4. profiles — ai_vis_brand_profiles rows written (the Competitors view)
 *
 * Phases 2–4 are drained by the sidecar AFTER the scan row flips to `completed`, so the
 * bar stays up past that point (see isScanBusy).
 */
function buildSteps(scan?: AiVisScanStatus): Step[] {
   const total = scan?.progressTotal ?? 0;
   const done = scan?.progressDone ?? 0;
   const sTotal = scan?.sourcesTotal ?? 0;
   const sRead = scan?.sourcesRead ?? 0;
   const brandsPending = scan?.brandsPending ?? 0;
   const profiles = scan?.profilesBuilt ?? 0;

   const answersIn = total > 0 && done >= total;
   // Each phase reports itself. They are listed in the order they matter to the reader, but
   // the sidecar drains all three on every tick, so they finish in whatever order their
   // work allows — chaining each on the previous one showed brand extraction and profiles
   // as untouched while they were provably complete and only the page fetching was left.
   //
   // Evidence, not absence of waiting: `*Done` is the phase's marker (or counts that prove
   // it). Reading the pending flag put a green tick on a phase that never ran, because
   // pending also goes false once the scan is too old to be worth polling.
   const sourcesIn = answersIn && (scan?.sourcesDone ?? false);
   const brandsIn = answersIn && brandsPending === 0;
   const profilesIn = answersIn && (scan?.profilesDone ?? false);

   // Reached once the answers are in: every follow-on phase starts then, together.
   const phase = phaseState;

   return [
      {
         label: 'Querying AI models',
         state: answersIn ? 'done' : 'active',
         detail: total > 0 ? `${done} / ${total} answers` : undefined,
         models: scan?.models ?? [],
      },
      {
         label: 'Reading sources',
         state: phase(answersIn, sourcesIn),
         // Name the page it just finished, not only the tally — a stalled phase is then
         // obvious from the host that stopped changing.
         detail: sTotal > 0
            ? [scan?.recentSourceDomains?.[0], `${sRead} / ${sTotal} sources`].filter(Boolean).join(' · ')
            : undefined,
         domain: scan?.recentSourceDomains?.[0],
      },
      {
         label: 'Extracting brand mentions',
         state: phase(answersIn, brandsIn),
         detail: brandsPending > 0 ? `${brandsPending} answers left` : undefined,
      },
      {
         label: 'Building brand profiles',
         state: phase(answersIn, profilesIn),
         detail: profiles > 0 ? `${profiles} brands` : undefined,
      },
   ];
}

/** True while any phase is still outstanding — including the ones that run after the scan
 *  row reports `completed`, which is when sources/brands/profiles are drained. */
export function isScanBusy(scan?: AiVisScanStatus): boolean {
   if (!scan || scan.status === 'idle' || scan.status === 'failed' || scan.status === 'cancelled') return false;
   if (scan.status === 'queued' || scan.status === 'running') return true;
   return buildSteps(scan).some((s) => s.state !== 'done');
}

/** Label of the phase currently feeding the panels, or null when nothing is outstanding. */
export function currentScanStage(scan?: AiVisScanStatus): string | null {
   if (!isScanBusy(scan)) return null;
   return buildSteps(scan).find((s) => s.state === 'active')?.label ?? null;
}

/** Overlapping marks, so a working step shows what it is working on rather than only a
 *  count. Decorative: the label and the count already say it in words. */
const MarkRow = ({ children }: { children: React.ReactNode }) => (
   <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
      {children}
   </span>
);

const MARK: React.CSSProperties = {
   width: 20,
   height: 20,
   marginRight: -5,
   borderRadius: 9999,
   background: MARK_BG,
   border: `1px solid ${MARK_BORDER}`,
   overflow: 'hidden',
   display: 'inline-flex',
   alignItems: 'center',
   justifyContent: 'center',
   flexShrink: 0,
};

const StepMarks = ({ step }: { step: Step }) => {
   if (step.models?.length) {
      return (
         <MarkRow>
            {step.models.map((m) => <span key={m} style={MARK}><ModelIcon model={m} size={12} /></span>)}
         </MarkRow>
      );
   }
   if (step.domain) {
      return (
         <MarkRow>
            <span style={MARK} title={step.domain}>
               <DomainFavicon domain={step.domain} size={12} alt={step.domain} />
            </span>
         </MarkRow>
      );
   }
   return null;
};

/**
 * Scan progress for AI Visibility.
 *
 * The scan itself runs server-side — the sidecar drives `run-chunk` until every
 * (prompt × model) pair is answered — so leaving the page does not stop it. The pill only
 * polls the scan record; that is what the footer line promises.
 */
const ScanProgressBar = ({ visible, scan }: { visible: boolean; scan?: AiVisScanStatus }) => {
   // One chime when the last phase drains. `wasBusy` starts false, so a page opened after
   // a scan already finished stays silent — the sound marks a transition, not a state.
   const wasBusy = useRef(false);
   const busy = isScanBusy(scan);
   useEffect(() => {
      if (busy) { wasBusy.current = true; return; }
      if (!wasBusy.current) return;
      wasBusy.current = false;
      // Browsers block audio without a prior gesture; the user started this scan, so there
      // usually is one. Nothing here may throw: the bar already says the scan is done.
      try {
         const audio = new Audio('/sounds/scan-complete.mp3');
         audio.volume = 0.5;
         // play() returns a promise in current browsers but undefined under jsdom and in
         // older ones — calling .catch() on that is a TypeError, in a component effect.
         const played: unknown = audio.play();
         if (played instanceof Promise) played.catch(() => {});
      } catch { /* no audio available */ }
   }, [busy]);

   if (!visible) return null;

   const steps = buildSteps(scan).map((s) => ({ ...s, marks: <StepMarks step={s} /> }));

   return (
      <ProgressPill
         title="Building your report"
         steps={steps}
         ariaLabel="Scan progress details"
         footer="You can leave this page — the scan keeps running in the background."
      />
   );
};

export default ScanProgressBar;
