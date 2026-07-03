import React from 'react';

const FONT = 'var(--font-family-primary)';
const favicon = (d: string) => `https://www.google.com/s2/favicons?domain=${d}&sz=32`;
type Ranked = { domain: string; overview: { visibilityScore: number } };

const CompetitorBarChart = ({ competitors, selected, onSelect }: { competitors: Ranked[]; selected: string | null; onSelect: (d: string) => void }) => {
   const shown = competitors.slice(0, 5);
   if (!shown.length) return <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#9F9FA9', fontFamily: FONT }}>No competitors cited yet.</div>;
   return (
      <div style={{ display: 'flex', height: 300, width: '100%' }}>
         {shown.map((c) => {
            const score = c.overview.visibilityScore; const isSel = c.domain === selected;
            return (
               <button key={c.domain} type="button" onClick={() => onSelect(c.domain)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 8, border: 'none', background: 'transparent', cursor: 'pointer' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#18181B', fontFamily: FONT }}>{score}</span>
                  <div style={{ width: 64, height: `${Math.max(2, score)}%`, borderRadius: '8px 8px 0 0', background: isSel ? '#783AFB' : '#C9B8FD', transition: 'background 150ms ease' }} />
                  <div style={{ height: 1, width: '100%', background: '#F4F4F5' }} />
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: '8px 0', maxWidth: '100%' }}>
                     { /* eslint-disable-next-line @next/next/no-img-element */ }
                     <img alt="" src={favicon(c.domain)} width={16} height={16} style={{ borderRadius: 3, flexShrink: 0 }} />
                     <span title={c.domain} style={{ fontSize: 12, color: '#52525C', fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.domain}</span>
                  </span>
               </button>
            );
         })}
      </div>
   );
};

export default CompetitorBarChart;
