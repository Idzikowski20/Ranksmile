import React, { useState } from 'react';
import CompetitorPicker from './CompetitorPicker';
import PromptPicker, { PromptOption } from './PromptPicker';
import { ModelIcon, isKnownModel } from './modelIcons';

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

const Check = () => (
   <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path fill="currentColor" fillRule="evenodd" d="M16.705 4.153a.75.75 0 0 1 .142 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893l7.48-9.817a.75.75 0 0 1 1.05-.143" clipRule="evenodd" /></svg>
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
const AiVisibilityToolbar = ({ date = 'Jul 02, 2026', compareCompetitors, compareSelected = null, onCompareSelect, prompts, promptSelected, onPromptChange, models, modelSelected, onModelChange, modelLabel, trailing }: {
   date?: string;
   compareCompetitors?: Array<{ domain: string }>;
   compareSelected?: string | null;
   onCompareSelect?: (d: string | null) => void;
   prompts?: PromptOption[];
   promptSelected?: number[];
   onPromptChange?: (ids: number[]) => void;
   models?: string[]; // available model keys; makes "All models" a real multiselect
   modelSelected?: string[];
   onModelChange?: (m: string[]) => void;
   modelLabel?: Record<string, string>;
   trailing?: React.ReactNode;
}) => {
   const [modelsOpen, setModelsOpen] = useState(false);
   const compareInteractive = !!(compareCompetitors && compareCompetitors.length && onCompareSelect);
   const modelInteractive = !!(models && models.length && onModelChange);
   const modelSel = modelSelected || [];
   const modelLabelFor = (m: string): string => (modelLabel && modelLabel[m]) || m;
   let modelBtnLabel = 'All models';
   if (modelSel.length === 1) modelBtnLabel = modelLabelFor(modelSel[0]);
   else if (modelSel.length > 1) modelBtnLabel = `${modelSel.length} models`;
   const toggleModel = (m: string) => {
      const s = new Set(modelSel.length ? modelSel : (models || []));
      if (s.has(m)) s.delete(m); else s.add(m);
      const next = Array.from(s);
      (onModelChange as (x: string[]) => void)(next.length === 0 || next.length === (models || []).length ? [] : next);
   };
   return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTop: '1px solid #F4F4F5', paddingTop: 16, flexWrap: 'wrap' }}>
         <span style={{ ...btn, cursor: 'default' }}>
            <CheckDot on />
            <span>{date}</span>
         </span>
         <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {prompts && prompts.length ? (
               <PromptPicker prompts={prompts} selected={promptSelected} onChange={onPromptChange} />
            ) : (
               <button type="button" style={btn}>
                  <span>All prompts</span>
                  <ChevronDown />
               </button>
            )}
            {compareInteractive ? (
               <CompetitorPicker competitors={compareCompetitors as Array<{ domain: string }>} selected={compareSelected} onSelect={onCompareSelect as (d: string | null) => void} align="right" />
            ) : (
               <button type="button" style={btn}>
                  <span>Compare</span>
               </button>
            )}
            <div style={{ position: 'relative' }}>
               <button type="button" style={btn} onClick={() => setModelsOpen((o) => !o)}>
                  <span>{modelInteractive ? modelBtnLabel : 'All models'}</span>
                  <ChevronDown />
               </button>
               {modelsOpen && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, minWidth: 240, background: '#fff', borderRadius: 12, padding: 8, boxShadow: '0 18px 40px rgba(17,24,39,0.14), 0 8px 18px rgba(17,24,39,0.09)', zIndex: 150, fontFamily: FONT }}>
                     {modelInteractive ? (
                        <>
                           <button type="button" onClick={() => (onModelChange as (x: string[]) => void)([])} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', border: 'none', background: 'transparent', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#18181B', textAlign: 'left', fontFamily: FONT }} onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F4F5'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                              <span style={{ flex: 1 }}>All models</span>
                              {modelSel.length === 0 ? <span style={{ display: 'inline-flex', color: '#18181B' }}><Check /></span> : null}
                           </button>
                           {(models as string[]).map((m) => (
                              <button key={m} type="button" onClick={() => toggleModel(m)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', border: 'none', background: 'transparent', borderRadius: 8, cursor: 'pointer', fontSize: 14, color: '#18181B', textAlign: 'left', fontFamily: FONT }} onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F4F5'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                                 {isKnownModel(modelLabelFor(m)) ? <span style={{ display: 'inline-flex', color: '#18181B', flexShrink: 0 }}><ModelIcon model={modelLabelFor(m)} size={18} /></span> : null}
                                 <span style={{ flex: 1 }}>{modelLabelFor(m)}</span>
                                 {(modelSel.length ? modelSel.includes(m) : true) ? <span style={{ display: 'inline-flex', color: '#18181B' }}><Check /></span> : null}
                              </button>
                           ))}
                        </>
                     ) : (
                        ['All models', 'AI Overviews', 'AI Mode', 'ChatGPT', 'Perplexity', 'Gemini'].map((m, i) => (
                           <button key={m} type="button" style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', border: 'none', background: 'transparent', borderRadius: 8, cursor: 'pointer', fontSize: 14, color: '#18181B', textAlign: 'left', fontFamily: FONT }} onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F4F5'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                              {isKnownModel(m) ? <span style={{ display: 'inline-flex', color: '#18181B', flexShrink: 0 }}><ModelIcon model={m} size={18} /></span> : null}
                              <span style={{ flex: 1 }}>{m}</span>
                              {i === 0 && <span style={{ display: 'inline-flex', color: '#18181B' }}><Check /></span>}
                           </button>
                        ))
                     )}
                  </div>
               )}
            </div>
            {trailing}
         </div>
      </div>
   );
};

export default AiVisibilityToolbar;
