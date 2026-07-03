import React, { useEffect, useMemo, useState } from 'react';
import { SourceRow, splitSourceUrl } from './SourcesTable';
import MetricTrendChart from './MetricTrendChart';
import { SkeletonBox } from './SkeletonBlocks';
import { AI_VIS_MODEL_LABEL } from '../../lib/aiVisibility';
import { useAiVisSourceDetail } from '../../services/aiVisibility';

const FONT = 'var(--font-family-primary)';
const faviconFor = (d: string) => `https://www.google.com/s2/favicons?domain=${d}&sz=32`;

type Sentiment = 'positive' | 'neutral' | 'negative' | 'mixed';
const SENT: Record<Sentiment, { label: string; fg: string; bg: string }> = {
   positive: { label: 'Positive', fg: '#1AB25E', bg: '#EAF8F0' },
   neutral: { label: 'Neutral', fg: '#52525C', bg: '#F4F4F5' },
   negative: { label: 'Negative', fg: '#FF6F77', bg: '#FDECED' },
   mixed: { label: 'Mixed', fg: '#D97706', bg: '#FEF3E2' },
};

const SentBadge = ({ sentiment }: { sentiment: Sentiment }) => {
   const s = SENT[sentiment] || SENT.neutral;
   return <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 600, color: s.fg, background: s.bg }}>{s.label}</span>;
};

const Chevron = ({ open }: { open: boolean }) => (<svg viewBox="0 0 24 24" width="18" height="18" style={{ transition: 'transform 200ms ease', transform: open ? 'rotate(-180deg)' : 'none', color: '#71717B', flexShrink: 0 }}><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m19.5 8.25l-7.5 7.5l-7.5-7.5" /></svg>);
const Globe = () => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" style={{ flexShrink: 0, color: '#9F9FA9' }}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" /><path d="M3 12h18M12 3c2.4 2.5 2.4 15.5 0 18M12 3c-2.4 2.5-2.4 15.5 0 18" stroke="currentColor" strokeWidth="1.5" /></svg>);
const SortArrow = ({ asc }: { asc: boolean }) => (<svg viewBox="0 0 20 20" width="16" height="16" style={{ transform: asc ? 'none' : 'rotate(180deg)', color: '#9F9FA9', flexShrink: 0 }}><path fill="currentColor" fillRule="evenodd" d="M10 17a.75.75 0 0 1-.75-.75V5.612L5.29 9.77a.75.75 0 0 1-1.08-1.04l5.25-5.5a.75.75 0 0 1 1.08 0l5.25 5.5a.75.75 0 1 1-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0 1 10 17" clipRule="evenodd" /></svg>);

type BrandDetail = { pos: number; brand: string; sentiment: Sentiment; quotes: string[] };

/** One brand row + expandable per-quote sub-rows (grid [1fr 120px]), matching the
 *  reference table: Pos | Brand + sentiment + chevron, quotes nested underneath. */
