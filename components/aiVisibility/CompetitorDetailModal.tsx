import React, { useEffect, useMemo, useState } from 'react';
import MetricTrendChart from './MetricTrendChart';
import { SkeletonBox } from './SkeletonBlocks';
import HoverTooltip from '../common/HoverTooltip';
import { useAiVisCompetitorDetail, useAiVisHistory } from '../../services/aiVisibility';

const FONT = 'var(--font-family-primary)';
const faviconFor = (d: string) => `https://www.google.com/s2/favicons?domain=${d}&sz=32`;
const brandName = (d: string) => { const base = d.replace(/^www\./, '').split('.')[0]; return base.charAt(0).toUpperCase() + base.slice(1); };

const InfoIcon = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: '#9F9FA9', flexShrink: 0 }}><path d="M12 16v-4M12 8h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const ArrowUp = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const ArrowDown = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const CloseIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const SortArrow = ({ asc }: { asc: boolean }) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ transform: asc ? 'rotate(180deg)' : 'none' }}><path d="M12 5v14m0 0l-5-5m5 5l5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);

const iconBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', padding: 4, color: '#52525C', cursor: 'pointer', borderRadius: 6 };

const fmtDay = (iso: string | null): string => {
   if (!iso) return '';
   const d = new Date(iso);
   return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const StatCard = ({ label, value, hint }: { label: string; value: React.ReactNode; hint: string }) => (
   <div style={{ border: '1px solid #F4F4F5', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#71717B' }}>
         {label}<HoverTooltip label={hint} align="center"><span style={{ display: 'inline-flex', cursor: 'help' }}><InfoIcon /></span></HoverTooltip>
      </span>
      <span style={{ fontSize: 24, fontWeight: 700, color: '#18181B' }}>{value}</span>
   </div>
);

type Metric = 'visibilityScore' | 'mentionRate' | 'avgPosition';
const METRICS: Array<{ key: Metric; label: string }> = [
   { key: 'visibilityScore', label: 'Visibility score' },
   { key: 'mentionRate', label: 'Mention rate' },
   { key: 'avgPosition', label: 'Avg. position' },
];

const Segmented = ({ value, onChange }: { value: Metric; onChange: (m: Metric) => void }) => (
   <div style={{ display: 'inline-flex', gap: 4, background: '#F4F4F5', borderRadius: 10, padding: 4 }}>
      {METRICS.map((m) => (
         <button key={m.key} type="button" onClick={() => onChange(m.key)} style={{ border: 'none', borderRadius: 7, padding: '6px 12px', fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', background: value === m.key ? '#fff' : 'transparent', color: value === m.key ? '#18181B' : '#52525C', boxShadow: value === m.key ? '0 1px 2px rgba(0,0,0,0.06)' : 'none' }}>{m.label}</button>
      ))}
   </div>
);

const cell: React.CSSProperties = { padding: '12px 16px', fontSize: 14, fontFamily: FONT, display: 'flex', alignItems: 'center', boxSizing: 'border-box' };

type SourceRow = { url: string; domain: string; timesShown: number; mentioned?: boolean };
const splitUrl = (url: string, fallback: string) => { try { const u = new URL(url); return { host: u.host, path: `${u.pathname}${u.search}` }; } catch { return { host: fallback, path: '' }; } };

/** Compact Source | Mentioned | Times shown table with "View more" paging. */
const SourcesMini = ({ title, subtitle, sources }: { title: string; subtitle: string; sources: SourceRow[] }) => {
   const [visible, setVisible] = useState(5);
   const sorted = useMemo(() => [...sources].sort((a, b) => b.timesShown - a.timesShown), [sources]);
   return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
         <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#18181B' }}>{title} <span style={{ color: '#9F9FA9', fontWeight: 400 }}>{sources.length}</span></span>
            <span style={{ fontSize: 13, color: '#71717B' }}>{subtitle}</span>
         </div>
         {sorted.length === 0 ? (
            <div style={{ border: '1px solid #F4F4F5', borderRadius: 12, padding: '24px', textAlign: 'center', fontSize: 13, color: '#9F9FA9' }}>No sources yet.</div>
         ) : (
            <div style={{ border: '1px solid #F4F4F5', borderRadius: 12, overflow: 'hidden' }}>
               <div style={{ display: 'flex', borderBottom: '1px solid #F4F4F5', fontSize: 13, color: '#71717B' }}>
                  <div style={{ ...cell, flex: 1, minWidth: 0 }}>Source</div>
                  <div style={{ ...cell, width: 110, flexShrink: 0, justifyContent: 'center', borderLeft: '1px solid #F4F4F5' }}>Mentioned</div>
                  <div style={{ ...cell, width: 130, flexShrink: 0, justifyContent: 'flex-end', borderLeft: '1px solid #F4F4F5' }}>Times shown</div>
               </div>
               {sorted.slice(0, visible).map((s) => {
                  const { host, path } = splitUrl(s.url, s.domain);
                  return (
                     <div key={s.url} style={{ display: 'flex', borderTop: '1px solid #F4F4F5' }}>
                        <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ ...cell, flex: 1, minWidth: 0, gap: 8, textDecoration: 'none', color: 'inherit' }}>
                           { /* eslint-disable-next-line @next/next/no-img-element */ }
                           <img alt="" src={faviconFor(s.domain)} width={18} height={18} style={{ borderRadius: 4, flexShrink: 0 }} />
                           <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <span style={{ fontWeight: 500, color: '#18181B' }}>{host}</span>
                              <span style={{ color: '#9F9FA9' }}>{path}</span>
                           </span>
                        </a>
                        <div style={{ ...cell, width: 110, flexShrink: 0, justifyContent: 'center', borderLeft: '1px solid #F4F4F5', color: s.mentioned ? '#18181B' : '#71717B' }}>{s.mentioned ? 'Yes' : 'No'}</div>
                        <div style={{ ...cell, width: 130, flexShrink: 0, justifyContent: 'flex-end', borderLeft: '1px solid #F4F4F5', fontWeight: 600, color: '#18181B' }}>{s.timesShown}</div>
                     </div>
                  );
               })}
            </div>
         )}
         {sorted.length > visible ? (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
               <button type="button" onClick={() => setVisible((v) => v + 10)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', color: '#18181B', fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer' }}>View more <SortArrow asc={false} /></button>
            </div>
         ) : null}
      </div>
   );
};

const PromptsTable = ({ prompts }: { prompts: Array<{ promptId: number; text: string; avgPosition: number | null }> }) => {
   const [asc, setAsc] = useState(true);
   const sorted = useMemo(() => [...prompts].sort((a, b) => (asc ? (a.avgPosition ?? Infinity) - (b.avgPosition ?? Infinity) : (b.avgPosition ?? -Infinity) - (a.avgPosition ?? -Infinity))), [prompts, asc]);
   return (
      <div style={{ border: '1px solid #F4F4F5', borderRadius: 12, overflow: 'hidden' }}>
         <div style={{ display: 'flex', borderBottom: '1px solid #F4F4F5', fontSize: 13, color: '#71717B' }}>
            <div style={{ ...cell, flex: 1, minWidth: 0 }}>Prompt</div>
            <div style={{ ...cell, width: 160, flexShrink: 0, justifyContent: 'flex-end', borderLeft: '1px solid #F4F4F5' }}>
               <button type="button" onClick={() => setAsc((v) => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 600, color: '#52525C' }}>Avg. position <SortArrow asc={asc} /></button>
            </div>
         </div>
         {sorted.map((p) => (
            <div key={p.promptId} style={{ display: 'flex', borderTop: '1px solid #F4F4F5' }}>
               <div style={{ ...cell, flex: 1, minWidth: 0, color: '#18181B', lineHeight: 1.5 }}>{p.text}</div>
               <div style={{ ...cell, width: 160, flexShrink: 0, justifyContent: 'flex-end', color: p.avgPosition != null ? '#18181B' : '#9F9FA9' }}>{p.avgPosition != null ? p.avgPosition.toFixed(1) : '—'}</div>
            </div>
         ))}
      </div>
   );
};

/** Right slide-over for a competitor: stat cards, metric-toggle trend, its own
 *  sources, and per-prompt average position. */
const CompetitorDetailModal = ({ slug, list, index, onNavigate, onClose }: {
   slug: string | undefined;
   list: string[];
   index: number;
   onNavigate: (delta: number) => void;
   onClose: () => void;
}) => {
   const domain = list[index];
   const detailQ = useAiVisCompetitorDetail(slug, domain || null);
   const histQ = useAiVisHistory(slug, domain);
   const detail = detailQ.data;
   const [metric, setMetric] = useState<Metric>('visibilityScore');

   const [visible, setVisible] = useState(false);
   useEffect(() => { const t = setTimeout(() => setVisible(true), 10); return () => clearTimeout(t); }, []);
   const handleClose = () => { setVisible(false); setTimeout(onClose, 220); };

   const canUp = index > 0;
   const canDown = index < list.length - 1;
   useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
         if (e.key === 'Escape') handleClose();
         if (e.key === 'ArrowUp') { e.preventDefault(); onNavigate(-1); }
         if (e.key === 'ArrowDown') { e.preventDefault(); onNavigate(1); }
      };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [onNavigate, onClose]);

   const series = useMemo(() => {
      const scans = histQ.data?.scans || [];
      return {
         labels: scans.map((s) => fmtDay(s.finishedAt)),
         data: scans.map((s) => {
            const o = s.series.competitor as { visibilityScore: number; mentionRate: number; avgPosition: number | null } | null | undefined;
            return o ? o[metric] : null;
         }),
      };
   }, [histQ.data, metric]);

   if (!domain) return null;
   const ov = detail?.overview;
   const percent = metric === 'mentionRate';
   const reverse = metric === 'avgPosition';

   return (
      <>
         <div onClick={handleClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.12)', opacity: visible ? 1 : 0, transition: 'opacity 200ms ease' }} role="presentation" />
         <div style={{ position: 'fixed', top: 8, bottom: 8, right: 8, width: 800, maxWidth: 'calc(100vw - 16px)', zIndex: 301, background: '#fff', borderRadius: 16, boxShadow: '0px 24px 64px rgba(0,0,0,0.16), 0px 8px 24px rgba(0,0,0,0.08)', border: '1px solid #E4E4E7', display: 'flex', flexDirection: 'column', overflow: 'hidden', transform: visible ? 'translateX(0)' : 'translateX(calc(100% + 16px))', transition: 'transform 220ms cubic-bezier(0.16,1,0.3,1)', fontFamily: FONT }} role="dialog" aria-modal="true">
            {/* Header */}
            <div style={{ padding: '20px 24px 16px', display: 'flex', flexDirection: 'column', gap: 16, borderBottom: '1px solid #F4F4F5' }}>
               <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                     <button type="button" aria-label="Previous" disabled={!canUp} onClick={() => onNavigate(-1)} style={{ ...iconBtn, opacity: canUp ? 1 : 0.35, cursor: canUp ? 'pointer' : 'not-allowed' }}><ArrowUp /></button>
                     <button type="button" aria-label="Next" disabled={!canDown} onClick={() => onNavigate(1)} style={{ ...iconBtn, opacity: canDown ? 1 : 0.35, cursor: canDown ? 'pointer' : 'not-allowed' }}><ArrowDown /></button>
                  </div>
                  <button type="button" aria-label="Close" onClick={handleClose} style={iconBtn}><CloseIcon /></button>
               </div>
               <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  { /* eslint-disable-next-line @next/next/no-img-element */ }
                  <img alt="" src={faviconFor(domain)} width={22} height={22} style={{ borderRadius: 4, flexShrink: 0 }} />
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#18181B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{domain}</span>
               </h2>
            </div>

            {/* Body */}
            <div className="styled-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
               <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                     <StatCard label="Visibility score" hint="Average visibility across all tracked prompts and models" value={detailQ.isLoading ? <SkeletonBox w={40} h={26} /> : (ov?.visibilityScore ?? 0)} />
                     <StatCard label="Mention rate" hint="Share of prompt/model answers that cite this competitor" value={detailQ.isLoading ? <SkeletonBox w={40} h={26} /> : `${ov?.mentionRate ?? 0}%`} />
                     <StatCard label="Average position" hint="Average citation rank when this competitor is cited" value={detailQ.isLoading ? <SkeletonBox w={40} h={26} /> : (ov?.avgPosition != null ? ov.avgPosition.toFixed(1) : '—')} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                     <Segmented value={metric} onChange={setMetric} />
                     {histQ.isLoading ? (
                        <SkeletonBox w="100%" h={280} />
                     ) : series.data.filter((v) => v != null).length > 1 ? (
                        <MetricTrendChart
                           labels={series.labels}
                           lines={[{ label: METRICS.find((m) => m.key === metric)?.label || '', data: series.data, color: '#783AFB' }]}
                           yMin={metric === 'avgPosition' ? 1 : 0}
                           yMax={percent ? 100 : undefined}
                           reverse={reverse}
                           percent={percent}
                           height={280}
                        />
                     ) : (
                        <p style={{ margin: 0, fontSize: 13, color: '#9F9FA9' }}>Not enough scan history yet — the trend appears after two or more scans.</p>
                     )}
                  </div>
               </div>

               <div role="separator" style={{ height: 1, background: '#F4F4F5' }} />

               {/* Prompts */}
               <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                     <span style={{ fontSize: 15, fontWeight: 600, color: '#18181B' }}>Prompts <span style={{ color: '#9F9FA9', fontWeight: 400 }}>{detail?.prompts.length ?? 0}</span></span>
                     <span style={{ fontSize: 13, color: '#71717B' }}>See how {brandName(domain)} performs across different prompts</span>
                  </div>
                  {detailQ.isLoading ? <SkeletonBox w="100%" h={200} /> : <PromptsTable prompts={detail?.prompts || []} />}
               </div>

               <div role="separator" style={{ height: 1, background: '#F4F4F5' }} />

               {/* Sources from this competitor */}
               <div style={{ padding: 24 }}>
                  {detailQ.isLoading ? <SkeletonBox w="100%" h={200} /> : (
                     <SourcesMini
                        title={`Sources from ${brandName(domain)}`}
                        subtitle={`See which ${brandName(domain)} URLs show up in AI models and how often`}
                        sources={detail?.sources || []}
                     />
                  )}
               </div>
            </div>
         </div>
      </>
   );
};

export default CompetitorDetailModal;
