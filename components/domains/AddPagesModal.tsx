import React, { useMemo, useState, useEffect } from 'react';
import { Checkbox, SearchBar, SortableHeader } from '../ui';
import { XIcon } from '../ui/icons';
import { useSortState } from '../../lib/useSortState';

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

// Blinking-eyes empty state illustration (from Surfer).
const EmptyEyes = () => (
   <svg width="40" height="40" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, color: '#D4D4D8' }}>
      <style>{`
         #ap-left-eye { animation: ap-blink-left 3.25s infinite; }
         #ap-right-eye { animation: ap-blink-right 3.25s infinite; }
         @keyframes ap-blink-left {
            53%, 54% { d: path("M10 16.2786C10 16.0952 10 16.0034 10.2537 15.9465C10.5073 15.8895 10.9156 15.8895 11.7321 15.8895H12.2679C13.0844 15.8895 13.4927 15.8895 13.7463 15.9465C14 16.0034 14 16.0952 14 16.2786V17.5003C14 17.6838 14 17.7755 13.7463 17.8325C13.4927 17.8895 13.0844 17.8895 12.2679 17.8895H11.7321C10.9156 17.8895 10.5073 17.8895 10.2537 17.8325C10 17.7755 10 17.6838 10 17.5003V16.2786Z"); }
         }
         @keyframes ap-blink-right {
            53%, 54% { d: path("M18 16.2786C18 16.0952 18 16.0034 18.2537 15.9465C18.5073 15.8895 18.9156 15.8895 19.7321 15.8895H20.2679C21.0844 15.8895 21.4927 15.8895 21.7463 15.9465C22 16.0034 22 16.0952 22 16.2786V17.5003C22 17.6838 22 17.7755 21.7463 17.8325C21.4927 17.8895 21.0844 17.8895 20.2679 17.8895H19.7321C18.9156 17.8895 18.5073 17.8895 18.2537 17.8325C18 17.7755 18 17.6838 18 17.5003V16.2786Z"); }
         }
      `}</style>
      <path fillRule="evenodd" clipRule="evenodd" d="M8.49224 2C4.92508 2 2.07498 4.94359 2.07498 8.46154L2 23.5385C2 27.1282 4.92508 30 8.4209 30H23.4743C27.0415 30 30 27.0564 30 23.5385L29.9722 8.05139C29.7595 4.65552 26.9073 2 23.5457 2H8.49224ZM27.1802 8.29085C27.0905 6.36259 25.4884 4.8718 23.617 4.8718H8.4209C6.49463 4.8 4.85373 6.45128 4.85373 8.46154L4.84956 23.5385H4.85373C4.85373 25.5487 6.49463 27.1282 8.4209 27.1282H23.4743C25.472 27.1282 27.1463 25.4769 27.1463 23.5385L27.1802 8.29085Z" fill="currentColor" />
      <path id="ap-left-eye" d="M9.84155 11.1844C9.84155 10.3709 9.84155 9.96409 10.0943 9.71135C10.347 9.45862 10.7538 9.45862 11.5673 9.45862H12.1013C12.9148 9.45862 13.3216 9.45862 13.5743 9.71135C13.8271 9.96409 13.8271 10.3709 13.8271 11.1844V16.602C13.8271 17.4155 13.8271 17.8223 13.5743 18.075C13.3216 18.3278 12.9148 18.3278 12.1013 18.3278H11.5673C10.7538 18.3278 10.347 18.3278 10.0943 18.075C9.84155 17.8223 9.84155 17.4155 9.84155 16.602V11.1844Z" fill="currentColor" />
      <path id="ap-right-eye" d="M18.1047 11.1844C18.1047 10.3709 18.1047 9.96409 18.3575 9.71135C18.6102 9.45862 19.017 9.45862 19.8305 9.45862H20.3645C21.178 9.45862 21.5848 9.45862 21.8375 9.71135C22.0902 9.96409 22.0902 10.3709 22.0902 11.1844V16.602C22.0902 17.4155 22.0902 17.8223 21.8375 18.075C21.5848 18.3278 21.178 18.3278 20.3645 18.3278H19.8305C19.017 18.3278 18.6102 18.3278 18.3575 18.075C18.1047 17.8223 18.1047 17.4155 18.1047 16.602V11.1844Z" fill="currentColor" />
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
         const va = (a as any)[sortKey];
         const vb = (b as any)[sortKey];
         if (typeof va === 'string') return sortDir === 'desc' ? vb.localeCompare(va) : va.localeCompare(vb);
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
                           <Checkbox checked={allSelected} indeterminate={!allSelected && filtered.some((p) => selected.has(p.path))} onChange={toggleAll} />
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
                           <div key={p.path} onClick={() => toggle(p.path)} className="addpage-row" style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1px solid #F4F4F5', cursor: 'pointer', background: isSel ? '#F8F8F9' : '#fff', transition: 'background 100ms ease' }}>
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
                           onMouseEnter={(e) => { e.currentTarget.style.background = '#783AFB'; }}
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
