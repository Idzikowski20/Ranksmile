import React, { useMemo, useState } from 'react';
import { Button } from '../core';
import DomainFavicon from '../common/DomainFavicon';

const FONT = 'var(--font-family-primary)';

export type PromptRow = { id: number; text: string; visibility: number; mentionRate: number; avgPosition: number | null; brands: string[] };
export type TopicRow = { topic: string; promptCount: number; visibility: number; mentionRate: number; avgPosition: number | null; brands: string[]; prompts: PromptRow[] };
type SortKey = 'avgPosition' | 'mentionRate' | 'visibility';

const Chevron = ({ open }: { open: boolean }) => (
   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, color: '#71717B', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 150ms ease' }}><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const SortArrow = ({ dir }: { dir: 'asc' | 'desc' | null }) => (
   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ opacity: dir ? 1 : 0.45, transform: dir === 'asc' ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }}><path d="M12 5v14m0 0l-5-5m5 5l5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

const BrandStack = ({ brands }: { brands: string[] }) => {
   const shown = brands.slice(0, 3);
   if (!shown.length) return <span style={{ color: '#9F9FA9' }}>—</span>;
   return (
      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
         {shown.map((d, i) => (
            <span key={d} title={d} style={{ marginLeft: i ? -5 : 0, display: 'inline-flex' }}>
               <DomainFavicon domain={d} size={16} style={{ borderRadius: 9999, border: '1px solid #fff', background: '#fff' }} />
            </span>
         ))}
         {brands.length > 3 ? <span style={{ marginLeft: 6, fontSize: 13, color: '#71717B' }}>+{brands.length - 3}</span> : null}
      </span>
   );
};

const headCell: React.CSSProperties = { padding: '10px 16px', fontSize: 13, fontWeight: 500, color: '#71717B', fontFamily: FONT, borderLeft: '1px solid #F4F4F5', display: 'flex', alignItems: 'center', boxSizing: 'border-box' };
const bodyCell: React.CSSProperties = { padding: '12px 16px', fontSize: 14, fontFamily: FONT, borderLeft: '1px solid #F4F4F5', display: 'flex', alignItems: 'center', minHeight: 48, boxSizing: 'border-box', color: '#18181B' };
const rowStyle: React.CSSProperties = { display: 'flex', borderBottom: '1px solid #F4F4F5', background: '#fff', transition: 'background 100ms ease' };

const SortHead = ({ label, active, dir, onClick, bold }: { label: string; active: boolean; dir: 'asc' | 'desc'; onClick: () => void; bold?: boolean }) => (
   <Button type="button" variant="transparent" size="sm" onClick={onClick} style={{ gap: 4, fontWeight: bold || active ? 600 : 500, color: active ? '#18181B' : '#52525C' }}>
      {label} <SortArrow dir={active ? dir : null} />
   </Button>
);

const num = (v: number | null, suffix = '') => (v == null ? '—' : `${v}${suffix}`);

/** SurferSEO-style prompts table: topics as expandable parent rows over their prompts,
 *  with a brand favicon stack and sortable Avg pos / Mention rate / Visibility. */
