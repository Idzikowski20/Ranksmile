import React, { useEffect, useState } from 'react';
import { CompetitorDTO } from '../../lib/competitorTypes';
import { useCompetitors, useScanCompetitors, useSelectCompetitors } from '../../services/competitors';
import { Gauge } from '../core';
import { Toggle } from '../core';
import AuthorityBadge from './AuthorityBadge';
import DomainFavicon from '../common/DomainFavicon';

const FONT = 'var(--font-family-primary)';

const Spinner = () => (
   <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ animation: 'spin 0.7s linear infinite' }}>
      <circle cx="12" cy="12" r="9" stroke="#E4E4E7" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="#783AFB" strokeWidth="3" strokeLinecap="round" />
   </svg>
);

interface Props {
   slug: string | undefined;
   keyword: string;
   onSelectionChange?: () => void;
   onSavingChange?: (saving: boolean) => void;
}

/**
 * The single reusable "Organic Competitors" unit — self-contained: owns the data query,
 * scan + select mutations, and local toggle state. Used by both the Audit tool modal and
 * the Content Editor settings modal. Toggling a row persists the selection immediately.
 */
const CompetitorsSection = ({ slug, keyword, onSelectionChange, onSavingChange }: Props) => {
   const compQ = useCompetitors(slug, keyword);
   const scanM = useScanCompetitors(slug);
   const selectM = useSelectCompetitors(slug);

   const competitors: CompetitorDTO[] = compQ.data?.competitors || [];
   const [selectedIds, setSelectedIds] = useState<number[]>(() => competitors.filter((c) => c.selected).map((c) => c.id));

   // Re-seed local selection whenever a fresh competitor list arrives (scan/refetch swaps identity).
   useEffect(() => {
      setSelectedIds(competitors.filter((c) => c.selected).map((c) => c.id));
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [compQ.data?.competitors]);

   // Surface the selection-save in-flight state so a parent modal can gate its confirm button.
   useEffect(() => {
      onSavingChange?.(selectM.isLoading);
   }, [selectM.isLoading, onSavingChange]);

   const toggle = (id: number) => {
      const next = selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id];
      setSelectedIds(next);
      selectM.mutate({ keyword, selectedIds: next });
      onSelectionChange?.();
   };

   const loading = compQ.isLoading || compQ.isFetching;
   const scanning = scanM.isLoading;
   const empty = competitors.length === 0 && !loading && !scanning;

   const th: React.CSSProperties = {
      fontSize: 13, fontWeight: 500, color: '#71717B', fontFamily: FONT,
      textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #F4F4F5', whiteSpace: 'nowrap',
   };
   const td: React.CSSProperties = { padding: '10px 12px', borderBottom: '1px solid #F4F4F5', verticalAlign: 'middle' };

   return (
      <div>
         <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>

         {(loading || scanning) && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '80px 0', color: '#52525C', fontFamily: FONT, fontSize: 14 }}>
               <Spinner />
               <span>{scanning ? 'Scanning the SERP…' : 'Loading…'}</span>
            </div>
         )}

         {empty && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '72px 0' }}>
               <p style={{ margin: 0, fontSize: 14, color: '#52525C', fontFamily: FONT }}>No competitors scanned yet for this keyword.</p>
               <button
                  type="button"
                  onClick={() => scanM.mutate({ keyword })}
                  style={{ border: 'none', background: '#2F2F34', color: '#fff', borderRadius: 6, padding: '8px 16px', fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', transition: 'background 150ms ease' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#783AFB'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#2F2F34'; }}
               >
                  Scan competitors
               </button>
            </div>
         )}

         {!loading && !scanning && !empty && (
            <>
               <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                  <button
                     type="button"
                     onClick={() => scanM.mutate({ keyword })}
                     style={{ border: 'none', boxShadow: 'inset 0 0 0 1px #E4E4E7', background: 'transparent', color: '#3F3F47', borderRadius: 8, padding: '6px 16px', fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', transition: 'background 150ms ease' }}
                     onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F4F5'; }}
                     onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                     Rescan
                  </button>
               </div>
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
                                 <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                    <span style={{ display: 'inline-flex', flexShrink: 0, width: 16, height: 16, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                                       <DomainFavicon domain={c.domain} size={16} style={{ borderRadius: 3 }} />
                                    </span>
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
            </>
         )}
      </div>
   );
};

export default CompetitorsSection;
