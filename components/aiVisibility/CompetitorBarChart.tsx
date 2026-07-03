import React from 'react';

const FONT = 'var(--font-family-primary)';
const favicon = (d: string) => `https://www.google.com/s2/favicons?domain=${d}&sz=32`;
type Ranked = { domain: string; overview: { visibilityScore: number } };

const REGULAR_BAR = 'linear-gradient(to top, rgba(228,228,231,0.35), rgba(212,212,216,0.95))';
const COMPARED_BAR = 'linear-gradient(to top, rgba(120,58,251,0.35), rgba(120,58,251,0.85))';

const CompetitorBarChart = ({ competitors, selected, onSelect }: { competitors: Ranked[]; selected: string | null; onSelect: (d: string) => void }) => {
   const shown = competitors.slice(0, 5);
   if (!shown.length) return <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#9F9FA9', fontFamily: FONT }}>No competitors cited yet.</div>;
   // Scale bar heights to the tallest score so the ranking reads clearly; reserve
   // headroom (× 0.82) above the tallest bar for its value pill.
   const max = Math.max(...shown.map((c) => c.overview.visibilityScore), 1);
   return (
      <div style={{ display: 'flex', height: 300, width: '100%', alignItems: 'flex-end' }}>
         {shown.map((c) => {
            const score = c.overview.visibilityScore;
            const isSel = c.domain === selected;
            return (
               <button key={c.domain} type="button" onClick={() => onSelect(c.domain)} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}>
                  <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 8, minHeight: 0 }}>
                     <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, background: '#18181B', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: FONT, lineHeight: '18px' }}>{score}</span>
                     <div style={{ width: 72, height: `${(score / max) * 82}%`, minHeight: 4, borderRadius: '10px 10px 0 0', background: isSel ? COMPARED_BAR : REGULAR_BAR, boxShadow: isSel ? '0 0 0 1px rgba(120,58,251,0.35)' : 'inset 0 0 0 1px rgba(212,212,216,0.6)', transition: 'height 200ms ease' }} />
                  </div>
                  <div style={{ height: 1, width: '100%', background: '#F4F4F5' }} />
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: '10px 0 0', maxWidth: '100%', padding: '0 8px' }}>
                     { /* eslint-disable-next-line @next/next/no-img-element */ }
                     <img alt="" src={favicon(c.domain)} width={16} height={16} style={{ borderRadius: 3, flexShrink: 0 }} />
                     <span title={c.domain} style={{ fontSize: 13, fontWeight: isSel ? 600 : 500, color: isSel ? '#18181B' : '#52525C', fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.domain}</span>
                  </span>
               </button>
            );
         })}
      </div>
   );
};

export default CompetitorBarChart;
