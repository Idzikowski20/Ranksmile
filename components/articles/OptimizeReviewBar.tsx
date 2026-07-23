import React from 'react';
import { Button } from '../core';
import { useEntrance } from '../../lib/motion/useEntrance';
import GeneratingStage from './GeneratingStage';

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
   const progressPct = total > 0
      ? Math.min(100, Math.round((processed / total) * 100))
      : null;

   return (
      <div
         ref={barEntranceRef}
         className="bg-gray-base gap-base px-lg py-sm flex items-center justify-between rounded-xl"
         style={{
            position: 'fixed', bottom: 32,
            left: `calc((100vw - ${rightReserve}px) / 2)`, transform: 'translateX(-50%)',
            width: `min(calc((100vw - ${rightReserve}px) * 0.833), 1000px)`,
            zIndex: 10000,
            fontFamily: 'var(--font-family-primary)', boxShadow: '0 8px 40px rgba(0,0,0,0.45)',
         }}
      >
         <span className="text-md text-white-base font-semibold">Auto-Optimize</span>

         <div className="gap-lg flex items-center" style={{ flex: 1, justifyContent: 'center', minWidth: 0, padding: '0 12px' }}>
            {optimizing ? (
               <GeneratingStage
                  size="sm"
                  layout="inline"
                  dark
                  title={roundLabel}
                  status={activeStatusLabel ?? 'Optimizing article…'}
                  progressPct={progressPct}
                  showProgress
               />
            ) : (
               <div className="flex flex-col items-center">
                  <span className="text-md text-white-base">Article optimized</span>
                  <span className="text-gray-60 text-sm">Review changes, then Save to apply</span>
               </div>
            )}
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
