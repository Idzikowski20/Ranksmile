import React, { useMemo, useState, useEffect } from 'react';
import { Checkbox, SearchBar, SortableHeader } from '../core';
import { XIcon } from '../core';
import { useSortState } from '../../lib/useSortState';
import EmptyEyes from '../common/EmptyEyes';

const font = 'var(--font-family-primary)';

export type AvailablePage = { path: string; clicks: number; impressions: number };

type SortKey = 'path' | 'clicks' | 'impressions';

const fmt = (n: number): string => {
   if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
   if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
   return String(n);
};

// Page limit used for the "X available" usage bar (mock).
const PAGE_LIMIT = 200;

const InfoIcon = () => (
   <svg viewBox="0 0 20 20" width="16" height="16" style={{ flexShrink: 0, color: '#3F3F47' }}>
      <path fill="currentColor" fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0a8 8 0 0 1 16 0m-7-4a1 1 0 1 1-2 0a1 1 0 0 1 2 0M9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9z" clipRule="evenodd" />
   </svg>
);

const AddPagesModal = ({ pages, onClose, onAdd }: {
   pages: AvailablePage[];
   onClose: () => void;
   onAdd: (paths: string[]) => void;
}) => {
   const [search, setSearch] = useState('');
   const [selected, setSelected] = useState<Set<string>>(new Set());
   const { sortKey, sortDir, handleSort } = useSortState<SortKey>('clicks');

   // Slide-in / slide-out animation (right-docked panel).
   const [visible, setVisible] = useState(false);
   useEffect(() => {
      const t = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(t);
   }, []);
   const requestClose = () => { setVisible(false); setTimeout(onClose, 220); };

   const filtered = useMemo(() => {
      let out = pages;
      const q = search.trim().toLowerCase();
      if (q) out = out.filter((p) => p.path.toLowerCase().includes(q));
      return [...out].sort((a, b) => {
         if (sortKey === 'path') {
            return sortDir === 'desc' ? b.path.localeCompare(a.path) : a.path.localeCompare(b.path);
         }
         const va = a.clicks;
         const vb = b.clicks;
         if (sortKey === 'impressions') {
            return sortDir === 'desc' ? b.impressions - a.impressions : a.impressions - b.impressions;
         }
         return sortDir === 'desc' ? vb - va : va - vb;
      });
   }, [pages, search, sortKey, sortDir]);

   const available = pages.length;
   const barWidth = Math.min(100, Math.round((available / PAGE_LIMIT) * 100));
   const allSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.path));

   const toggle = (path: string) => setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(path)) n.delete(path); else n.add(path);
      return n;
   });
   const toggleAll = () => setSelected(allSelected ? new Set() : new Set(filtered.map((p) => p.path)));
   const selectAll = () => setSelected(new Set(filtered.map((p) => p.path)));

   return (
      <>
         <div onClick={requestClose} style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.4)', opacity: visible ? 1 : 0, transition: 'opacity 220ms ease' }} />
         <div
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 501, width: 600, maxWidth: 'calc(100vw - 32px)', background: '#fff', borderRadius: '16px 0 0 16px', boxShadow: '0px 24px 64px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', overflow: 'hidden', transform: visible ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 240ms cubic-bezier(0.16,1,0.3,1)', fontFamily: font }}
         >
            {/* Header */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '24px 24px 16px' }}>
               <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                     <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#18181B', fontFamily: font }}>Add pages</h2>
                     <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#3F3F47' }}>
                        <div style={{ width: 44, height: 10, padding: 2, border: '1px solid #E4E4E7', borderRadius: 9999, background: '#fff', overflow: 'hidden', display: 'flex' }}>
                           <div style={{ width: `${barWidth}%`, height: '100%', borderRadius: 9999, background: '#1AB25E' }} />
                        </div>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#3F3F47', fontFamily: font }}>
                           {available} available<InfoIcon />
                        </span>
                     </div>
                  </div>
                  <button
                     type="button"
                     onClick={requestClose}
                     aria-label="Close"
                     style={{ display: 'inline-flex', border: 'none', background: 'transparent', color: '#18181B', cursor: 'pointer', padding: 0, transition: 'opacity 150ms ease' }}
                     onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.6'; }}
                     onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                  >
                     <XIcon size={20} />
                  </button>
               </div>

               <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p style={{ margin: 0, fontSize: 14, color: '#18181B', fontFamily: font }}>Showing {filtered.length} {filtered.length === 1 ? 'page' : 'pages'}</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, color: '#18181B', fontFamily: font }}>Select:</span>
                        <button type="button" disabled aria-disabled="true" style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: '#F4F4F5', color: '#18181B', fontSize: 13, fontWeight: 600, fontFamily: font, opacity: 0.6, cursor: 'not-allowed' }}>Top 50</button>
                     </div>
                     <SearchBar value={search} onChange={setSearch} placeholder="Search" width={250} />
                  </div>
               </div>
            </div>

            {/* Table / empty state */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: selected.size > 0 ? '0 24px 88px' : '0 24px 24px' }}>
               {filtered.length === 0 ? (
                  <div style={{ paddingTop: 56, width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                     <EmptyEyes />
                     <span style={{ fontSize: 16, fontWeight: 600, color: '#3F3F47', fontFamily: font }}>We couldn&apos;t find any results</span>
                     <span style={{ fontSize: 14, color: '#3F3F47', fontFamily: font, maxWidth: 420 }}>Is your page indexed? You can only add pages that are available in Search Console.</span>
                  </div>
               ) : (
                  <div style={{ border: '1px solid #F4F4F5', borderRadius: 8, overflow: 'hidden' }}>
                     {/* Header */}
                     <div style={{ position: 'sticky', top: 0, zIndex: 1, display: 'flex', alignItems: 'stretch', background: '#fff', borderBottom: '1px solid #F4F4F5' }}>
                        <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center' }}>
                           <Checkbox
                              checked={allSelected ? true : filtered.some((p) => selected.has(p.path)) ? 'indeterminate' : false}
                              onChange={toggleAll}
                           />
                        </div>
                        <div style={{ flex: 1, minWidth: 0, padding: '10px 16px', display: 'flex', alignItems: 'center' }}>
                           <button type="button" onClick={() => handleSort('path')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontSize: 14, fontWeight: sortKey === 'path' ? 600 : 400, color: sortKey === 'path' ? '#18181B' : '#3F3F47', fontFamily: font }}>Page URL
                              <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor" style={{ color: '#9F9FA9' }}><path d="M10 3.5a.75.75 0 0 1 .53.22l3 3a.75.75 0 0 1-1.06 1.06L10 5.31L7.53 7.78a.75.75 0 0 1-1.06-1.06l3-3A.75.75 0 0 1 10 3.5m-3.53 9.22a.75.75 0 0 1 1.06 0L10 14.69l2.47-2.47a.75.75 0 1 1 1.06 1.06l-3 3a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 0 1 0-1.06" /></svg>
                           </button>
                        </div>
                        <SortableHeader label="Traffic" sortKey="clicks" activeKey={sortKey} dir={sortDir} width={120} onSort={(k) => handleSort(k as SortKey)} />
                        <SortableHeader label="Impr." sortKey="impressions" activeKey={sortKey} dir={sortDir} width={120} onSort={(k) => handleSort(k as SortKey)} />
                     </div>

                     {/* Rows */}
                     {filtered.map((p) => {
                        const isSel = selected.has(p.path);
                        return (
                           <div key={p.path} onClick={() => toggle(p.path)} className="addpage-row" style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1px solid #F4F4F5', cursor: 'pointer', background: isSel ? '#f3f4f0' : '#fff', transition: 'background 100ms ease' }}>
                              <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center' }}>
                                 <Checkbox checked={isSel} onChange={() => toggle(p.path)} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0, padding: '12px 16px', display: 'flex', alignItems: 'center', fontSize: 14, color: '#18181B', fontFamily: font, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.path}</div>
                              <div style={{ width: 120, flexShrink: 0, padding: '12px 16px', borderLeft: '1px solid #F4F4F5', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontSize: 14, color: '#18181B', fontFamily: font }}>{fmt(p.clicks)}</div>
                              <div style={{ width: 120, flexShrink: 0, padding: '12px 16px', borderLeft: '1px solid #F4F4F5', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontSize: 14, color: '#18181B', fontFamily: font }}>{fmt(p.impressions)}</div>
                           </div>
                        );
                     })}
                  </div>
               )}
            </div>

            {/* Selection bar */}
            {selected.size > 0 && (
               <div style={{ position: 'absolute', left: 24, right: 24, bottom: 24, minHeight: 48, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 12, background: '#18181B', boxShadow: '0px 8px 32px rgba(0,0,0,0.28)', animation: 'growOut 0.2s cubic-bezier(0.16,1,0.3,1)' }}>
                  <button type="button" onClick={() => setSelected(new Set())} aria-label="Clear selection" style={{ display: 'inline-flex', border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer', padding: 0, transition: 'opacity 150ms ease' }} onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8'; }} onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}>
                     <XIcon size={18} />
                  </button>
                  <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                     <span style={{ fontSize: 14, color: '#fff', fontFamily: font }}>{selected.size} {selected.size === 1 ? 'page' : 'pages'} selected</span>
                     <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                        <button
                           type="button"
                           onClick={selectAll}
                           style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#18181B', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: font, cursor: 'pointer', transition: 'background 150ms ease' }}
                           onMouseEnter={(e) => { e.currentTarget.style.background = '#F29964'; }}
                           onMouseLeave={(e) => { e.currentTarget.style.background = '#18181B'; }}
                        >
                           Select all {filtered.length}
                        </button>
                        <button
                           type="button"
                           onClick={() => onAdd([...selected])}
                           style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#F4F4F5', color: '#18181B', fontSize: 14, fontWeight: 600, fontFamily: font, cursor: 'pointer', transition: 'background 150ms ease' }}
                           onMouseEnter={(e) => { e.currentTarget.style.background = '#E4E4E7'; }}
                           onMouseLeave={(e) => { e.currentTarget.style.background = '#F4F4F5'; }}
                        >
                           Add selected
                        </button>
                     </div>
                  </div>
               </div>
            )}
         </div>
      </>
   );
};

export default AddPagesModal;
