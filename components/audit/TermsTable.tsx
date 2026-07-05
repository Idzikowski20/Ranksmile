import React, { useState } from 'react';
import { findTermRangesBatch } from '../../lib/contentScore';
import { AuditTerm } from '../../lib/auditTypes';

const FONT = 'var(--font-family-primary)';

type Tab = 'all' | 'phrase' | 'word' | 'number';
const TAB_LABEL: Record<Tab, string> = { all: 'All', phrase: 'Phrases', word: 'Words', number: 'Numbers' };

// SurferSEO renders the matched surface form bold (background transparent) inside the
// example sentence; reuse the editor's inflection-tolerant matcher so highlighting is
// consistent with the rest of the app.
const Highlighted = ({ text, term }: { text: string; term: string }) => {
   const ranges = findTermRangesBatch(text, [term])[0]?.ranges ?? [];
   if (!ranges.length) return <>{text}</>;
   const parts: React.ReactNode[] = [];
   let last = 0;
   ranges.forEach(([s, e], i) => {
      if (s > last) parts.push(text.slice(last, s));
      parts.push(<mark key={i} style={{ background: 'transparent', color: 'inherit', fontWeight: 600 }}>{text.slice(s, e)}</mark>);
      last = e;
   });
   if (last < text.length) parts.push(text.slice(last));
   return <>{parts}</>;
};

