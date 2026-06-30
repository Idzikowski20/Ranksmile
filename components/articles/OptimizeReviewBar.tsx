import React from 'react';

// AO-8a: fixed bottom dark toolbar driving the Auto-Optimize review lifecycle.
// Two states:
//   - optimizing: spinner + "Processing X of N…", nav controls present but disabled.
//   - reviewing:  remaining-count label + Accept all / Cancel / Save actions.
// Dark-shell aesthetic (design.md §11.1): bg #09090b, top border #221e28.

export interface OptimizeReviewBarProps {
   state: 'optimizing' | 'reviewing';
   processed: number;
   total: number;
   /** Count of unresolved contentOptimizer sections (reviewing state). */
   remaining: number;
   /** Total changed sections from the `done` event — denominator of the review label. */
   changedCount: number;
   onPrev: () => void;
   onNext: () => void;
   onAcceptAll: () => void;
   onCancel: () => void;
   onSave: () => void;
   saving: boolean;
}

const FONT = 'var(--font-family-primary)';

// Dark-shell vocabulary (design.md §2.1 / §11.2): raised surface #2F2F34, dark border #221e28,
// and white-alpha text tiers. Save base stays on the success token #1AB25E (darken via opacity,
// no off-doc hex). Avoid inventing zinc hexes.
const SURFACE_RAISED = '#2F2F34';
const SURFACE_HOVER = 'rgba(255,255,255,0.06)';
const BORDER_DARK = '#221e28';
const TEXT_STRONG = 'rgba(255,255,255,0.85)';
const TEXT_DEFAULT = 'rgba(255,255,255,0.7)';
const TEXT_MUTED = 'rgba(255,255,255,0.55)';
const TEXT_DISABLED = 'rgba(255,255,255,0.4)';
const SUCCESS = '#1AB25E';

const Spinner: React.FC = () => (
   <span
      aria-hidden="true"
      style={{
         width: 16,
         height: 16,
         border: '2px solid rgba(255,255,255,0.15)',
         borderTopColor: '#783AFB',
         borderRadius: '50%',
         animation: 'spin 0.7s linear infinite',
         flexShrink: 0,
         display: 'inline-block',
      }}
   />
);

const svgProps = {
   fill: 'none',
   stroke: 'currentColor',
   strokeWidth: 2,
   strokeLinecap: 'round',
   strokeLinejoin: 'round',
   'aria-hidden': true,
} as const;

const ChevronUp: React.FC = () => (
   <svg width={18} height={18} viewBox="0 0 24 24" {...svgProps}>
      <path d="m18 15-6-6-6 6" />
   </svg>
);

const ChevronDown: React.FC = () => (
   <svg width={18} height={18} viewBox="0 0 24 24" {...svgProps}>
      <path d="m6 9 6 6 6-6" />
   </svg>
);

const CheckIcon: React.FC = () => (
   <svg width={16} height={16} viewBox="0 0 24 24" {...svgProps} strokeWidth={2.5}>
      <path d="m4.5 12.75 6 6 9-13.5" />
   </svg>
);

const navBtnStyle = (disabled: boolean): React.CSSProperties => ({
   display: 'inline-flex',
   alignItems: 'center',
   justifyContent: 'center',
   width: 28,
   height: 28,
   borderRadius: 6,
   border: 'none',
   background: SURFACE_RAISED,
   color: disabled ? TEXT_DISABLED : TEXT_DEFAULT,
   cursor: disabled ? 'not-allowed' : 'pointer',
   opacity: disabled ? 0.5 : 1,
   transition: 'background 0.15s ease, color 0.15s ease',
   flexShrink: 0,
   padding: 0,
});

const statusTextStyle: React.CSSProperties = {
   fontSize: 13,
   color: TEXT_DEFAULT,
   fontFamily: FONT,
   whiteSpace: 'nowrap',
   overflow: 'hidden',
   textOverflow: 'ellipsis',
};

const acceptAllStyle: React.CSSProperties = {
   display: 'inline-flex',
   alignItems: 'center',
   gap: 6,
   fontSize: 13,
   fontWeight: 600,
   color: '#fff',
   background: '#2F2F34',
   border: 'none',
   borderRadius: 6,
   cursor: 'pointer',
   fontFamily: FONT,
   padding: '7px 14px',
   transition: 'background 0.15s ease',
};

const cancelStyle: React.CSSProperties = {
   fontSize: 13,
   fontWeight: 500,
   color: TEXT_MUTED,
   background: 'none',
   border: 'none',
   cursor: 'pointer',
   fontFamily: FONT,
   padding: '6px 10px',
   borderRadius: 6,
   transition: 'color 0.15s ease',
};

