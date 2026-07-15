import React, { useEffect, useRef, useState } from 'react';
import type { ArticleStatus, TopicCluster } from '../../lib/topicalMap';

const FONT = 'var(--font-family-primary)';

export type TopicalFilterState = {
   recommendedOnly: boolean;
   kdMin: number;
   kdMax: number;
   volMin: number;
   volMax: number;
   statuses: ArticleStatus[];
};

export const DEFAULT_TOPICAL_FILTERS: TopicalFilterState = {
   recommendedOnly: false, kdMin: 0, kdMax: 100, volMin: 0, volMax: 999999, statuses: [],
};

export const applyTopicalFilters = (list: TopicCluster[], f: TopicalFilterState): TopicCluster[] => list.filter((c) => (
   (!f.recommendedOnly || c.status === 'recommended')
   && c.kd >= f.kdMin && c.kd <= f.kdMax
   && c.vol >= f.volMin && c.vol <= f.volMax
   && (f.statuses.length === 0 || f.statuses.includes(c.articleStatus))
));

const ALL_STATUSES: ArticleStatus[] = ['Not started', 'In progress', 'Done', 'Covered'];

const FiltersIcon = () => (
   <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M17 2.75a.75.75 0 0 0-1.5 0v5.5a.75.75 0 0 0 1.5 0zm0 13a.75.75 0 0 0-1.5 0v1.5a.75.75 0 0 0 1.5 0zM3.75 15a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75M4.5 2.75a.75.75 0 0 0-1.5 0v5.5a.75.75 0 0 0 1.5 0zM10 11a.75.75 0 0 1 .75.75v5.5a.75.75 0 0 1-1.5 0v-5.5A.75.75 0 0 1 10 11m.75-8.25a.75.75 0 0 0-1.5 0v1.5a.75.75 0 0 0 1.5 0zM10 6a2 2 0 1 0 0 4a2 2 0 0 0 0-4m-6.25 4a2 2 0 1 0 0 4a2 2 0 0 0 0-4m12.5 0a2 2 0 1 0 0 4a2 2 0 0 0 0-4" />
   </svg>
);
const CheckIcon = () => (
   <svg viewBox="0 0 20 20" width="16" height="16" fill="#F29964" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path fillRule="evenodd" d="M16.705 4.153a.75.75 0 0 1 .142 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893l7.48-9.817a.75.75 0 0 1 1.05-.143" clipRule="evenodd" />
   </svg>
);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
   <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#71717B', fontFamily: FONT }}>{children}</span>
);

const NumInput = ({ value, onChange }: { value: number; onChange: (n: number) => void }) => (
   <input
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      style={{ width: '100%', height: 38, border: '1px solid #D4D4D8', borderRadius: 10, padding: '0 10px', fontSize: 14, fontFamily: FONT, color: '#18181B', background: '#fff', boxShadow: '0px 1px 2px 0px rgba(26,29,40,0.06)', outline: 'none', boxSizing: 'border-box' }}
      onFocus={(e) => { e.currentTarget.style.borderColor = '#F5C4A0'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(242,153,100,0.1)'; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = '#D4D4D8'; e.currentTarget.style.boxShadow = '0px 1px 2px 0px rgba(26,29,40,0.06)'; }}
   />
);

const TopicalFilters = ({ value, onChange }: { value: TopicalFilterState; onChange: (v: TopicalFilterState) => void }) => {
   const [open, setOpen] = useState(false);
   const ref = useRef<HTMLDivElement>(null);
   useEffect(() => {
      if (!open) return undefined;
      const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
      document.addEventListener('mousedown', h);
      return () => document.removeEventListener('mousedown', h);
   }, [open]);

   const set = (patch: Partial<TopicalFilterState>) => onChange({ ...value, ...patch });
   const toggleStatus = (s: (typeof ALL_STATUSES)[number]) => set({
      statuses: value.statuses.includes(s) ? value.statuses.filter((x) => x !== s) : [...value.statuses, s],
   });

   return (
      <div ref={ref} style={{ position: 'relative' }}>
         <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 600, color: '#3F3F47', transition: 'color 150ms ease' }}
         >
            <FiltersIcon /> Filters
         </button>
         {open && (
            <div style={{ position: 'absolute', top: 'calc(100% + 12px)', right: 0, zIndex: 150, width: 300, background: '#fff', border: '1px solid #E4E4E7', borderRadius: 12, padding: 16, boxShadow: '0px 18px 40px 0px rgba(17,24,39,0.14), 0px 8px 18px 0px rgba(17,24,39,0.09), 0px 2px 6px 0px rgba(17,24,39,0.06)', animation: 'growOut 0.18s cubic-bezier(0.16,1,0.3,1)', transformOrigin: 'top right', display: 'flex', flexDirection: 'column', gap: 16 }}>
               <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <SectionLabel>Topics</SectionLabel>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                     <span
                        role="switch"
                        aria-checked={value.recommendedOnly}
                        onClick={() => set({ recommendedOnly: !value.recommendedOnly })}
                        style={{ width: 28, height: 16, borderRadius: 9999, background: value.recommendedOnly ? '#F29964' : '#9F9FA9', position: 'relative', cursor: 'pointer', transition: 'background 250ms', flexShrink: 0, display: 'inline-block' }}
                     >
                        <span style={{ position: 'absolute', top: 2, left: value.recommendedOnly ? 14 : 2, width: 12, height: 12, borderRadius: 9999, background: '#fff', transition: 'left 250ms' }} />
                     </span>
                     <span style={{ fontSize: 14, color: '#18181B', fontFamily: FONT }}>Recommendations only</span>
                  </label>
               </div>
               <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <SectionLabel>Difficulty</SectionLabel>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                     <NumInput value={value.kdMin} onChange={(n) => set({ kdMin: n })} />
                     <span style={{ color: '#9F9FA9' }}>-</span>
                     <NumInput value={value.kdMax} onChange={(n) => set({ kdMax: n })} />
                  </div>
               </div>
               <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <SectionLabel>Search volume</SectionLabel>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                     <NumInput value={value.volMin} onChange={(n) => set({ volMin: n })} />
                     <span style={{ color: '#9F9FA9' }}>-</span>
                     <NumInput value={value.volMax} onChange={(n) => set({ volMax: n })} />
                  </div>
               </div>
               <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <SectionLabel>Status</SectionLabel>
                  {ALL_STATUSES.map((s) => (
                     <button
                        key={s}
                        type="button"
                        onClick={() => toggleStatus(s)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '8px 4px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontSize: 15, color: '#18181B', textAlign: 'left', borderRadius: 8, transition: 'background 120ms ease' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F4F5'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                     >
                        {s}
                        {value.statuses.includes(s) && <CheckIcon />}
                     </button>
                  ))}
               </div>
               <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <SectionLabel>Competitors</SectionLabel>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px', fontSize: 15, color: '#18181B', fontFamily: FONT }}>
                     All selected
                     <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m9 5l7 7l-7 7" /></svg>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
};

export default TopicalFilters;
