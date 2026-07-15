import React from 'react';
import DomainFavicon from '../common/DomainFavicon';

const FONT = 'var(--font-family-primary)';
// A bar may be an "outsider": the compared competitor ranked outside the top-5, shown
// as the last bar behind a dashed divider with its real rank (#N).
type Bar = { domain: string; overview: { visibilityScore: number }; rank?: number; outsider?: boolean };

const REGULAR_BAR = 'linear-gradient(to top, rgba(228,228,231,0.35), rgba(212,212,216,0.95))';
const COMPARED_BAR = 'linear-gradient(to top, rgba(242,153,100,0.35), rgba(242,153,100,0.85))';

const CompetitorBarChart = ({ competitors, selected, onSelect }: { competitors: Bar[]; selected: string | null; onSelect: (d: string) => void }) => {
   const shown = competitors.slice(0, 5);
   if (!shown.length) return <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#9F9FA9', fontFamily: FONT }}>No competitors cited yet.</div>;
   const max = Math.max(...shown.map((c) => c.overview.visibilityScore), 1);
   return (
      <div style={{ display: 'flex', height: 300, width: '100%', alignItems: 'flex-end' }}>
         {shown.map((c) => {
            const score = c.overview.visibilityScore;
            const isSel = c.domain === selected;
            return (
               <button
                  key={c.domain}
                  type="button"
                  onClick={() => onSelect(c.domain)}
                  style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, position: 'relative' }}
               >
                  {c.outsider ? (
                     <>
                        {/* Full-height dashed divider marking the compared competitor from outside the top-5. */}
                        <span aria-hidden style={{ position: 'absolute', top: 0, bottom: 0, left: 0, borderLeft: '1.5px dashed #C4C4CC' }} />
                        {c.rank ? <span style={{ position: 'absolute', top: 2, left: 8, fontSize: 12, fontWeight: 600, color: '#52525C', background: '#E4E4E7', borderRadius: 6, padding: '2px 7px', fontFamily: FONT }}>{`#${c.rank}`}</span> : null}
                     </>
                  ) : null}
                  <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 8, minHeight: 0 }}>
                     <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, background: '#18181B', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: FONT, lineHeight: '18px' }}>{score}</span>
                     <div style={{ width: 72, height: `${(score / max) * 82}%`, minHeight: 4, borderRadius: '10px 10px 0 0', background: isSel ? COMPARED_BAR : REGULAR_BAR, boxShadow: isSel ? '0 0 0 1px rgba(242,153,100,0.35)' : 'inset 0 0 0 1px rgba(212,212,216,0.6)', transition: 'height 200ms ease' }} />
                  </div>
                  <div style={{ height: 1, width: '100%', background: '#F4F4F5' }} />
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: '10px 0 0', maxWidth: '100%', padding: '0 8px' }}>
                     <DomainFavicon domain={c.domain} size={16} style={{ borderRadius: 3 }} />
                     <span title={c.domain} style={{ fontSize: 13, fontWeight: isSel ? 600 : 500, color: isSel ? '#18181B' : '#52525C', fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.domain}</span>
                  </span>
               </button>
            );
         })}
      </div>
   );
};

export default CompetitorBarChart;
