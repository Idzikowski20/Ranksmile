import React, { useState } from 'react';
import CompetitorPicker from './CompetitorPicker';

const FONT = 'var(--font-family-primary)';

const ChevronDown = () => (
   <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path fill="currentColor" fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" />
   </svg>
);

const CheckDot = ({ on }: { on: boolean }) => (
   <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill={on ? '#18181B' : '#D4D4D8'} fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75s-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12m13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094z" clipRule="evenodd" />
   </svg>
);

const btn: React.CSSProperties = {
   display: 'inline-flex',
   alignItems: 'center',
   gap: 6,
   padding: '6px 12px',
   borderRadius: 8,
   border: '1px solid #E4E4E7',
   background: '#fff',
   fontSize: 14,
   fontWeight: 600,
   fontFamily: FONT,
   color: '#18181B',
   cursor: 'pointer',
};

/**
 * Shared header strip for every AI Visibility sub-page:
 * date pill (mock), All prompts / Compare / All models selectors.
 * When the page supplies compare props, the "Compare" slot becomes the real
 * competitor picker ("Compare" ⇄ "Comparing with {domain}"); otherwise it's a
 * static button (other sub-pages don't wire comparison yet).
 */
const AiVisibilityToolbar = ({ date = 'Jul 02, 2026', compareCompetitors, compareSelected = null, onCompareSelect }: {
   date?: string;
   compareCompetitors?: Array<{ domain: string }>;
   compareSelected?: string | null;
   onCompareSelect?: (d: string | null) => void;
}) => {
   const [modelsOpen, setModelsOpen] = useState(false);
   const compareInteractive = !!(compareCompetitors && compareCompetitors.length && onCompareSelect);
   return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTop: '1px solid #F4F4F5', paddingTop: 16, flexWrap: 'wrap' }}>
         <span style={{ ...btn, cursor: 'default' }}>
            <CheckDot on />
            <span>{date}</span>
         </span>
         <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button type="button" style={btn}>
               <span>All prompts</span>
               <ChevronDown />
            </button>
            {compareInteractive ? (
               <CompetitorPicker competitors={compareCompetitors as Array<{ domain: string }>} selected={compareSelected} onSelect={onCompareSelect as (d: string | null) => void} align="right" />
            ) : (
               <button type="button" style={btn}>
                  <span>Compare</span>
               </button>
            )}
            <div style={{ position: 'relative' }}>
               <button type="button" style={btn} onClick={() => setModelsOpen((o) => !o)}>
                  <CheckDot on={false} />
                  <span>All models</span>
                  <ChevronDown />
               </button>
               {modelsOpen && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, minWidth: 240, background: '#fff', borderRadius: 12, padding: 8, boxShadow: '0 18px 40px rgba(17,24,39,0.14), 0 8px 18px rgba(17,24,39,0.09)', zIndex: 150, fontFamily: FONT }}>
                     {['All models', 'AI Overviews', 'AI Mode', 'ChatGPT', 'Perplexity', 'Gemini'].map((m, i) => (
                        <button key={m} type="button" style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', border: 'none', background: 'transparent', borderRadius: 8, cursor: 'pointer', fontSize: 14, color: '#18181B', textAlign: 'left', fontFamily: FONT }} onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F4F5'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                           <span style={{ flex: 1 }}>{m}</span>
                           {i === 0 && <CheckDot on />}
                        </button>
                     ))}
                  </div>
               )}
            </div>
         </div>
      </div>
   );
};

export default AiVisibilityToolbar;
