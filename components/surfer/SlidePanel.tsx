import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { XIcon } from './icons';
import Gauge from './Gauge';

const font = 'var(--font-family-primary)';

// ── Helpers ───────────────────────────────────────────────────────────────────

function compactNum(n: number): string {
   if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
   if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
   return String(Math.round(n));
}

function timeAgo(date: string | null | undefined): string {
   if (!date) return 'recently';
   try {
      const ms = Date.now() - new Date(date).getTime();
      const mins = Math.floor(ms / 60000);
      if (mins < 2) return 'just now';
      if (mins < 60) return `${mins} minutes ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours} hours ago`;
      const days = Math.floor(hours / 24);
      if (days < 30) return `${days} days ago`;
      return `${Math.floor(days / 30)} months ago`;
   } catch { return 'recently'; }
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const IconButton = ({ children, onClick, href, ariaLabel }: { children: React.ReactNode; onClick?: () => void; href?: string; ariaLabel: string }) => {
   const style: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: '#52525C', cursor: 'pointer', padding: 0, transition: 'opacity 150ms ease' };
   const hover = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.opacity = '0.7'; };
   const out = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.opacity = '1'; };
   if (href) {
      return <a href={href} target="_blank" rel="noopener noreferrer" aria-label={ariaLabel} style={{ ...style, textDecoration: 'none' }} onMouseEnter={hover} onMouseLeave={out}>{children}</a>;
   }
   return <button type="button" aria-label={ariaLabel} onClick={onClick} style={style} onMouseEnter={hover} onMouseLeave={out}>{children}</button>;
};

const DotsIcon = () => (
   <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6.75 12a.75.75 0 1 1-1.5 0a.75.75 0 0 1 1.5 0m6 0a.75.75 0 1 1-1.5 0a.75.75 0 0 1 1.5 0m6 0a.75.75 0 1 1-1.5 0a.75.75 0 0 1 1.5 0" /></svg>
);
const ExternalLinkIcon = () => (
   <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden="true"><g fillRule="evenodd" clipRule="evenodd"><path d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5z" /><path d="M6.194 12.753a.75.75 0 0 0 1.06.053L16.5 4.44v2.81a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.553l-9.056 8.194a.75.75 0 0 0-.053 1.06" /></g></svg>
);
const PencilIcon = () => (
   <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}><g><path d="m5.433 13.917l1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65" /><path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25z" /></g></svg>
);
const RefreshIcon = ({ spinning }: { spinning?: boolean }) => (
   <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" style={{ flexShrink: 0, animation: spinning ? 'spin 0.7s linear infinite' : 'none' }}><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
);

// ── Types ─────────────────────────────────────────────────────────────────────

type RecommRow = {
   id: number | string;
   title: string;
   url: string;
   keyword: string;
   content_score: number;
   position: number;
   clicks: number;
   impressions: number;
   status: string;
   source?: string;
   meta_title?: string | null;
   word_count?: number;
   updatedAt?: string | null;
};

// ── Metric box (Last 30d / Prev. 30d / Change) ────────────────────────────────

const MetricBox = ({ label, cells }: { label: string; cells: { value: React.ReactNode; sub: string }[] }) => (
   <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#18181B', fontFamily: font }}>{label}</p>
      <div style={{ display: 'flex', border: '1px solid #E4E4E7', borderRadius: 8 }}>
         {cells.map((c, i) => (
            <React.Fragment key={c.sub}>
               {i > 0 && <div role="separator" style={{ width: 1, alignSelf: 'stretch', background: '#F4F4F5' }} />}
               <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '12px 16px', flex: 1, minWidth: 0, alignItems: 'flex-start', justifyContent: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#18181B', fontFamily: font }}>{c.value}</span>
                  <span style={{ fontSize: 13, color: '#52525C', fontFamily: font }}>{c.sub}</span>
               </div>
            </React.Fragment>
         ))}
      </div>
   </div>
);

// ── Slide panel ───────────────────────────────────────────────────────────────

