import React from 'react';
import { useEntrance } from '../../lib/motion/useEntrance';

// Auto-Optimize review bar — fixed bottom toolbar, copied 1:1 from the Surfer reference markup
// (uses the shared design-system tokens already defined in tailwind.config.js / globals.css).
//   - optimizing: spinner + "Processing section X of Y", nav disabled, Cancel only.
//   - reviewing:  "All sections processed", nav enabled, Cancel + Save.

export interface OptimizeReviewBarProps {
   state: 'optimizing' | 'reviewing';
   processed: number;
   total: number;
   /** Count of unresolved contentOptimizer sections (kept for caller compat). */
   remaining: number;
   /** Total changed sections (kept for caller compat). */
   changedCount: number;
   onPrev: () => void;
   onNext: () => void;
   /** Kept for caller compat — bulk accept now happens per-section, not from the bar. */
   onAcceptAll: () => void;
   onCancel: () => void;
   onSave: () => void;
   saving: boolean;
   /** Right-panel width reserved by the editor column, so the bar centres on the editor
    *  content (not the whole viewport). 0 when the panel is collapsed. */
   rightReserve?: number;
   /** Task 12: focus-derived status for the currently-streaming section (e.g. "Improving
    *  readability…"), from lib/optimizeMessaging.sectionStatusLabel. Shown as the subtitle
    *  while optimizing; ignored while reviewing. */
   activeStatusLabel?: string;
}

const ChevronUp = () => (
   <svg viewBox="0 0 20 20" width="1.2em" height="1.2em" className="inline-block shrink-0 align-sub text-inherit size-[20px]">
      <path fill="currentColor" fillRule="evenodd" d="M9.47 6.47a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 1 1-1.06 1.06L10 8.06l-3.72 3.72a.75.75 0 0 1-1.06-1.06z" clipRule="evenodd" />
   </svg>
);

const ChevronDown = () => (
   <svg viewBox="0 0 20 20" width="1.2em" height="1.2em" className="inline-block shrink-0 align-sub text-inherit size-[20px]">
      <path fill="currentColor" fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" />
   </svg>
);

const NAV_BASE = 'gap-sm relative inline-flex items-center justify-center border-none font-sans font-semibold transition-[color,background-color,box-shadow,opacity] text-md rounded-md bg-gray-10 text-gray-base p-xs';

const OptimizeReviewBar: React.FC<OptimizeReviewBarProps> = ({
   state,
   processed,
   total,
   onPrev,
   onNext,
   onCancel,
   onSave,
   saving,
   rightReserve = 0,
   activeStatusLabel,
}) => {
   const barEntranceRef = useEntrance<HTMLDivElement>({ y: 0 });
   const optimizing = state === 'optimizing';
   const navState = optimizing ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-gray-20 active:bg-gray-40';

   return (
      <div
         ref={barEntranceRef}
         className="bg-gray-base gap-base px-lg py-sm flex items-center justify-between rounded-xl"
         style={{
            position: 'fixed', bottom: 32,
            // Centre on the editor column (viewport minus the reserved right panel), width 5/6 of it.
            left: `calc((100vw - ${rightReserve}px) / 2)`, transform: 'translateX(-50%)',
            width: `min(calc((100vw - ${rightReserve}px) * 0.833), 1000px)`,
            zIndex: 10000,
            fontFamily: 'var(--font-family-primary)', boxShadow: '0 8px 40px rgba(0,0,0,0.45)',
         }}
      >
         <span className="text-md text-white-base font-semibold">Auto-Optimize</span>

         <div className="gap-lg flex items-center">
            <div className="flex flex-col items-center">
               <div className="gap-sm flex items-center">
                  {optimizing && (
                     <span
                        role="status" aria-label="Loading"
                        className="inline-block aspect-square animate-spin rounded-full"
                        style={{ width: 16, height: 16, border: '1.5px solid var(--white-base)', borderBottomColor: 'transparent' }}
                     />
                  )}
                  <span className="text-md text-white-base">
                     {optimizing ? `Processing section ${processed} of ${total}` : 'All sections processed'}
                  </span>
               </div>
               <span className="text-gray-60 text-sm">
                  {optimizing ? activeStatusLabel : 'Review each upgrade, then Save to apply'}
               </span>
            </div>

            <div className="gap-xs flex">
               <button type="button" aria-label="Previous suggestion" disabled={optimizing}
                  onClick={optimizing ? undefined : onPrev} className={`${NAV_BASE} ${navState}`}>
                  <ChevronUp />
               </button>
               <button type="button" aria-label="Next suggestion" disabled={optimizing}
                  onClick={optimizing ? undefined : onNext} className={`${NAV_BASE} ${navState}`}>
                  <ChevronDown />
               </button>
            </div>
         </div>

         <div className="gap-sm flex items-center">
            <button type="button" onClick={onCancel}
               className="gap-sm relative inline-flex cursor-pointer items-center justify-center border-none font-sans font-semibold transition-[color,background-color,box-shadow,opacity] text-md px-base py-xs rounded-md bg-gray-base text-white-base hover:bg-purple-base active:bg-purple-100">
               <span>Cancel</span>
            </button>
            {!optimizing && (
               <button type="button" onClick={onSave} disabled={saving}
                  className="gap-sm relative inline-flex cursor-pointer items-center justify-center border-none font-sans font-semibold transition-[color,background-color,box-shadow,opacity] text-md px-base py-xs rounded-md bg-gray-10 text-gray-base hover:bg-gray-20 active:bg-gray-40">
                  <span>{saving ? 'Saving…' : 'Save'}</span>
               </button>
            )}
         </div>
      </div>
   );
};

export default OptimizeReviewBar;
