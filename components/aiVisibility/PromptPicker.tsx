import React, { useEffect, useRef, useState } from 'react';

const FONT = 'var(--font-family-primary)';

const ChevronDown = () => (
   <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path fill="currentColor" fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" /></svg>
);
const Check = () => (
   <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path fill="currentColor" fillRule="evenodd" d="M16.705 4.153a.75.75 0 0 1 .142 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893l7.48-9.817a.75.75 0 0 1 1.05-.143" clipRule="evenodd" /></svg>
);

const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid #E4E4E7', background: '#fff', fontSize: 14, fontWeight: 600, fontFamily: FONT, color: '#18181B', cursor: 'pointer' };

/** Searchable "All prompts" filter (same search UX as the competitor picker) over the
 *  prompts chosen during setup. Single-select with an "All prompts" reset. */
const PromptPicker = ({ prompts }: { prompts: Array<{ id: number; text: string }> }) => {
   const [open, setOpen] = useState(false);
   const [q, setQ] = useState('');
   const [selected, setSelected] = useState<number | null>(null);
   const ref = useRef<HTMLDivElement>(null);

   useEffect(() => {
      if (!open) return undefined;
      const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
      document.addEventListener('mousedown', onDoc);
      return () => document.removeEventListener('mousedown', onDoc);
   }, [open]);

   const filtered = prompts.filter((p) => p.text.toLowerCase().includes(q.trim().toLowerCase()));
   const current = selected != null ? prompts.find((p) => p.id === selected) : null;

   return (
      <div ref={ref} style={{ position: 'relative' }}>
         <button type="button" style={{ ...btn, maxWidth: 260 }} onClick={() => setOpen((o) => !o)}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{current ? current.text : 'All prompts'}</span>
            <ChevronDown />
         </button>
         {open && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: 320, maxHeight: 360, overflow: 'auto', background: '#fff', border: '1px solid #E4E4E7', borderRadius: 10, padding: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', zIndex: 150, fontFamily: FONT, animation: 'growOut 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}>
               <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search prompts…"
                  style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #D4D4D8', borderRadius: 8, padding: '8px 10px', fontSize: 14, fontFamily: FONT, color: '#18181B', marginBottom: 8, outline: 'none' }}
               />
               <button
                  type="button"
                  onClick={() => { setSelected(null); setOpen(false); setQ(''); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 'none', borderRadius: 8, padding: '8px 10px', background: selected == null ? '#F4F4F5' : 'transparent', color: '#18181B', fontSize: 14, fontWeight: 500, fontFamily: FONT, cursor: 'pointer', textAlign: 'left', marginBottom: 4 }}
               >
                  <span style={{ flex: 1 }}>All prompts</span>
                  {selected == null ? <span style={{ display: 'inline-flex', color: '#18181B' }}><Check /></span> : null}
               </button>
               {filtered.length === 0 ? (
                  <div style={{ padding: '10px 8px', fontSize: 13, color: '#9F9FA9', fontFamily: FONT }}>No matches.</div>
               ) : filtered.map((p) => (
                  <button
                     key={p.id}
                     type="button"
                     onClick={() => { setSelected(p.id); setOpen(false); setQ(''); }}
                     style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 'none', borderRadius: 8, padding: '8px 10px', background: selected === p.id ? '#F4F4F5' : 'transparent', color: '#18181B', fontSize: 14, fontFamily: FONT, cursor: 'pointer', textAlign: 'left' }}
                     onMouseEnter={(e) => { if (selected !== p.id) e.currentTarget.style.background = '#F9F9FB'; }}
                     onMouseLeave={(e) => { if (selected !== p.id) e.currentTarget.style.background = 'transparent'; }}
                  >
                     <span title={p.text} style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.text}</span>
                     {selected === p.id ? <span style={{ display: 'inline-flex', color: '#18181B', flexShrink: 0 }}><Check /></span> : null}
                  </button>
               ))}
            </div>
         )}
      </div>
   );
};

export default PromptPicker;
