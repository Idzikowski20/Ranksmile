import React from 'react';
import { Button } from '../core';
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
   /** 1-based index of the section currently being scanned (optimizing only). */
   currentSection?: number;
   /** Focus-derived status for the currently-streaming section. */
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
   currentSection,
   activeStatusLabel,
}) => {
   const barEntranceRef = useEntrance<HTMLDivElement>({ y: 0 });
   const optimizing = state === 'optimizing';

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
                     {optimizing
                        ? (total > 0 ? `Processing section ${currentSection ?? Math.min(processed + 1, total)} of ${total}` : 'Preparing…')
                        : 'All sections processed'}
                  </span>
               </div>
               <span className="text-gray-60 text-sm">
                  {optimizing ? (activeStatusLabel ?? 'Optimizing section…') : 'Review each upgrade, then Save to apply'}
               </span>
            </div>

            <div className="gap-xs flex">
               <Button
                  type="button"
                  variant="transparent"
                  size="sm"
                  aria-label="Previous suggestion"
                  disabled={optimizing}
                  onClick={optimizing ? undefined : onPrev}
                  icon={<ChevronUp />}
               />
               <Button
                  type="button"
                  variant="transparent"
                  size="sm"
                  aria-label="Next suggestion"
                  disabled={optimizing}
                  onClick={optimizing ? undefined : onNext}
                  icon={<ChevronDown />}
               />
            </div>
         </div>

         <div className="gap-sm flex items-center">
            <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
               Cancel
            </Button>
            {!optimizing && (
               <Button type="button" variant="primary" size="sm" onClick={onSave} disabled={saving} busy={saving}>
                  {saving ? 'Saving…' : 'Save'}
               </Button>
            )}
         </div>
      </div>
   );
};

export default OptimizeReviewBar;
