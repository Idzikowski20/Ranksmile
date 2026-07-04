import React, { useEffect, useState } from 'react';
import { CompetitorDTO } from '../../lib/competitorTypes';
import Gauge from '../ui/Gauge';
import Toggle from '../ui/Toggle';

const FONT = 'var(--font-family-primary)';
const favicon = (d: string) => `https://www.google.com/s2/favicons?domain=${d}&sz=32`;

const CloseIcon = () => (
   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
   </svg>
);

const Spinner = () => (
   <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ animation: 'spin 0.7s linear infinite' }}>
      <circle cx="12" cy="12" r="9" stroke="#E4E4E7" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="#783AFB" strokeWidth="3" strokeLinecap="round" />
   </svg>
);

/** Small shield badge for the Authority score, tinted by tier. */
const AuthorityBadge = ({ value }: { value: number | null }) => {
   if (value === null) {
      return <span style={{ fontSize: 13, fontWeight: 500, color: '#9F9FA9', fontFamily: FONT }}>—</span>;
   }
   const color = value >= 50 ? '#16A34A' : value >= 25 ? '#D97706' : '#DC2626';
   return (
      <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 28 }}>
         <svg width="24" height="28" viewBox="0 0 24 28" fill="none" aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
            <path d="M12 1 21 5v8c0 6-3.8 10.2-9 13-5.2-2.8-9-7-9-13V5l9-4Z" fill={color} fillOpacity="0.14" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
         </svg>
         <span style={{ position: 'relative', fontSize: 11, fontWeight: 700, color, fontFamily: FONT, lineHeight: 1 }}>{value}</span>
      </span>
   );
};

interface Props {
   keyword: string;
   competitors: CompetitorDTO[];
   loading?: boolean;
   scanning?: boolean;
   onScan: () => void;
   onClose: () => void;
   onConfirm: (selectedIds: number[]) => void;
}

/**
 * Shared "Organic Competitors" selection modal, used by both the Audit tool and the
 * Content Editor. Presentational: the parent owns the data + mutations. Local state only
 * tracks which competitors are toggled on; onConfirm hands back the selected ids.
 */
