import React, { useEffect, useMemo, useRef, useState } from 'react';

const FONT = 'var(--font-family-primary)';

const ChevronDown = () => (
   <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path fill="currentColor" fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" /></svg>
);
const Check = () => (
   <svg viewBox="0 0 20 20" width="12" height="12" aria-hidden="true"><path fill="currentColor" fillRule="evenodd" d="M16.705 4.153a.75.75 0 0 1 .142 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893l7.48-9.817a.75.75 0 0 1 1.05-.143" clipRule="evenodd" /></svg>
);

const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid #E4E4E7', background: '#fff', fontSize: 14, fontWeight: 600, fontFamily: FONT, color: '#18181B', cursor: 'pointer' };

const Box = ({ state }: { state: 'on' | 'off' | 'mixed' }) => (
   <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: 4, flexShrink: 0, border: state === 'off' ? '1.5px solid #D4D4D8' : '1.5px solid #783AFB', background: state === 'off' ? '#fff' : '#783AFB', color: '#fff' }}>
      {state === 'on' ? <Check /> : null}
      {state === 'mixed' ? <span style={{ width: 8, height: 2, borderRadius: 1, background: '#fff' }} /> : null}
   </span>
);

export type PromptOption = { id: number; text: string; topic?: string };

/** Grouped multi-select prompt filter (checkboxes, per-topic "Select all", global
 *  "All prompts"). Empty selection == all (no filter). Controlled when `onChange`
 *  is supplied, otherwise self-managed (display-only on pages that don't filter). */
const PromptPicker = ({ prompts, selected, onChange }: {
   prompts: PromptOption[];
   selected?: number[];
   onChange?: (ids: number[]) => void;
}) => {
   const [open, setOpen] = useState(false);
   const [q, setQ] = useState('');
   const [internal, setInternal] = useState<number[]>([]);
   const ref = useRef<HTMLDivElement>(null);

   const sel = useMemo(() => (onChange ? (selected || []) : internal), [onChange, selected, internal]);
   const setSel = (next: number[]) => { if (onChange) onChange(next); else setInternal(next); };

   useEffect(() => {
      if (!open) return undefined;
      const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
      document.addEventListener('mousedown', onDoc);
      return () => document.removeEventListener('mousedown', onDoc);
   }, [open]);

   const allIds = useMemo(() => prompts.map((p) => p.id), [prompts]);
   const effective = useMemo(() => new Set(sel.length ? sel : allIds), [sel, allIds]);
   // Normalise "everything selected" back to [] so the query sends no filter.
   const commit = (set: Set<number>) => setSel(set.size === 0 || set.size === allIds.length ? [] : Array.from(set));
   const toggleOne = (id: number) => { const s = new Set(effective); if (s.has(id)) s.delete(id); else s.add(id); commit(s); };
   const toggleMany = (ids: number[]) => {
      const s = new Set(effective);
      const allIn = ids.every((id) => s.has(id));
      ids.forEach((id) => (allIn ? s.delete(id) : s.add(id)));
      commit(s);
   };

   const groups = useMemo(() => {
      const needle = q.trim().toLowerCase();
      const m = new Map<string, PromptOption[]>();
      prompts.filter((p) => !needle || p.text.toLowerCase().includes(needle)).forEach((p) => {
         const t = p.topic || 'Prompts';
         if (!m.has(t)) m.set(t, []);
         (m.get(t) as PromptOption[]).push(p);
      });
      return Array.from(m.entries());
   }, [prompts, q]);

   let label = 'All prompts';
   if (sel.length === 1) label = prompts.find((p) => p.id === sel[0])?.text || '1 prompt';
   else if (sel.length > 1) label = `${sel.length} prompts`;

   const groupStateOf = (on: number, total: number): 'on' | 'off' | 'mixed' => {
      if (on === 0) return 'off';
      return on === total ? 'on' : 'mixed';
   };

   const rowBase: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 'none', borderRadius: 8, padding: '7px 10px', background: 'transparent', color: '#18181B', fontSize: 14, fontFamily: FONT, cursor: 'pointer', textAlign: 'left' };

   return (
      <div ref={ref} style={{ position: 'relative' }}>
         <button type="button" style={{ ...btn, maxWidth: 260 }} onClick={() => setOpen((o) => !o)}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
            <ChevronDown />
         </button>
         {open && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: 340, maxHeight: 380, overflow: 'auto', background: '#fff', border: '1px solid #E4E4E7', borderRadius: 10, padding: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', zIndex: 150, fontFamily: FONT, animation: 'growOut 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}>
               <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search prompts…"
                  style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #D4D4D8', borderRadius: 8, padding: '8px 10px', fontSize: 14, fontFamily: FONT, color: '#18181B', marginBottom: 8, outline: 'none' }}
               />
               <button type="button" onClick={() => setSel([])} style={{ ...rowBase, fontWeight: 600, marginBottom: 2 }} onMouseEnter={(e) => { e.currentTarget.style.background = '#F9F9FB'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                  <Box state={sel.length === 0 ? 'on' : 'off'} />
                  <span style={{ flex: 1 }}>All prompts</span>
               </button>
               {groups.length === 0 ? (
                  <div style={{ padding: '10px 8px', fontSize: 13, color: '#9F9FA9' }}>No matches.</div>
               ) : groups.map(([topic, items]) => {
                  const ids = items.map((p) => p.id);
                  const on = ids.filter((id) => effective.has(id)).length;
                  const groupState = groupStateOf(on, ids.length);
                  return (
                     <div key={topic} style={{ marginTop: 4 }}>
                        <button type="button" onClick={() => toggleMany(ids)} style={{ ...rowBase, fontWeight: 600, color: '#52525C' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#F9F9FB'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                           <Box state={groupState} />
                           <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{topic}</span>
                           <span style={{ fontSize: 12, color: '#9F9FA9', fontWeight: 500 }}>{on}/{ids.length}</span>
                        </button>
                        {items.map((p) => (
                           <button key={p.id} type="button" onClick={() => toggleOne(p.id)} style={{ ...rowBase, paddingLeft: 22 }} onMouseEnter={(e) => { e.currentTarget.style.background = '#F9F9FB'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                              <Box state={effective.has(p.id) ? 'on' : 'off'} />
                              <span title={p.text} style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.text}</span>
                           </button>
                        ))}
                     </div>
                  );
               })}
            </div>
         )}
      </div>
   );
};

export default PromptPicker;
