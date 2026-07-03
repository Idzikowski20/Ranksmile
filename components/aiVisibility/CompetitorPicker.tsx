import React, { useEffect, useRef, useState } from 'react';

const FONT = 'var(--font-family-primary)';
const favicon = (d: string) => `https://www.google.com/s2/favicons?domain=${d}&sz=32`;

/** "Comparing with {domain}" trigger + searchable dropdown over ALL competitors. */
const CompetitorPicker = ({ competitors, selected, onSelect }: { competitors: Array<{ domain: string }>; selected: string | null; onSelect: (d: string) => void }) => {
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

   return (
      <div ref={ref} style={{ position: 'relative' }}>
         <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid #E4E4E7', borderRadius: 8, padding: '6px 12px', background: '#fff', color: '#18181B', fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', maxWidth: 260 }}
         >
            <span style={{ fontWeight: 400, color: '#71717B' }}>Compare:</span>
            {selected ? (
               <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  { /* eslint-disable-next-line @next/next/no-img-element */ }
                  <img alt="" src={favicon(selected)} width={16} height={16} style={{ borderRadius: 3, flexShrink: 0 }} />
                  <span title={selected} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected}</span>
               </span>
            ) : <span style={{ color: '#9F9FA9', fontWeight: 400 }}>select…</span>}
            <span style={{ color: '#9F9FA9', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }}>▾</span>
         </button>

         {open && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 280, maxHeight: 320, overflow: 'auto', background: '#fff', border: '1px solid #E4E4E7', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', zIndex: 150, padding: 8, animation: 'growOut 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}>
               <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search competitors…"
                  style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #D4D4D8', borderRadius: 8, padding: '8px 10px', fontSize: 14, fontFamily: FONT, color: '#18181B', marginBottom: 8, outline: 'none' }}
               />
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
