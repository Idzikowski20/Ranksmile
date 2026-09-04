import React, { useState } from 'react';

/**
 * The dark progress pill: a compact bar pinned to the bottom of the content column that
 * reveals a phase timeline on hover, keyboard focus, or a click that pins it open.
 *
 * Presentation only. Each caller derives its steps from what its own pipeline can prove
 * (a counter, a marker) — nothing here invents progress.
 */
export type ProgressStepState = 'done' | 'active' | 'idle' | 'failed';
export type ProgressStep = {
   label: string;
   state: ProgressStepState;
   detail?: string;
   /** What the step is working on right now — engine icons, a favicon. Shown while active. */
   marks?: React.ReactNode;
};

/** A phase that has not been reached is idle; reached and complete is done; otherwise it is the live one. */
export function phaseState(reached: boolean, complete: boolean): ProgressStepState {
   if (!reached) return 'idle';
   return complete ? 'done' : 'active';
}

const FONT = 'var(--font-family-primary)';
const SURFACE = 'var(--koala-bg-inverse)';
const ON_SURFACE = 'var(--koala-text-on-inverse)';
const LIFT = '0 16px 48px rgba(0,0,0,0.28)';
/** Card radius from DESIGN.md — the pill matches the timeline above it. */
const RADIUS = 16;

/** Decorative: the pill's single status region announces the phase, so a spinner per step
 *  would have screen readers reading "Loading" several times at once.
 *  data-aiv-spin sits on this span because it is the element carrying the animation —
 *  `animation` does not inherit, so the reduced-motion rule must target it directly. */
const SPIN_CSS = '@keyframes aiv-spin { to { transform: rotate(360deg); } }'
   + ' @media (prefers-reduced-motion: reduce) { [data-aiv-spin] { animation: none !important; } }';

export const Spinner = ({ size = 20 }: { size?: number }) => (
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
         flexShrink: 0,
         animation: 'aiv-spin 0.8s linear infinite',
      }}
   >
      {/* The keyframes travel with the spinner: used outside the pill (the editor's
          auto-save chip), the animation had no definition and no reduced-motion rule. */}
      <style>{SPIN_CSS}</style>
   </span>
);

