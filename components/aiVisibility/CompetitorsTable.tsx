import React, { useMemo, useState } from 'react';
import { Button } from '../core';
import DomainFavicon from '../common/DomainFavicon';

const FONT = 'var(--font-family-primary)';

export type CompetitorRow = { domain: string; visibilityScore: number; mentionRate: number; avgPosition: number | null };
type SortKey = 'avgPosition' | 'mentionRate' | 'visibilityScore';

const SortArrow = ({ dir }: { dir: 'asc' | 'desc' | null }) => (
   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ opacity: dir ? 1 : 0.45, transform: dir === 'asc' ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }}><path d="M12 5v14m0 0l-5-5m5 5l5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const OpenDetailsIcon = () => (
   <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M13 17H16.75C17.99 17 19 15.99 19 14.75V5.25C19 4.01 17.99 3 16.75 3H13V17Z" fill="currentColor" /><path d="M11 3.5V16.5H3.25C2.28 16.5 1.5 15.72 1.5 14.75V5.25C1.5 4.28 2.28 3.5 3.25 3.5H11Z" stroke="currentColor" /></svg>
);

const headCell: React.CSSProperties = { padding: '10px 16px', fontSize: 13, fontWeight: 500, color: '#71717B', fontFamily: FONT, borderLeft: '1px solid #F4F4F5', display: 'flex', alignItems: 'center', boxSizing: 'border-box' };
const bodyCell: React.CSSProperties = { padding: '12px 16px', fontSize: 14, fontFamily: FONT, borderLeft: '1px solid #F4F4F5', display: 'flex', alignItems: 'center', minHeight: 48, boxSizing: 'border-box', color: '#18181B' };
const rowStyle: React.CSSProperties = { display: 'flex', borderBottom: '1px solid #F4F4F5', cursor: 'pointer', background: '#fff', transition: 'background 100ms ease' };

const SortHead = ({ label, active, dir, onClick, bold }: { label: string; active: boolean; dir: 'asc' | 'desc'; onClick: () => void; bold?: boolean }) => (
   <Button type="button" variant="transparent" size="sm" onClick={onClick} style={{ gap: 4, fontWeight: bold || active ? 600 : 500, color: active ? '#18181B' : '#52525C' }}>
      {label} <SortArrow dir={active ? dir : null} />
   </Button>
);

const setOpenIcon = (el: HTMLElement, on: boolean) => { const ic = el.querySelector('[data-open]') as HTMLElement | null; if (ic) ic.style.opacity = on ? '1' : '0'; };
const hoverOn = (e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.background = '#FBFAFF'; setOpenIcon(e.currentTarget, true); };
const hoverOff = (e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.background = '#fff'; setOpenIcon(e.currentTarget, false); };

const PAGE = 50;

/** Ranksmile competitor ranking: fill-bar (∝ visibility) behind favicon+name, then
 *  Avg. pos / Mention rate / Visibility score. Row click opens the detail modal. */
const CompetitorsTable = ({ competitors, onSelect }: { competitors: CompetitorRow[]; onSelect: (domain: string) => void }) => {
   const [sort, setSort] = useState<SortKey>('visibilityScore');
   const [dir, setDir] = useState<'asc' | 'desc'>('desc');
   const [visible, setVisible] = useState(PAGE);

   const sorted = useMemo(() => {
      const arr = [...competitors];
      arr.sort((a, b) => {
         const av = sort === 'avgPosition' ? (a.avgPosition ?? Infinity) : a[sort];
         const bv = sort === 'avgPosition' ? (b.avgPosition ?? Infinity) : b[sort];
         return dir === 'asc' ? av - bv : bv - av;
      });
      return arr;
   }, [competitors, sort, dir]);

   const maxVis = useMemo(() => Math.max(1, ...competitors.map((c) => c.visibilityScore)), [competitors]);
   const toggle = (k: SortKey, def: 'asc' | 'desc') => { if (sort === k) setDir((d) => (d === 'asc' ? 'desc' : 'asc')); else { setSort(k); setDir(def); } };

   if (!competitors.length) {
      return <div style={{ border: '1px solid #DAD9DE', boxShadow: '0 4px 0 0 #e4e4e7', borderRadius: 12, padding: '48px 24px', textAlign: 'center', fontSize: 14, color: '#9F9FA9', fontFamily: FONT }}>No competitors found in this scan.</div>;
   }

   return (
      <div style={{ border: '1px solid #DAD9DE', boxShadow: '0 4px 0 0 #e4e4e7', borderRadius: 12, background: '#fff' }}>
         <div style={{ display: 'flex', borderBottom: '1px solid #F4F4F5' }}>
            <div style={{ ...headCell, borderLeft: 'none', flex: 1, minWidth: 0 }}>Competitor</div>
            <div style={{ ...headCell, width: 120, flexShrink: 0, justifyContent: 'flex-end' }}><SortHead label="Avg. pos." active={sort === 'avgPosition'} dir={dir} onClick={() => toggle('avgPosition', 'asc')} /></div>
            <div style={{ ...headCell, width: 140, flexShrink: 0, justifyContent: 'flex-end' }}><SortHead label="Mention rate" active={sort === 'mentionRate'} dir={dir} onClick={() => toggle('mentionRate', 'desc')} /></div>
            <div style={{ ...headCell, width: 160, flexShrink: 0, justifyContent: 'flex-end' }}><SortHead label="Visibility score" active={sort === 'visibilityScore'} dir={dir} onClick={() => toggle('visibilityScore', 'desc')} bold /></div>
         </div>

         {sorted.slice(0, visible).map((c) => (
            <div key={c.domain} style={rowStyle} onClick={() => onSelect(c.domain)} onMouseEnter={hoverOn} onMouseLeave={hoverOff} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onSelect(c.domain); }}>
               <div style={{ ...bodyCell, borderLeft: 'none', flex: 1, minWidth: 0, position: 'relative', gap: 8, justifyContent: 'space-between' }}>
                  <div aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(c.visibilityScore / maxVis) * 100}%`, background: 'linear-gradient(to right, rgba(244,244,245,0), #F0F0F2)', pointerEvents: 'none' }} />
                  <span style={{ zIndex: 1, display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                     <DomainFavicon domain={c.domain} size={20} />
                     <span style={{ fontWeight: 500, color: '#18181B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.domain}</span>
                  </span>
                  <span data-open style={{ zIndex: 1, opacity: 0, transition: 'opacity 120ms ease', color: '#71717B', display: 'inline-flex', flexShrink: 0 }}><OpenDetailsIcon /></span>
               </div>
               <div style={{ ...bodyCell, width: 120, flexShrink: 0, justifyContent: 'flex-end' }}>{c.avgPosition != null ? c.avgPosition.toFixed(1) : '—'}</div>
               <div style={{ ...bodyCell, width: 140, flexShrink: 0, justifyContent: 'flex-end' }}>{c.mentionRate}%</div>
               <div style={{ ...bodyCell, width: 160, flexShrink: 0, justifyContent: 'flex-end', fontWeight: 600 }}>{c.visibilityScore}</div>
            </div>
         ))}

         {sorted.length > visible && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 12 }}>
               <Button type="button" variant="secondary" size="sm" onClick={() => setVisible((v) => v + 100)}>
                  Show more ({sorted.length - visible} left)
               </Button>
            </div>
         )}
      </div>
   );
};

export default CompetitorsTable;
