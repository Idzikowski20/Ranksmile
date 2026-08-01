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
         <circle cx="8" cy="8" r="8" fill="var(--koala-status-success)" />
         <path d="M4.5 8L7 10.5L11.5 6" stroke="var(--koala-text-on-brand)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
   );
}

function SpinnerIcon() {
   return (
      <span
         aria-hidden="true"
         style={{
            display: 'inline-block', width: 16, height: 16, flexShrink: 0,
            border: '2px solid var(--koala-border-primary)', borderTopColor: 'var(--koala-brand)', borderRadius: '9999px',
            animation: 'spin 0.7s linear infinite',
         }}
      />
   );
}

function HollowCircle() {
   return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
         <circle cx="8" cy="8" r="7" stroke="var(--koala-border-primary)" strokeWidth="1.5" />
      </svg>
   );
}

function StageGlyph({ state }: { state: StageState }) {
   if (state === 'done') return <CheckIcon />;
   if (state === 'running') return <SpinnerIcon />;
   return <HollowCircle />;
}

type Props = {
   stages: SetupStatus['stages'];
   status: SetupStatus['status'];
   error: string | null;
   onRetry: () => void;
};

const SetupPipeline: React.FC<Props> = ({ stages, status, error, onRetry }) => {
   const isFailed = status === 'failed';

   if (isFailed) {
      return (
         <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10" fill="var(--koala-status-danger)" />
                  <path d="M12 7.5v5.5M12 16.3h.01" stroke="var(--koala-text-on-brand)" strokeWidth="2" strokeLinecap="round" />
               </svg>
               <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--koala-text-primary)', fontFamily: 'var(--font-family-primary)' }}>
                  We couldn&apos;t finish analyzing your domain
               </span>
            </div>
            {error && (
               <span style={{ fontSize: 12.5, color: 'var(--koala-text-secondary)', fontFamily: 'var(--font-family-primary)', lineHeight: 1.5, wordBreak: 'break-word' }}>
                  {error}
               </span>
            )}
            <button
               type="button"
               onClick={onRetry}
               style={{
                  alignSelf: 'flex-start', padding: '8px 16px', borderRadius: 8, border: 'none',
                  background: 'var(--koala-btn-brand-bg)', color: 'var(--koala-btn-brand-fg)', fontSize: 13, fontWeight: 600,
                  fontFamily: 'var(--font-family-primary)', cursor: 'pointer', transition: 'background 150ms ease',
               }}
            >
               Retry
            </button>
         </div>
      );
   }

   return (
      <div style={{ width: '100%' }}>
         <p style={{
            fontSize: 15,
            fontWeight: 700,
            color: 'var(--koala-text-primary)',
            fontFamily: 'var(--font-family-primary)',
            margin: '0 0 20px',
         }}>
            Analyzing your domain…
         </p>

         <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {STAGE_ORDER.map((key) => {
               const state = stages[key];
               const isPending = state === 'pending';
               return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 24 }}>
                     <StageGlyph state={state} />
                     <span style={{
                        fontSize: 13,
                        fontWeight: isPending ? 400 : 600,
                        color: isPending ? 'var(--koala-text-secondary)' : 'var(--koala-text-primary)',
                        fontFamily: 'var(--font-family-primary)',
                        lineHeight: '20px',
                     }}>
                        {STAGE_LABELS[key]}
                     </span>
                  </div>
               );
            })}
         </div>
      </div>
   );
};

export default SetupPipeline;
