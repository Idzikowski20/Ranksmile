import React, { useState } from 'react';
import type { AiVisScanStatus } from '../../services/aiVisibility';

const FONT = 'var(--font-family-primary)';
const SURFACE = 'var(--koala-bg-inverse)';
const ON_SURFACE = 'var(--koala-text-on-inverse)';
const LIFT = '0 16px 48px rgba(0,0,0,0.28)';

type StepState = 'done' | 'active' | 'idle';
type Step = { label: string; state: StepState; detail?: string };

/** Decorative: the pill's single status region announces the phase, so a spinner per step
 *  would have screen readers reading "Loading" several times at once.
 *  data-aiv-spin sits on this span because it is the element carrying the animation —
 *  `animation` does not inherit, so the reduced-motion rule must target it directly. */
const Spinner = ({ size = 20 }: { size?: number }) => (
   <span
      aria-hidden="true"
      data-aiv-spin
      style={{
         width: size,
         height: size,
         borderRadius: '50%',
         border: '2px solid currentColor',
         borderBottomColor: 'transparent',
         display: 'inline-block',
         animation: 'aiv-spin 0.8s linear infinite',
      }}
   />
);

const Check = ({ size = 20 }: { size?: number }) => (
   <span
      aria-hidden="true"
      style={{
         width: size,
         height: size,
         borderRadius: '50%',
         background: 'var(--koala-status-success)',
         color: 'var(--koala-text-on-brand)',
         display: 'inline-flex',
         alignItems: 'center',
         justifyContent: 'center',
         flexShrink: 0,
      }}
   >
      <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="none" aria-hidden="true">
         <path d="m4.5 12.75 6 6 9-13.5" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
   </span>
);

