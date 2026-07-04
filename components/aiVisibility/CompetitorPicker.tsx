import React, { useEffect, useRef, useState } from 'react';

const FONT = 'var(--font-family-primary)';
const favicon = (d: string) => `https://www.google.com/s2/favicons?domain=${d}&sz=32`;

const CompareIcon = () => (
   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M7 10L3 14M3 14L7 18M3 14H21M17 14L21 10M21 10L17 6M21 10H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
   </svg>
);

/** "Compare" trigger (SurferSEO-style): plain when off, "Comparing with {domain}"
 *  when on. Opens a searchable list over ALL competitors, with a clear option. */
const CompetitorPicker = ({ competitors, selected, onSelect, align = 'left' }: { competitors: Array<{ domain: string }>; selected: string | null; onSelect: (d: string | null) => void; align?: 'left' | 'right' }) => {
   const [open, setOpen] = useState(false);
   const [q, setQ] = useState('');
   const ref = useRef<HTMLDivElement>(null);

   useEffect(() => {
      if (!open) return undefined;
      const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
      document.addEventListener('mousedown', onDoc);
      return () => document.removeEventListener('mousedown', onDoc);
   }, [open]);

   const filtered = competitors.filter((c) => c.domain.toLowerCase().includes(q.trim().toLowerCase()));
   if (!competitors.length) return null;

   const active = !!selected;
   return (
      // minWidth:0 + flexShrink lets the picker shrink (and the domain label ellipsize)
      // when the toolbar is tight, instead of holding its full width and wrapping the row.
      <div ref={ref} style={{ position: 'relative', minWidth: 0, flexShrink: 1 }}>
         <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 8, padding: '7px 12px', border: `1px solid ${active ? '#18181B' : '#E4E4E7'}`, background: '#fff', color: '#18181B', fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', maxWidth: 220, minWidth: 0, width: '100%' }}
         >
            {active ? (
               <>
                  <span style={{ fontWeight: 400, color: '#71717B' }}>Comparing with</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                     { /* eslint-disable-next-line @next/next/no-img-element */ }
                     <img alt="" src={favicon(selected as string)} width={16} height={16} style={{ borderRadius: 3, flexShrink: 0 }} />
                     <span title={selected as string} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected}</span>
                  </span>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#783AFB', flexShrink: 0 }} />
               </>
            ) : (
               <>
                  <span style={{ color: '#52525C', display: 'inline-flex' }}><CompareIcon /></span>
                  <span>Compare</span>
               </>
            )}
            <span style={{ color: '#9F9FA9', fontSize: 11, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }}>▾</span>
         </button>

         {open && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', [align]: 0, width: 280, maxHeight: 340, overflow: 'auto', background: '#fff', border: '1px solid #E4E4E7', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', zIndex: 150, padding: 8, animation: 'growOut 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}>
               <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search competitors…"
                  style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #D4D4D8', borderRadius: 8, padding: '8px 10px', fontSize: 14, fontFamily: FONT, color: '#18181B', marginBottom: 8, outline: 'none' }}
               />
               {active && (
                  <button
                     type="button"
                     onClick={() => { onSelect(null); setOpen(false); setQ(''); }}
                     style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', border: 'none', borderRadius: 8, padding: '8px 10px', background: 'transparent', color: '#71717B', fontSize: 14, fontFamily: FONT, cursor: 'pointer', textAlign: 'left', marginBottom: 4 }}
                  >
                     <span style={{ display: 'inline-flex', width: 16, justifyContent: 'center' }}>✕</span>
                     <span>Clear comparison</span>
                  </button>
               )}
               {filtered.length === 0 ? (
                  <div style={{ padding: '10px 8px', fontSize: 13, color: '#9F9FA9', fontFamily: FONT }}>No matches.</div>
               ) : filtered.map((c) => {
                  const isSel = c.domain === selected;
                  return (
                     <button
                        key={c.domain}
                        type="button"
                        onClick={() => { onSelect(c.domain); setOpen(false); setQ(''); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', border: 'none', borderRadius: 8, padding: '8px 10px', background: isSel ? '#F4F4F5' : 'transparent', color: '#18181B', fontSize: 14, fontFamily: FONT, cursor: 'pointer', textAlign: 'left' }}
                     >
                        { /* eslint-disable-next-line @next/next/no-img-element */ }
                        <img alt="" src={favicon(c.domain)} width={16} height={16} style={{ borderRadius: 3, flexShrink: 0 }} />
                        <span title={c.domain} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.domain}</span>
                     </button>
                  );
               })}
            </div>
         )}
      </div>
   );
};

export default CompetitorPicker;