function SlidePanel({ row, onClose, onRefresh, onChangeKeyword, analyzing }: {
   row: RecommRow | null;
   onClose: () => void;
   onRefresh?: (r: RecommRow, e: React.MouseEvent) => void;
   onChangeKeyword?: (r: RecommRow) => void;
   analyzing?: boolean;
}) {
   const router = useRouter();
   const [visible, setVisible] = useState(false);

   useEffect(() => {
      if (row) {
         const t = setTimeout(() => setVisible(true), 10);
         return () => clearTimeout(t);
      }
      setVisible(false);
      return undefined;
   }, [row]);

   const handleClose = () => { setVisible(false); setTimeout(onClose, 220); };
   if (!row) return null;

   const targetScore = row.content_score || 0;

   return (
      <>
         <div onClick={handleClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.12)', opacity: visible ? 1 : 0, transition: 'opacity 200ms ease' }} />
         <div style={{ position: 'fixed', top: 8, bottom: 8, right: 8, width: 420, maxWidth: 'calc(100vw - 16px)', zIndex: 301, background: '#fff', borderRadius: 16, boxShadow: '0px 24px 64px rgba(0,0,0,0.16), 0px 8px 24px rgba(0,0,0,0.08)', border: '1px solid #E4E4E7', display: 'flex', flexDirection: 'column', overflow: 'hidden', transform: visible ? 'translateX(0)' : 'translateX(calc(100% + 16px))', transition: 'transform 220ms cubic-bezier(0.16,1,0.3,1)' }}>

            {/* Header: PAGE label + actions + close */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '20px 24px 12px', gap: 12 }}>
               <p style={{ flex: 1, margin: 0, fontSize: 13, fontWeight: 600, color: '#52525C', fontFamily: font, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Page</p>
               <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingRight: 16 }}>
                  <IconButton ariaLabel="More options"><DotsIcon /></IconButton>
                  {row.url && <IconButton href={row.url} ariaLabel="Open url in new tab"><ExternalLinkIcon /></IconButton>}
               </div>
               <IconButton ariaLabel="Close" onClick={handleClose}><XIcon /></IconButton>
            </div>

            {/* Body */}
            <div className="styled-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '0 24px 32px' }}>
               <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

                  {/* Title + editable keyword */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                     <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#18181B', fontFamily: font, lineHeight: '24px' }}>{row.title}</h2>
                     <button
                        type="button"
                        onClick={() => onChangeKeyword?.(row)}
                        className="rec-keyword-edit"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start', maxWidth: '100%', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: font, fontSize: 14, color: '#18181B' }}
                     >
                        <span className="rec-keyword-text" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.keyword || 'Set keyword'}</span>
                        <span className="rec-keyword-pencil" style={{ display: 'inline-flex', color: '#18181B', opacity: 1, transition: 'opacity 150ms ease' }}><PencilIcon /></span>
                     </button>
                  </div>

                  {/* SEO Score + gauge */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                     <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#3F3F47', fontFamily: font }}>SEO Score</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                           <span style={{ fontSize: 13, color: '#52525C', fontFamily: font }}>
                              Updated <span style={{ textDecoration: 'underline dotted', textUnderlineOffset: 4, textDecorationColor: '#9F9FA9' }}>{timeAgo(row.updatedAt)}</span>
                           </span>
                           {onRefresh && (
                              <button
                                 type="button"
                                 onClick={(e) => onRefresh(row, e)}
                                 disabled={analyzing}
                                 style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', padding: 0, fontSize: 13, fontWeight: 600, color: '#3F3F47', fontFamily: font, cursor: analyzing ? 'default' : 'pointer', opacity: analyzing ? 0.6 : 1 }}
                              >
                                 <RefreshIcon spinning={analyzing} />
                                 {analyzing ? 'Analyzing…' : 'Refresh'}
                              </button>
                           )}
                        </div>
                     </div>
                     <div style={{ width: 280, maxWidth: '100%', margin: '0 auto' }}>
                        <Gauge score={targetScore} size="md" />
                     </div>
                  </div>

                  {/* Optimize */}
                  <button
                     type="button"
                     onClick={() => router.push(`/articles/${row.id}`)}
                     style={{ display: 'block', width: '100%', padding: '12px 24px', background: '#18181B', color: '#fff', borderRadius: 8, fontSize: 16, fontWeight: 600, fontFamily: font, border: 'none', cursor: 'pointer', transition: 'background 180ms ease' }}
                     onMouseEnter={(e) => { e.currentTarget.style.background = '#F29964'; }}
                     onMouseLeave={(e) => { e.currentTarget.style.background = '#18181B'; }}
                  >
                     Optimize
                  </button>

                  {/* Metrics */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                     <MetricBox
                        label="Main keyword position"
                        cells={[
                           { value: row.position > 0 ? row.position.toFixed(1) : '—', sub: 'Last 30d' },
                           { value: '—', sub: 'Prev. 30d' },
                           { value: '—', sub: 'Change' },
                        ]}
                     />
                     <MetricBox
                        label="Traffic"
                        cells={[
                           { value: compactNum(row.clicks || 0), sub: 'Last 30d' },
                           { value: '—', sub: 'Prev. 30d' },
                           { value: '—', sub: 'Change' },
                        ]}
                     />
                     <MetricBox
                        label="Impressions"
                        cells={[
                           { value: compactNum(row.impressions || 0), sub: 'Last 30d' },
                           { value: '—', sub: 'Prev. 30d' },
                           { value: '—', sub: 'Change' },
                        ]}
                     />
                  </div>
               </div>
            </div>
         </div>
      </>
   );
}

export default SlidePanel;