export const Check = ({ size = 20 }: { size?: number }) => (
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

const Failed = ({ size = 20 }: { size?: number }) => (
   <span
      aria-hidden="true"
      style={{
         width: size,
         height: size,
         borderRadius: '50%',
         background: 'var(--koala-status-danger)',
         color: 'var(--koala-text-on-brand)',
         display: 'inline-flex',
         alignItems: 'center',
         justifyContent: 'center',
         flexShrink: 0,
      }}
   >
      <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="none" aria-hidden="true">
         <path d="M12 7v6M12 16.5h.01" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
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

const StepIcon = ({ state }: { state: ProgressStepState }) => (
   // The marker is the only place a row's state is visible — it carries no text — so it
   // names that state for tests and for anything inspecting the timeline.
   <span data-pill-state={state} style={{ display: 'inline-flex', flexShrink: 0 }}>
      {state === 'done' ? <Check /> : null}
      {state === 'active' ? <Spinner /> : null}
      {state === 'failed' ? <Failed /> : null}
      {state === 'idle' ? <Pending /> : null}
   </span>
);

const StepRow = ({ step, last }: { step: ProgressStep; last: boolean }) => (
   <div style={{ display: 'flex', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20 }}>
         <StepIcon state={step.state} />
         {!last && <div aria-hidden="true" style={{ flex: 1, width: 1, minHeight: 8, margin: '4px 0', background: 'currentColor', opacity: 0.25 }} />}
      </div>
      <div style={{ minWidth: 0, flex: 1, paddingBottom: last ? 0 : 10 }}>
         <div style={{ display: 'flex', gap: 12, alignItems: 'center', minHeight: 20 }}>
            <span style={{ flexShrink: 0, fontSize: 14, fontWeight: 500, opacity: step.state === 'idle' ? 0.6 : 1 }}>
               {step.label}
            </span>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', paddingLeft: 4 }}>{step.state === 'active' ? step.marks : null}</span>
            {step.detail && (
               <span style={{ flexShrink: 0, fontSize: 12, opacity: 0.75, fontVariantNumeric: 'tabular-nums' }}>{step.detail}</span>
            )}
         </div>
      </div>
   </div>
);

export type ProgressPillProps = {
   title: string;
   steps: ProgressStep[];
   /** One line under the timeline — what leaving the page does to the work. */
   footer?: React.ReactNode;
   /** Chrome on the right (the editor's side panel) the pill centres away from. */
   rightReserve?: number;
   ariaLabel?: string;
   /** The run stopped: shown in place of the phase line, with the failed step marked. */
   error?: string;
   /** Controls the state needs — Retry, Cancel, Save. Siblings of the pill, never inside it. */
   actions?: Array<{ label: string; onClick: () => void; primary?: boolean; busy?: boolean }>;
   /** Replaces the spinner when the job is waiting on the reader rather than working. */
   leadIcon?: React.ReactNode;
};

const ProgressPill = ({
   title, steps, footer, rightReserve = 0, ariaLabel = 'Progress details', error, actions = [], leadIcon,
}: ProgressPillProps) => {
   const [hovered, setHovered] = useState(false);
   // Pinned wins over hover: reading the timeline while the pointer is elsewhere (or on a
   // touch screen, where there is no hover at all) needs the panel to stay put.
   const [pinned, setPinned] = useState(false);
   const open = pinned || hovered;

   const activeIndex = steps.findIndex((s) => s.state === 'active' || s.state === 'failed');
   const current = activeIndex >= 0 ? steps[activeIndex] : steps[steps.length - 1];
   const doneCount = steps.filter((s) => s.state === 'done').length;

   return (
      <div
         style={{
            position: 'fixed',
            left: 0,
            right: rightReserve,
            bottom: 24,
            zIndex: 200,
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
         }}
      >

         {/* Hover lives on the wrapper, not the pill: closing on the pill's mouseleave shut
             the timeline before the pointer could arrive. The 8px gap is padding inside the
             timeline's positioner rather than an offset, so the pointer never leaves the
             subtree on the way up. */}
         <div
            style={{ position: 'relative', pointerEvents: 'auto', width: `min(680px, calc(100vw - ${rightReserve}px - 48px))` }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
         >
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
                  aria-label={ariaLabel}
                  // Opacity hides it from the eye only: closed, the phase labels were
                  // still in the accessibility tree under an aria-expanded="false" pill.
                  aria-hidden={!open}
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
                  {footer && (
                     <div style={{ padding: '10px 20px', fontSize: 12, opacity: 0.75, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                        {footer}
                     </div>
                  )}
               </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
            <button
               type="button"
               onClick={() => setPinned((v) => !v)}
               onFocus={() => setHovered(true)}
               onBlur={() => setHovered(false)}
               aria-expanded={open}
               aria-pressed={pinned}
               title={pinned ? 'Unpin the phase timeline' : 'Pin the phase timeline open'}
               style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 20px',
                  borderRadius: RADIUS,
                  border: 'none',
                  background: SURFACE,
                  color: ON_SURFACE,
                  fontFamily: FONT,
                  textAlign: 'left',
                  cursor: 'pointer',
                  boxShadow: LIFT,
               }}
            >
               <span style={{ display: 'inline-flex', flexShrink: 0 }}>
                  {error ? <Failed size={24} /> : (leadIcon ?? <Spinner size={24} />)}
               </span>
               <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                     <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>{title}</span>
                     {/* A one-step run has no count worth stating. */}
                     {steps.length > 1 && (
                        <span style={{ fontSize: 12, opacity: 0.7, flexShrink: 0 }}>
                           {doneCount} of {steps.length} steps done
                        </span>
                     )}
                     <span style={{ flex: 1 }} />
                     <span style={{ fontSize: 12, opacity: 0.6, flexShrink: 0 }}>
                        {pinned ? 'Click to unpin' : 'Click to keep open'}
                     </span>
                  </span>
                  {/* The one live region: it names the phase, which is what actually changes. */}
                  <span
                     role="status"
                     aria-live="polite"
                     style={{ fontSize: 12, opacity: 0.75, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                     {error || `${current.label}${current.detail ? ` · ${current.detail}` : ''}`}
                  </span>
               </span>
            </button>
            {actions.map((a) => (
               <button
                  key={a.label}
                  type="button"
                  onClick={a.onClick}
                  disabled={a.busy}
                  style={{
                     flexShrink: 0,
                     padding: '0 18px',
                     borderRadius: RADIUS,
                     // Primary is the light pill on the dark row; secondary keeps the dark
                     // surface and an on-surface hairline, so Save always reads first.
                     border: a.primary ? 'none' : `1px solid color-mix(in srgb, ${ON_SURFACE} 35%, transparent)`,
                     background: a.primary ? ON_SURFACE : SURFACE,
                     color: a.primary ? SURFACE : ON_SURFACE,
                     fontFamily: FONT,
                     fontSize: 14,
                     fontWeight: 600,
                     cursor: a.busy ? 'progress' : 'pointer',
                     opacity: a.busy ? 0.7 : 1,
                     boxShadow: LIFT,
                  }}
               >
                  {a.label}
               </button>
            ))}
            </div>
         </div>
      </div>
   );
};

export default ProgressPill;