const OptimizeReviewBar: React.FC<OptimizeReviewBarProps> = ({
   state,
   processed,
   total,
   remaining,
   changedCount,
   onPrev,
   onNext,
   onAcceptAll,
   onCancel,
   onSave,
   saving,
}) => {
   const isOptimizing = state === 'optimizing';
   // Prev/next nav is only meaningful in reviewing state (disabled/greyed while optimizing).
   const navDisabled = isOptimizing;

   const reviewLabel = remaining === 0
      ? 'All sections reviewed'
      : `${remaining} of ${changedCount} section${changedCount === 1 ? '' : 's'} to review`;

   const saveStyle: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      fontSize: 13,
      fontWeight: 600,
      color: '#fff',
      background: SUCCESS,
      border: 'none',
      borderRadius: 6,
      cursor: saving ? 'wait' : 'pointer',
      fontFamily: FONT,
      padding: '7px 16px',
      opacity: saving ? 0.7 : 1,
      transition: 'opacity 0.15s ease',
      flexShrink: 0,
   };

   return (
      <div
         style={{
            position: 'fixed',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10000,
            minWidth: 560,
            maxWidth: 'calc(100vw - 40px)',
            background: '#09090b',
            border: '1px solid #221e28',
            borderRadius: 10,
            boxShadow: '0 8px 40px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 10px 0 16px',
            height: 52,
            gap: 12,
            fontFamily: FONT,
         }}
      >
         {/* ── Left: status ── */}
         <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden' }}>
            {isOptimizing ? (
               <>
                  <Spinner />
                  <span style={statusTextStyle}>{`Processing ${processed} of ${total}…`}</span>
               </>
            ) : (
               <>
                  <span
                     style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: remaining === 0 ? SUCCESS : '#783AFB',
                        flexShrink: 0,
                     }}
                  />
                  <span style={statusTextStyle}>{reviewLabel}</span>
               </>
            )}
         </div>

         <div style={{ width: 1, height: 18, background: BORDER_DARK, flexShrink: 0 }} />

         {/* ── Prev / next section nav (disabled while optimizing) ── */}
         <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
            <button
               type="button"
               aria-label="Previous section"
               disabled={navDisabled}
               onClick={navDisabled ? undefined : onPrev}
               style={navBtnStyle(navDisabled)}
               onMouseEnter={(e) => {
                  if (!navDisabled) { e.currentTarget.style.background = SURFACE_HOVER; e.currentTarget.style.color = TEXT_STRONG; }
               }}
               onMouseLeave={(e) => {
                  if (!navDisabled) { e.currentTarget.style.background = SURFACE_RAISED; e.currentTarget.style.color = TEXT_DEFAULT; }
               }}
            >
               <ChevronUp />
            </button>
            <button
               type="button"
               aria-label="Next section"
               disabled={navDisabled}
               onClick={navDisabled ? undefined : onNext}
               style={navBtnStyle(navDisabled)}
               onMouseEnter={(e) => {
                  if (!navDisabled) { e.currentTarget.style.background = SURFACE_HOVER; e.currentTarget.style.color = TEXT_STRONG; }
               }}
               onMouseLeave={(e) => {
                  if (!navDisabled) { e.currentTarget.style.background = SURFACE_RAISED; e.currentTarget.style.color = TEXT_DEFAULT; }
               }}
            >
               <ChevronDown />
            </button>
         </div>

         <div style={{ flex: 1 }} />

         {/* ── Right: review actions (reviewing state only) ── */}
         {!isOptimizing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
               {/* Accept all — resolves every remaining section to its optimized version. */}
               {remaining > 0 && (
                  <button
                     type="button"
                     onClick={onAcceptAll}
                     style={acceptAllStyle}
                     onMouseEnter={(e) => { e.currentTarget.style.background = '#783AFB'; }}
                     onMouseLeave={(e) => { e.currentTarget.style.background = '#2F2F34'; }}
                  >
                     <CheckIcon />
                     Accept all
                  </button>
               )}

               {/* Cancel — opens the discard-confirmation modal (ghost). */}
               <button
                  type="button"
                  onClick={onCancel}
                  style={cancelStyle}
                  onMouseEnter={(e) => { e.currentTarget.style.color = TEXT_STRONG; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = TEXT_MUTED; }}
               >
                  Cancel
               </button>

               {/* Save — persists the current doc + a version snapshot. Always enabled in
                   reviewing state (per-section Accept/Reject is optional; Save resolves any
                   remaining sections via Accept-all first, then persists). Disabled only
                   while a save is in flight. */}
               <button
                  type="button"
                  onClick={onSave}
                  disabled={saving}
                  style={saveStyle}
                  onMouseEnter={(e) => { if (!saving) e.currentTarget.style.opacity = '0.88'; }}
                  onMouseLeave={(e) => { if (!saving) e.currentTarget.style.opacity = '1'; }}
               >
                  {saving ? 'Saving…' : 'Save'}
               </button>
            </div>
         )}
      </div>
   );
};

export default OptimizeReviewBar;
