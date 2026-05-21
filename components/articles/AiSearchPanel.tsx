import React from 'react';
import type { AiVisibilitySummary } from '../../lib/aiSearchScore';

type Props = {
   summary?: AiVisibilitySummary | null;
   onRun?: () => void;
   running?: boolean;
};

const AiSearchPanel = ({ summary, onRun, running = false }: Props) => {
   return (
      <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
         <button
            type="button"
            onClick={onRun}
            disabled={running || !onRun}
            style={{
               width: '100%',
               padding: '9px 12px',
               borderRadius: 6,
               border: 'none',
               background: '#18181b',
               color: '#fff',
               fontWeight: 600,
               fontFamily: 'var(--font-family-primary)',
               opacity: running || !onRun ? 0.7 : 1,
               cursor: running || !onRun ? 'not-allowed' : 'pointer',
            }}
         >
            {running ? 'Checking AI visibility...' : 'Run AI Search Check'}
         </button>
         {!summary || summary.prompts_total === 0 ? (
            <p style={{ margin: 0, color: '#9f9fa9', fontSize: 13, fontFamily: 'var(--font-family-primary)' }}>
               No AI Search evidence yet.
            </p>
         ) : (
            <>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13, fontFamily: 'var(--font-family-primary)' }}>
                  <div>Cited: <strong>{summary.prompts_cited}/{summary.prompts_total}</strong></div>
                  <div>Competitors: <strong>{summary.competitor_citations}</strong></div>
               </div>
               {summary.citations.map((citation, idx) => (
                  <div key={`${citation.prompt}-${idx}`} style={{ border: '1px solid #f4f4f5', borderRadius: 8, padding: 10 }}>
                     <div style={{ fontWeight: 600, fontSize: 13, color: '#18181b', fontFamily: 'var(--font-family-primary)' }}>{citation.prompt}</div>
                     <div style={{ color: citation.is_own_domain ? '#1ab25e' : '#9f9fa9', fontSize: 12, fontFamily: 'var(--font-family-primary)', marginTop: 4 }}>
                        {citation.cited_domain || 'No citation'}
                     </div>
                  </div>
               ))}
            </>
         )}
      </div>
   );
};

export default AiSearchPanel;