const PromptTopicsTable = ({ topics }: { topics: TopicRow[] }) => {
   const [sort, setSort] = useState<SortKey>('visibility');
   const [dir, setDir] = useState<'asc' | 'desc'>('desc');
   const [open, setOpen] = useState<Set<string>>(new Set());

   const val = (o: { avgPosition: number | null; mentionRate: number; visibility: number }): number => (
      sort === 'avgPosition' ? (o.avgPosition ?? Infinity) : o[sort]
   );
   const sorted = useMemo(() => {
      const arr = [...topics];
      arr.sort((a, b) => (dir === 'asc' ? val(a) - val(b) : val(b) - val(a)));
      return arr;
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [topics, sort, dir]);
   const toggleSort = (k: SortKey, def: 'asc' | 'desc') => { if (sort === k) setDir((d) => (d === 'asc' ? 'desc' : 'asc')); else { setSort(k); setDir(def); } };
   const toggle = (t: string) => setOpen((prev) => { const n = new Set(prev); if (n.has(t)) n.delete(t); else n.add(t); return n; });

   if (!topics.length) {
      return <div style={{ border: '1px solid #DAD9DE', boxShadow: '0 4px 0 0 #e4e4e7', borderRadius: 12, padding: '48px 24px', textAlign: 'center', fontSize: 14, color: '#9F9FA9', fontFamily: FONT }}>No prompts yet.</div>;
   }

   const metricCells = (o: { avgPosition: number | null; mentionRate: number; visibility: number }, boldVis = false) => (
      <>
         <div style={{ ...bodyCell, width: 120, flexShrink: 0, justifyContent: 'flex-end' }}>{o.avgPosition != null ? o.avgPosition.toFixed(1) : '—'}</div>
         <div style={{ ...bodyCell, width: 140, flexShrink: 0, justifyContent: 'flex-end' }}>{num(o.mentionRate, '%')}</div>
         <div style={{ ...bodyCell, width: 120, flexShrink: 0, justifyContent: 'flex-end', fontWeight: boldVis ? 600 : 400 }}>{o.visibility}</div>
      </>
   );

   return (
      <div style={{ border: '1px solid #DAD9DE', boxShadow: '0 4px 0 0 #e4e4e7', borderRadius: 12, background: '#fff' }}>
         <div style={{ display: 'flex', borderBottom: '1px solid #F4F4F5' }}>
            <div style={{ ...headCell, borderLeft: 'none', flex: 1, minWidth: 0 }}>Topic</div>
            <div style={{ ...headCell, width: 110, flexShrink: 0 }}>Brands</div>
            <div style={{ ...headCell, width: 120, flexShrink: 0, justifyContent: 'flex-end' }}><SortHead label="Avg. pos." active={sort === 'avgPosition'} dir={dir} onClick={() => toggleSort('avgPosition', 'asc')} /></div>
            <div style={{ ...headCell, width: 140, flexShrink: 0, justifyContent: 'flex-end' }}><SortHead label="Mention rate" active={sort === 'mentionRate'} dir={dir} onClick={() => toggleSort('mentionRate', 'desc')} /></div>
            <div style={{ ...headCell, width: 120, flexShrink: 0, justifyContent: 'flex-end' }}><SortHead label="Visibility" active={sort === 'visibility'} dir={dir} onClick={() => toggleSort('visibility', 'desc')} bold /></div>
         </div>

         {sorted.map((t) => (
            <React.Fragment key={t.topic}>
               <div style={{ ...rowStyle, cursor: 'pointer' }} onClick={() => toggle(t.topic)} onMouseEnter={(e) => { e.currentTarget.style.background = '#FBFAFF'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') toggle(t.topic); }}>
                  <div style={{ ...bodyCell, borderLeft: 'none', flex: 1, minWidth: 0, gap: 8 }}>
                     <Chevron open={open.has(t.topic)} />
                     <span style={{ fontWeight: 600, color: '#18181B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.topic}</span>
                     <span style={{ color: '#9F9FA9', flexShrink: 0 }}>{t.promptCount} prompts</span>
                  </div>
                  <div style={{ ...bodyCell, width: 110, flexShrink: 0 }}><BrandStack brands={t.brands} /></div>
                  {metricCells(t, true)}
               </div>
               {open.has(t.topic) && t.prompts.map((p) => (
                  <div key={p.id} style={{ ...rowStyle, background: '#FCFCFD' }}>
                     <div style={{ ...bodyCell, borderLeft: 'none', flex: 1, minWidth: 0, paddingLeft: 48, color: '#3F3F47' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.text}</span>
                     </div>
                     <div style={{ ...bodyCell, width: 110, flexShrink: 0 }}><BrandStack brands={p.brands} /></div>
                     {metricCells(p)}
                  </div>
               ))}
            </React.Fragment>
         ))}
      </div>
   );
};

export default PromptTopicsTable;