const BrandDetailRow = ({ b, first }: { b: BrandDetail; first: boolean }) => {
   const [open, setOpen] = useState(false);
   const hasQuotes = b.quotes.length > 0;
   return (
      <div>
         {!first ? <div style={{ height: 1, background: '#F4F4F5' }} /> : null}
         <div
            className="aiv-brandrow"
            onClick={() => hasQuotes && setOpen((o) => !o)}
            role={hasQuotes ? 'button' : undefined}
            tabIndex={hasQuotes ? 0 : undefined}
            onKeyDown={(e) => { if (hasQuotes && e.key === 'Enter') setOpen((o) => !o); }}
            style={{ display: 'grid', gridTemplateColumns: '74px 1fr', cursor: hasQuotes ? 'pointer' : 'default' }}
         >
            <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start', color: '#18181B', fontSize: 14 }}>{b.pos}</div>
            <div style={{ borderLeft: '1px solid #F4F4F5', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
               <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                     <Globe />
                     <span style={{ fontSize: 14, fontWeight: 500, color: '#18181B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.brand}</span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                     <SentBadge sentiment={b.sentiment} />
                     {hasQuotes ? <Chevron open={open} /> : null}
                  </span>
               </div>
               {open && hasQuotes ? (
                  <div>
                     {b.quotes.map((q) => (
                        <React.Fragment key={q}>
                           <div style={{ height: 1, background: '#F4F4F5' }} />
                           <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px' }}>
                              <div style={{ padding: '12px 16px', fontSize: 14, color: '#52525C', lineHeight: 1.5 }}>{q}</div>
                              <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start' }}><SentBadge sentiment={b.sentiment} /></div>
                           </div>
                        </React.Fragment>
                     ))}
                  </div>
               ) : null}
            </div>
         </div>
      </div>
   );
};

const fmtDay = (iso: string | null): string => {
   if (!iso) return '';
   const d = new Date(iso);
   if (Number.isNaN(d.getTime())) return '';
   return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const ArrowUp = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const ArrowDown = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const ExternalIcon = () => (<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><g fill="currentColor" fillRule="evenodd" clipRule="evenodd"><path d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5z" /><path d="M6.194 12.753a.75.75 0 0 0 1.06.053L16.5 4.44v2.81a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.553l-9.056 8.194a.75.75 0 0 0-.053 1.06" /></g></svg>);
const CloseIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>);

const iconBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', padding: 4, color: '#52525C', cursor: 'pointer', borderRadius: 6 };

/** Right-side slide-over for a source row. When `navigable`, the up/down arrows (and
 *  ↑/↓ keys) page through the surrounding list — SurferSEO's ungrouped behaviour. */
const SourceDetailModal = ({ slug, list, index, navigable, onNavigate, onClose }: {
   slug: string | undefined;
   list: SourceRow[];
   index: number;
   navigable: boolean;
   onNavigate: (delta: number) => void;
   onClose: () => void;
}) => {
   const s = list[index];
   const detailQ = useAiVisSourceDetail(slug, s ? s.url : null);
   const detail = detailQ.data;
   const [posAsc, setPosAsc] = useState(true);
   const sortedBrands = useMemo(
      () => [...(detail?.brands || [])].sort((a, b) => (posAsc ? a.pos - b.pos : b.pos - a.pos)),
      [detail, posAsc],
   );

   useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
         if (e.key === 'Escape') onClose();
         if (navigable && e.key === 'ArrowUp') { e.preventDefault(); onNavigate(-1); }
         if (navigable && e.key === 'ArrowDown') { e.preventDefault(); onNavigate(1); }
      };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
   }, [navigable, onNavigate, onClose]);

   if (!s) return null;
   const { host, path } = splitSourceUrl(s.url, s.domain);
   const canUp = navigable && index > 0;
   const canDown = navigable && index < list.length - 1;

   return (
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(9,9,11,0.4)', display: 'flex', justifyContent: 'flex-end' }} role="presentation">
         <style>{'@keyframes aivSlideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}.aiv-brandrow:hover{background:#FAFAFA}'}</style>
         <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', width: 680, maxWidth: '100%', height: '100vh', overflow: 'auto', boxShadow: '-24px 0 64px rgba(0,0,0,0.2)', animation: 'aivSlideIn 0.25s cubic-bezier(0.16,1,0.3,1)', fontFamily: FONT }} role="dialog" aria-modal="true">
            {/* Header: nav arrows (left) + external/close (right), then the source URL */}
            <div style={{ position: 'sticky', top: 0, zIndex: 2, background: '#fff', padding: 24, display: 'flex', flexDirection: 'column', gap: 16, borderBottom: '1px solid #F4F4F5' }}>
               <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                     {navigable ? (
                        <>
                           <button type="button" aria-label="Previous source" disabled={!canUp} onClick={() => onNavigate(-1)} style={{ ...iconBtn, opacity: canUp ? 1 : 0.35, cursor: canUp ? 'pointer' : 'not-allowed' }}><ArrowUp /></button>
                           <button type="button" aria-label="Next source" disabled={!canDown} onClick={() => onNavigate(1)} style={{ ...iconBtn, opacity: canDown ? 1 : 0.35, cursor: canDown ? 'pointer' : 'not-allowed' }}><ArrowDown /></button>
                        </>
                     ) : null}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                     <a href={s.url} target="_blank" rel="noopener noreferrer" aria-label="Open source" style={{ ...iconBtn, textDecoration: 'none' }}><ExternalIcon /></a>
                     <button type="button" aria-label="Close" onClick={onClose} style={iconBtn}><CloseIcon /></button>
                  </div>
               </div>
               <h2 style={{ margin: 0, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                     { /* eslint-disable-next-line @next/next/no-img-element */ }
                     <img alt="" src={faviconFor(s.domain)} width={20} height={20} style={{ borderRadius: 4, flexShrink: 0 }} />
                     <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 16 }}>
                        <span style={{ fontWeight: 600, color: '#18181B' }}>{host}</span>
                        <span style={{ fontWeight: 400, color: '#9F9FA9' }}>{path}</span>
                     </span>
                  </span>
               </h2>
            </div>

            {/* Body: real per-source data from the latest scan */}
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ border: '1px solid #F4F4F5', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                     <span style={{ fontSize: 13, color: '#71717B' }}>Times shown</span>
                     <span style={{ fontSize: 24, fontWeight: 700, color: '#18181B' }}>{s.timesShown}</span>
                  </div>
                  <div style={{ border: '1px solid #F4F4F5', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                     <span style={{ fontSize: 13, color: '#71717B' }}>Models</span>
                     <span style={{ fontSize: 24, fontWeight: 700, color: '#18181B' }}>{s.models.length}</span>
                  </div>
               </div>
               <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#18181B', marginBottom: 8 }}>Cited by</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                     {s.models.map((m) => (
                        <span key={m} style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid #E4E4E7', borderRadius: 9999, padding: '4px 12px', fontSize: 13, fontWeight: 500, color: '#3F3F47' }}>{AI_VIS_MODEL_LABEL[m] || m}</span>
                     ))}
                  </div>
                  <p style={{ margin: '12px 0 0', fontSize: 13, color: '#9F9FA9', lineHeight: 1.5 }}>Engines that cited this page for your tracked prompts in the latest scan.</p>
               </div>

               {/* Times-shown trend across scans */}
               <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#18181B', marginBottom: 8 }}>Times shown over time</div>
                  {detailQ.isLoading ? (
                     <SkeletonBox w={600} h={200} />
                  ) : (detail && detail.history.length > 1) ? (
                     <MetricTrendChart
                        labels={detail.history.map((h) => fmtDay(h.finishedAt))}
                        lines={[{ label: 'Times shown', data: detail.history.map((h) => h.timesShown), color: '#783AFB' }]}
                        yMin={0}
                        height={200}
                     />
                  ) : (
                     <p style={{ margin: 0, fontSize: 13, color: '#9F9FA9' }}>Not enough scan history yet — the trend appears after two or more scans.</p>
                  )}
               </div>

               {/* Brands mentioned in answers that cite this source */}
               {detailQ.isLoading ? (
                  <SkeletonBox w={600} h={160} />
               ) : (detail && sortedBrands.length > 0) ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                     <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: '#18181B' }}>Source mentioned {detail.brandCount} brands</span>
                        <span style={{ fontSize: 13, color: '#71717B', lineHeight: 1.5 }}>You should be mentioned as the first choice, review the list and check if you can improve your position by contacting the source owner.</span>
                     </div>
                     <div style={{ border: '1px solid #F4F4F5', borderRadius: 12, overflow: 'hidden' }}>
                        {/* Table header */}
                        <div style={{ display: 'grid', gridTemplateColumns: '74px 1fr', borderBottom: '1px solid #F4F4F5', fontSize: 13, color: '#71717B' }}>
                           <div style={{ padding: '12px 16px' }}>
                              <button type="button" onClick={() => setPosAsc((v) => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: FONT, color: '#71717B' }}>
                                 <span style={{ fontWeight: 600, textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 4, textDecorationColor: '#C4C4CC' }}>Pos.</span>
                                 <SortArrow asc={posAsc} />
                              </button>
                           </div>
                           <div style={{ borderLeft: '1px solid #F4F4F5', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span>Brand</span>
                              <span>Sentiment</span>
                           </div>
                        </div>
                        {sortedBrands.map((b, i) => <BrandDetailRow key={`${b.pos}-${b.brand}`} b={b} first={i === 0} />)}
                     </div>
                  </div>
               ) : (
                  <div>
                     <div style={{ fontSize: 14, fontWeight: 600, color: '#18181B', marginBottom: 8 }}>Brands mentioned</div>
                     <p style={{ margin: 0, fontSize: 13, color: '#9F9FA9' }}>No brands were detected in the AI answers citing this source.</p>
                  </div>
               )}
            </div>
         </div>
      </div>
   );
};

export default SourceDetailModal;