const Pending = ({ size = 20 }: { size?: number }) => (
   <span
      aria-hidden="true"
      style={{
         width: size,
         height: size,
         borderRadius: '50%',
         border: '2px solid currentColor',
         opacity: 0.35,
         display: 'inline-block',
         flexShrink: 0,
      }}
   />
);

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
   // Completion comes from the phase's own marker, not from its row count: a scan whose
   // answers cited nothing has zero sources, and one that named no brands has zero
   // profiles, and neither means the phase is still running.
   const sourcesIn = answersIn && !(scan?.sourcesPending ?? true);
   const brandsIn = sourcesIn && brandsPending === 0;
   const profilesIn = brandsIn && !(scan?.profilesPending ?? true);

   const phase = (reached: boolean, complete: boolean): StepState => (!reached ? 'idle' : complete ? 'done' : 'active');

   return [
      {
         label: 'Querying AI models',
         state: answersIn ? 'done' : 'active',
         detail: total > 0 ? `${done} / ${total} answers` : undefined,
      },
      {
         label: 'Reading sources',
         state: phase(answersIn, sourcesIn),
         detail: sTotal > 0 ? `${sRead} / ${sTotal} sources` : undefined,
      },
      {
         label: 'Extracting brand mentions',
         state: phase(sourcesIn, brandsIn),
         detail: brandsPending > 0 ? `${brandsPending} answers left` : undefined,
      },
      {
         label: 'Building brand profiles',
         state: phase(brandsIn, profilesIn),
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

const StepRow = ({ step, last }: { step: Step; last: boolean }) => (
   <div style={{ display: 'flex', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20 }}>
         {step.state === 'done' ? <Check /> : step.state === 'active' ? <Spinner /> : <Pending />}
         {!last && <div aria-hidden="true" style={{ flex: 1, width: 1, minHeight: 8, margin: '4px 0', background: 'currentColor', opacity: 0.25 }} />}
      </div>
      <div style={{ minWidth: 0, flex: 1, paddingBottom: last ? 0 : 10 }}>
         <div style={{ display: 'flex', gap: 12, alignItems: 'center', minHeight: 20 }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 500, opacity: step.state === 'idle' ? 0.6 : 1 }}>
               {step.label}
            </span>
            {step.detail && (
               <span style={{ flexShrink: 0, fontSize: 12, opacity: 0.75, fontVariantNumeric: 'tabular-nums' }}>{step.detail}</span>
            )}
         </div>
      </div>
   </div>
);

/**
 * Scan progress for AI Visibility: a compact pill pinned to the bottom of the content
 * column, which reveals the full phase timeline on hover or keyboard focus.
 *
 * The scan itself runs server-side — the sidecar drives `run-chunk` until every
 * (prompt × model) pair is answered — so leaving the page does not stop it. The pill only
 * polls the scan record; that is what the footer line promises.
 */
const ScanProgressBar = ({ visible, scan }: { visible: boolean; scan?: AiVisScanStatus }) => {
   const [open, setOpen] = useState(false);
   if (!visible) return null;

   const steps = buildSteps(scan);
   const activeIndex = steps.findIndex((s) => s.state === 'active');
   const current = activeIndex >= 0 ? steps[activeIndex] : steps[steps.length - 1];
   const doneCount = steps.filter((s) => s.state === 'done').length;
   const total = scan?.progressTotal ?? 0;
   const done = scan?.progressDone ?? 0;
   const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

   return (
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 24, zIndex: 200, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
         <style>{'@keyframes aiv-spin { to { transform: rotate(360deg); } } @media (prefers-reduced-motion: reduce) { [data-aiv-spin] { animation: none !important; } }'}</style>

         {/* Hover lives on the wrapper, not the pill: closing on the pill's mouseleave shut
             the timeline before the pointer could arrive. The 8px gap is padding inside the
             timeline's positioner rather than an offset, so the pointer never leaves the
             subtree on the way up. */}
         <div
            style={{ position: 'relative', pointerEvents: 'auto', width: 'min(680px, calc(100vw - 48px))' }}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
         >
            {/* Timeline, above the pill */}
            <div
               style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  right: 0,
                  paddingBottom: 8,
                  pointerEvents: open ? 'auto' : 'none',
               }}
            >
            <div
               role="region"
               aria-label="Scan progress details"
               style={{
                  borderRadius: 16,
                  background: SURFACE,
                  color: ON_SURFACE,
                  boxShadow: LIFT,
                  fontFamily: FONT,
                  overflow: 'hidden',
                  opacity: open ? 1 : 0,
                  transform: open ? 'translateY(0)' : 'translateY(4px)',
                  transition: 'opacity 150ms ease, transform 150ms ease',
               }}
            >
               <div style={{ padding: 20 }}>
                  {steps.map((s, i) => <StepRow key={s.label} step={s} last={i === steps.length - 1} />)}
               </div>
               <div style={{ padding: '10px 20px', fontSize: 12, opacity: 0.75, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                  You can leave this page — the scan keeps running in the background.
               </div>
            </div>
            </div>

            {/* Collapsed pill */}
            <button
               type="button"
               onFocus={() => setOpen(true)}
               onBlur={() => setOpen(false)}
               aria-expanded={open}
               style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 20px',
                  borderRadius: 999,
                  border: 'none',
                  background: SURFACE,
                  color: ON_SURFACE,
                  fontFamily: FONT,
                  textAlign: 'left',
                  cursor: 'default',
                  boxShadow: LIFT,
               }}
            >
               <span style={{ display: 'inline-flex', flexShrink: 0 }}><Spinner size={24} /></span>
               <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                     <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>
                        Building your report
                     </span>
                     <span style={{ fontSize: 12, opacity: 0.7, flexShrink: 0 }}>
                        {doneCount} of {steps.length} steps done
                     </span>
                  </span>
                  {/* The one live region: it names the phase, which is what actually changes. */}
                  <span
                     role="status"
                     aria-live="polite"
                     style={{ fontSize: 12, opacity: 0.75, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                     {current.label}{current.detail ? ` · ${current.detail}` : ''}
                  </span>
                  <span aria-hidden="true" style={{ display: 'block', height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.18)', overflow: 'hidden' }}>
                     <span style={{ display: 'block', height: '100%', width: `${pct}%`, borderRadius: 999, background: 'var(--koala-status-success)', transition: 'width 300ms ease-out' }} />
                  </span>
               </span>
            </button>
         </div>
      </div>
   );
};

export default ScanProgressBar;
