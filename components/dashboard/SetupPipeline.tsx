import React from 'react';
import type { StageState, SetupStatus } from '../../services/domainPipeline';

type StageKey = 'gsc' | 'keywords' | 'topics' | 'competitors' | 'recommendations';

const STAGE_ORDER: StageKey[] = ['gsc', 'keywords', 'topics', 'competitors', 'recommendations'];

const STAGE_LABELS: Record<StageKey, string> = {
   gsc: 'Getting Search Console and site data',
   keywords: 'Extracting and expanding keywords',
   topics: 'Clustering and modeling topics',
   competitors: 'Analyzing competitors and coverage',
   recommendations: 'Getting and evaluating recommendations',
};

function CheckIcon() {
   return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
         <circle cx="8" cy="8" r="8" fill="#1AB25E" />
         <path d="M4.5 8L7 10.5L11.5 6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
   );
}

function SpinnerIcon({ percent }: { percent: number }) {
   return (
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, flexShrink: 0, position: 'relative' }}>
         <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}
         >
            <circle cx="8" cy="8" r="6.5" stroke="#E4E4E7" strokeWidth="1.5" />
            <path d="M8 1.5A6.5 6.5 0 0 1 14.5 8" stroke="#783AFB" strokeWidth="1.5" strokeLinecap="round" />
         </svg>
         {percent > 0 && (
            <span style={{
               position: 'absolute',
               left: '50%',
               top: 'calc(100% + 2px)',
               transform: 'translateX(-50%)',
               fontSize: 9,
               color: '#783AFB',
               fontWeight: 700,
               fontFamily: 'var(--font-family-primary)',
               whiteSpace: 'nowrap',
               lineHeight: 1,
            }}>
               {percent}%
            </span>
         )}
      </span>
   );
}

function HollowCircle() {
   return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
         <circle cx="8" cy="8" r="7" stroke="#D4D4D8" strokeWidth="1.5" />
      </svg>
   );
}

function StageGlyph({ state, stagePercent }: { state: StageState; stagePercent: number }) {
   if (state === 'done') return <CheckIcon />;
   if (state === 'running') return <SpinnerIcon percent={stagePercent} />;
   return <HollowCircle />;
}

type Props = {
   stages: SetupStatus['stages'];
   stagePercent: number;
   status: SetupStatus['status'];
   error: string | null;
   onRetry: () => void;
};

const SetupPipeline: React.FC<Props> = ({ stages, stagePercent, status, error, onRetry }) => {
   const isFailed = status === 'failed';

   return (
      <div style={{ width: '100%' }}>
            <p style={{
               fontSize: 15,
               fontWeight: 700,
               color: '#18181B',
               fontFamily: 'var(--font-family-primary)',
               margin: '0 0 20px',
            }}>
               Analyzing your domain…
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
               {STAGE_ORDER.map((key) => {
                  const state = stages[key];
                  const isRunning = state === 'running';
                  const isPending = state === 'pending';
                  return (
                     <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 24 }}>
                        <StageGlyph state={state} stagePercent={isRunning ? stagePercent : 0} />
                        <span style={{
                           fontSize: 13,
                           fontWeight: isPending ? 400 : 600,
                           color: isPending ? '#52525C' : '#18181B',
                           fontFamily: 'var(--font-family-primary)',
                           lineHeight: '20px',
                        }}>
                           {STAGE_LABELS[key]}
                        </span>
                     </div>
                  );
               })}
            </div>

            {isFailed && (
               <div style={{ marginTop: 20, padding: 12, borderRadius: 8, background: 'rgba(255,111,119,0.07)', border: '1px solid rgba(255,111,119,0.2)' }}>
                  {error && (
                     <p style={{ fontSize: 12, color: '#FF6F77', fontFamily: 'var(--font-family-primary)', margin: '0 0 10px', lineHeight: 1.5 }}>
                        {error}
                     </p>
                  )}
                  <button
                     type="button"
                     onClick={onRetry}
                     style={{
                        padding: '6px 14px',
                        borderRadius: 6,
                        border: '1px solid #783AFB',
                        background: 'transparent',
                        color: '#783AFB',
                        fontSize: 12,
                        fontWeight: 600,
                        fontFamily: 'var(--font-family-primary)',
                        cursor: 'pointer',
                     }}
                  >
                     Retry
                  </button>
               </div>
            )}
      </div>
   );
};

export default SetupPipeline;