const Chevron = ({ open }: { open: boolean }) => (
   <svg viewBox="0 0 24 24" width={14} height={14} style={{ display: 'inline-block', verticalAlign: 'middle', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 150ms ease' }}>
      <path fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
   </svg>
);

const RedDiamond = () => (
   <svg viewBox="0 0 256 256" width={16} height={16} style={{ color: '#EF4444', flexShrink: 0 }}><path fill="currentColor" d="m227.31 80.23l-51.54-51.54A16.13 16.13 0 0 0 164.45 24h-72.9a16.13 16.13 0 0 0-11.32 4.69L28.69 80.23A16.13 16.13 0 0 0 24 91.55v72.9a16.13 16.13 0 0 0 4.69 11.32l51.54 51.54A16.13 16.13 0 0 0 91.55 232h72.9a16.13 16.13 0 0 0 11.32-4.69l51.54-51.54a16.13 16.13 0 0 0 4.69-11.32v-72.9a16.13 16.13 0 0 0-4.69-11.32M120 80a8 8 0 0 1 16 0v56a8 8 0 0 1-16 0Zm8 104a12 12 0 1 1 12-12a12 12 0 0 1-12 12" /></svg>
);
const GreenCheck = () => (
   <svg viewBox="0 0 256 256" width={16} height={16} style={{ color: '#22C55E', flexShrink: 0 }}><path fill="currentColor" d="M208 32H48a16 16 0 0 0-16 16v160a16 16 0 0 0 16 16h160a16 16 0 0 0 16-16V48a16 16 0 0 0-16-16m-34.34 77.66l-56 56a8 8 0 0 1-11.32 0l-24-24a8 8 0 0 1 11.32-11.32L112 148.69l50.34-50.35a8 8 0 0 1 11.32 11.32" /></svg>
);

const th: React.CSSProperties = { textAlign: 'left', fontSize: 13, fontWeight: 500, color: '#71717B', borderBottom: '1px solid #E4E4E7', padding: '10px 12px', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { borderBottom: '1px solid #F4F4F5', padding: '12px 12px', fontSize: 13, color: '#3F3F47', verticalAlign: 'top' };

// SurferSEO action copy: "Add N-M" / "Remove N-M" expresses the gap to the suggested range.
function parseRange(suggested: string): [number, number] {
   const [a, b] = suggested.split('-').map((n) => Number(n));
   return [a || 0, Number.isFinite(b) ? (b as number) : (a || 0)];
}
function actionLabel(t: AuditTerm): string {
   const [sMin, sMax] = parseRange(t.suggested);
   if (t.action === 'add') { const g1 = Math.max(0, sMin - t.you); const g2 = Math.max(0, sMax - t.you); return g2 > g1 ? `Add ${g1}-${g2}` : `Add ${g1}`; }
   if (t.action === 'remove') { const g1 = Math.max(0, t.you - sMax); const g2 = Math.max(0, t.you - sMin); return g2 > g1 ? `Remove ${g1}-${g2}` : `Remove ${g1}`; }
   return '';
}

const ExportButton = () => (
   <button type="button" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', color: '#71717B', fontSize: 13, fontFamily: FONT, cursor: 'pointer', padding: 0 }}>
      <svg viewBox="0 0 24 24" width={18} height={18}><path fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" d="M12 9.75v6.75m0 0l-3-3m3 3l3-3m-8.25 6a4.5 4.5 0 0 1-1.41-8.775a5.25 5.25 0 0 1 10.233-2.33a3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5z" /></svg>
      Export
   </button>
);

/** The inner content of the "Terms to Use" section: All/Phrases/Words/Numbers tabs and the
 *  8-column SurferSEO-style table with an expandable per-term Examples panel. */
const TermsTable = ({ terms }: { terms: AuditTerm[] }) => {
   const [tab, setTab] = useState<Tab>('all');
   const [open, setOpen] = useState<Set<string>>(new Set());
   const toggle = (term: string) => setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(term)) next.delete(term); else next.add(term);
      return next;
   });

   const counts = {
      all: terms.length,
      phrase: terms.filter((t) => t.type === 'phrase').length,
      word: terms.filter((t) => t.type === 'word').length,
      number: terms.filter((t) => t.type === 'number').length,
   };
   const rows = tab === 'all' ? terms : terms.filter((t) => t.type === tab);

   return (
      <div>
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0 12px' }}>
            <div style={{ fontSize: 14, color: '#52525C', fontFamily: FONT }}>
               {(['all', 'phrase', 'word', 'number'] as Tab[]).map((t, i) => (
                  <React.Fragment key={t}>
                     {i > 0 && <span style={{ margin: '0 8px', color: '#D4D4D8' }}>/</span>}
                     <button
                        type="button" onClick={() => setTab(t)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontSize: 14, padding: 0, color: tab === t ? '#18181B' : '#71717B', textDecoration: tab === t ? 'underline' : 'none', fontWeight: tab === t ? 600 : 400 }}
                     >{TAB_LABEL[t]} ({counts[t]})</button>
                  </React.Fragment>
               ))}
            </div>
            <ExportButton />
         </div>

         <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT }}>
               <thead><tr>
                  <th style={{ ...th, width: 70 }}>Term forms</th>
                  <th style={{ ...th, width: '100%' }}>Term</th>
                  <th style={{ ...th, textAlign: 'center', width: 80 }}>Examples</th>
                  <th style={{ ...th, textAlign: 'center', width: 60 }}>You</th>
                  <th style={{ ...th, textAlign: 'center', width: 90 }}>Suggested</th>
                  <th style={{ ...th, textAlign: 'center', width: 90 }}>Relevance</th>
                  <th style={{ ...th, textAlign: 'center', width: 130 }}>Search Volume</th>
                  <th style={{ ...th, width: 130 }}>Action</th>
               </tr></thead>
               <tbody>
                  {rows.map((t) => {
                     const expanded = open.has(t.term);
                     const label = actionLabel(t);
                     return (
                        <React.Fragment key={t.term}>
                           <tr>
                              <td style={{ ...td, textAlign: 'center', color: '#71717B', cursor: t.forms > 1 ? 'pointer' : 'default' }} onClick={t.forms > 1 ? () => toggle(t.term) : undefined}>
                                 {t.forms > 1 ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>{t.forms}<Chevron open={expanded} /></span> : null}
                              </td>
                              <td style={{ ...td, cursor: 'pointer' }} onClick={() => toggle(t.term)}>
                                 <span style={{ color: '#18181B' }}>{t.term}</span>
                                 {t.nlp && <span style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', height: 18, padding: '0 5px', fontSize: 10, fontWeight: 600, color: '#3B82F6', border: '1px solid #93C5FD', borderRadius: 4, textTransform: 'uppercase' }}>NLP</span>}
                              </td>
                              <td style={{ ...td, textAlign: 'center', cursor: t.examples.length ? 'pointer' : 'default', color: '#52525C' }} onClick={t.examples.length ? () => toggle(t.term) : undefined}>
                                 {t.examples.length ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>{t.examples.length}<Chevron open={expanded} /></span> : '—'}
                              </td>
                              <td style={{ ...td, textAlign: 'center' }}>{t.you}</td>
                              <td style={{ ...td, textAlign: 'center' }}>{t.suggested}</td>
                              <td style={{ ...td, textAlign: 'center' }}>{t.relevance}%</td>
                              <td style={{ ...td, textAlign: 'center' }}>{t.searchVolume === null ? '—' : t.searchVolume.toLocaleString('en-US')}</td>
                              <td style={{ ...td }}>
                                 {t.action === 'ok'
                                    ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><GreenCheck /></span>
                                    : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><RedDiamond /><span>{label}</span></span>}
                              </td>
                           </tr>
                           {expanded && t.examples.length > 0 && (
                              <tr>
                                 <td colSpan={8} style={{ padding: 0, borderBottom: '1px solid #F4F4F5' }}>
                                    <div style={{ margin: 12, background: '#F8F8F9', borderRadius: 8, padding: 12 }}>
                                       {t.examples.map((ex, i) => (
                                          <div key={i} style={{ fontSize: 13, color: '#52525C', fontFamily: FONT, marginBottom: i === t.examples.length - 1 ? 0 : 8, lineHeight: 1.5 }}>
                                             &quot;<Highlighted text={ex} term={t.term} />&quot;
                                          </div>
                                       ))}
                                    </div>
                                 </td>
                              </tr>
                           )}
                        </React.Fragment>
                     );
                  })}
               </tbody>
            </table>
         </div>
      </div>
   );
};

export default TermsTable;