const CompetitorsModal = ({ keyword, competitors, loading, scanning, onScan, onClose, onConfirm }: Props) => {
   const [selectedIds, setSelectedIds] = useState<number[]>(() => competitors.filter((c) => c.selected).map((c) => c.id));

   // Re-seed local selection whenever the parent swaps in a fresh competitor list.
   useEffect(() => {
      setSelectedIds(competitors.filter((c) => c.selected).map((c) => c.id));
   }, [competitors]);

   const toggle = (id: number) => {
      setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
   };

   const busy = !!loading || !!scanning;
   const empty = competitors.length === 0 && !busy;

   const th: React.CSSProperties = {
      fontSize: 13, fontWeight: 500, color: '#71717B', fontFamily: FONT,
      textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #F4F4F5', whiteSpace: 'nowrap',
   };
   const td: React.CSSProperties = { padding: '10px 12px', borderBottom: '1px solid #F4F4F5', verticalAlign: 'middle' };

   return (
      <div
         onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
         style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      >
         <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
         <div style={{ position: 'relative', width: '100%', maxWidth: 1000, maxHeight: '85vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', animation: 'growOut 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <button
               type="button"
               onClick={onClose}
               aria-label="Close"
               style={{ position: 'absolute', right: 8, top: 8, padding: 8, border: 'none', background: 'transparent', color: '#9CA3AF', cursor: 'pointer', display: 'inline-flex', transition: 'color 150ms ease, transform 150ms ease', zIndex: 1 }}
               onMouseEnter={(e) => { e.currentTarget.style.color = '#374151'; e.currentTarget.style.transform = 'rotate(90deg)'; }}
               onMouseLeave={(e) => { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.transform = 'none'; }}
            >
               <CloseIcon />
            </button>

            <div style={{ padding: '24px 24px 16px', flexShrink: 0 }}>
               <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#18181B', fontFamily: FONT, paddingRight: 32, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={keyword}>{keyword}</h2>
               <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 500, color: '#52525C', fontFamily: FONT }}>Organic Competitors</p>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '0 24px' }} className="styled-scrollbar">
               {busy && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '80px 0', color: '#52525C', fontFamily: FONT, fontSize: 14 }}>
                     <Spinner />
                     <span>Scanning the SERP…</span>
                  </div>
               )}

               {empty && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '72px 0' }}>
                     <p style={{ margin: 0, fontSize: 14, color: '#52525C', fontFamily: FONT }}>No competitors scanned yet for this keyword.</p>
                     <button
                        type="button"
                        onClick={onScan}
                        style={{ border: 'none', background: '#2F2F34', color: '#fff', borderRadius: 6, padding: '8px 16px', fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', transition: 'background 150ms ease' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#783AFB'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#2F2F34'; }}
                     >
                        Scan competitors
                     </button>
                  </div>
               )}

               {!busy && !empty && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT }}>
                     <thead>
                        <tr>
                           <th style={{ ...th, width: 48 }} aria-label="Toggle" />
                           <th style={{ ...th, width: 48, textAlign: 'center' }}>Pos.</th>
                           <th style={th}>Competitor</th>
                           <th style={{ ...th, width: 90, textAlign: 'center' }}>SEO Score</th>
                           <th style={{ ...th, width: 80, textAlign: 'center' }}>Authority</th>
                           <th style={{ ...th, width: 80, textAlign: 'right' }}>Words</th>
                        </tr>
                     </thead>
                     <tbody>
                        {competitors.map((c) => {
                           const on = selectedIds.includes(c.id);
                           const dim: React.CSSProperties = on ? {} : { opacity: 0.6 };
                           return (
                              <tr key={c.id}>
                                 <td style={{ ...td, textAlign: 'center' }}>
                                    <Toggle checked={on} onChange={() => toggle(c.id)} />
                                 </td>
                                 <td style={{ ...td, textAlign: 'center', ...dim }}>
                                    <span style={{ fontSize: 13, fontWeight: 500, color: '#18181B' }}>{c.position}</span>
                                 </td>
                                 <td style={{ ...td, ...dim, maxWidth: 440 }}>
                                    <div style={{ display: 'flex', gap: 10 }}>
                                       { /* eslint-disable-next-line @next/next/no-img-element */ }
                                       <img alt="" src={favicon(c.domain)} width={16} height={16} style={{ borderRadius: 3, flexShrink: 0, marginTop: 3 }} />
                                       <div style={{ minWidth: 0 }}>
                                          <a
                                             href={c.url}
                                             target="_blank"
                                             rel="noopener noreferrer"
                                             title={c.url}
                                             style={{ display: 'block', fontSize: 12, color: '#783AFB', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                             onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                                             onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                                          >
                                             {c.domain || c.url}
                                          </a>
                                          <div style={{ fontSize: 14, fontWeight: 500, color: '#18181B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.title}>{c.title}</div>
                                          {c.snippet && (
                                             <div style={{ marginTop: 2, fontSize: 12, color: '#71717B', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.snippet}</div>
                                          )}
                                       </div>
                                    </div>
                                 </td>
                                 <td style={{ ...td, textAlign: 'center', ...dim }}>
                                    <div style={{ display: 'inline-flex' }}>
                                       <Gauge score={c.seoScore} size="sm" />
                                    </div>
                                 </td>
                                 <td style={{ ...td, textAlign: 'center', ...dim }}>
                                    <AuthorityBadge value={c.authority} />
                                 </td>
                                 <td style={{ ...td, textAlign: 'right', ...dim }}>
                                    <span style={{ fontSize: 13, fontWeight: 500, color: '#18181B' }}>{c.wordCount.toLocaleString()}</span>
                                 </td>
                              </tr>
                           );
                        })}
                     </tbody>
                  </table>
               )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: 16, borderTop: '1px solid #F4F4F5', flexShrink: 0 }}>
               <button
                  type="button"
                  onClick={onScan}
                  disabled={busy}
                  style={{ border: 'none', boxShadow: 'inset 0 0 0 1px #E4E4E7', background: 'transparent', color: '#3F3F47', borderRadius: 8, padding: '8px 16px', fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.5 : 1, transition: 'background 150ms ease' }}
                  onMouseEnter={(e) => { if (!busy) e.currentTarget.style.background = '#F4F4F5'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
               >
                  Rescan
               </button>
               <div style={{ display: 'flex', gap: 8 }}>
                  <button
                     type="button"
                     onClick={onClose}
                     style={{ border: 'none', boxShadow: 'inset 0 0 0 1px #E4E4E7', background: 'transparent', color: '#3F3F47', borderRadius: 8, padding: '8px 16px', fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', transition: 'background 150ms ease' }}
                     onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F4F5'; }}
                     onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                     Cancel
                  </button>
                  <button
                     type="button"
                     onClick={() => onConfirm(selectedIds)}
                     style={{ border: 'none', background: '#2F2F34', color: '#fff', borderRadius: 6, padding: '8px 16px', fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', transition: 'background 150ms ease' }}
                     onMouseEnter={(e) => { e.currentTarget.style.background = '#783AFB'; }}
                     onMouseLeave={(e) => { e.currentTarget.style.background = '#2F2F34'; }}
                  >
                     Let&apos;s go
                  </button>
               </div>
            </div>
         </div>
      </div>
   );
};

export default CompetitorsModal;
