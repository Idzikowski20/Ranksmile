import React from 'react';
import { Button } from '../koala/core';
import { useEntrance } from '../../lib/motion/useEntrance';

export interface OptimizeReviewBarProps {
   state: 'optimizing' | 'reviewing';
   processed: number;
   total: number;
   remaining: number;
   changedCount: number;
   onCancel: () => void;
   onSave: () => void;
   saving: boolean;
   rightReserve?: number;
   currentSection?: number;
   activeStatusLabel?: string;
}

const OptimizeReviewBar: React.FC<OptimizeReviewBarProps> = ({
   state,
   processed,
   total,
   onCancel,
   onSave,
   saving,
   rightReserve = 0,
   currentSection,
   activeStatusLabel,
}) => {
   const barEntranceRef = useEntrance<HTMLDivElement>({ y: 0 });
   const optimizing = state === 'optimizing';
   const roundLabel = total > 0
      ? `Processing round ${currentSection ?? Math.min(processed + 1, total)} of ${total}`
      : 'Preparing…';
   const statusLabel = activeStatusLabel ?? 'Optimizing article…';

   return (
      <div
         ref={barEntranceRef}
         className="bg-gray-base gap-base px-lg flex items-center justify-between rounded-xl"
         style={{
            position: 'fixed', bottom: 32,
            left: `calc((100vw - ${rightReserve}px) / 2)`, transform: 'translateX(-50%)',
            width: `min(calc((100vw - ${rightReserve}px) * 0.833), 1000px)`,
            zIndex: 10000,
            height: 52,
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
                     {optimizing ? roundLabel : 'Article optimized'}
                  </span>
               </div>
               <span
                  key={optimizing ? statusLabel : 'review'}
                  className="text-gray-60 text-sm"
                  style={optimizing ? { animation: 'aoBarFadeSlideIn 0.25s ease' } : undefined}
                  aria-live="polite"
               >
                  {optimizing ? statusLabel : 'Review changes, then Save to apply'}
               </span>
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
