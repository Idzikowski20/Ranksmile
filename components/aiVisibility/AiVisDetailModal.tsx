import React, { useEffect, useMemo, useState } from 'react';
import TrendLineChart from './TrendLineChart';
import { SkeletonBox } from './SkeletonBlocks';
import { AI_VIS_MODEL_LABEL } from '../../lib/aiVisibility';
import { ModelIcon, isKnownModel } from './modelIcons';
import { useAiVisPromptDetail, useAiVisFanoutDetail, type AiVisDetailPayload } from '../../services/aiVisibility';

const FONT = 'var(--font-family-primary)';

export type AiVisDetailItem = { promptId?: number; query?: string; title: string };

type Props = {
   slug: string;
   kind: 'prompt' | 'fanout';
   items: AiVisDetailItem[];
   index: number;
   onNavigate: (nextIndex: number) => void;
   onClose: () => void;
};

type Metric = 'visibilityScore' | 'mentionRate' | 'avgPosition';
const METRICS: Array<{ id: Metric; label: string }> = [
   { id: 'visibilityScore', label: 'Visibility score' },
   { id: 'mentionRate', label: 'Mention rate' },
   { id: 'avgPosition', label: 'Avg. position' },
];

const ArrowUp = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const ArrowDown = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const CloseIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const ChevronDown = () => (<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path fill="currentColor" fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" /></svg>);
const Check = () => (<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path fill="currentColor" fillRule="evenodd" d="M16.705 4.153a.75.75 0 0 1 .142 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893l7.48-9.817a.75.75 0 0 1 1.05-.143" clipRule="evenodd" /></svg>);

const iconBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', padding: 4, color: '#52525C', cursor: 'pointer', borderRadius: 6 };
const subBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid #E4E4E7', background: '#fff', fontSize: 14, fontWeight: 600, fontFamily: FONT, color: '#18181B', cursor: 'pointer' };
const cell: React.CSSProperties = { padding: '12px 16px', fontSize: 14, fontFamily: FONT, display: 'flex', alignItems: 'center', boxSizing: 'border-box' };
const engineLabel = (e: string): string => AI_VIS_MODEL_LABEL[e] || e;

/** Segmented pill toggle mirroring the overview page's icon-toggle chrome (F4F4F5 track,
 *  white active pill), but text-only for the Overview/Responses + metric switches. */
const Segmented = <T extends string>({ options, value, onChange }: { options: Array<{ id: T; label: string }>; value: T; onChange: (v: T) => void }) => (
   <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: 3, borderRadius: 10, background: '#F4F4F5' }}>
      {options.map((o) => {
         const on = value === o.id;
         return (
            <button key={o.id} type="button" onClick={() => onChange(o.id)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 28, padding: '0 12px', border: 'none', borderRadius: 7, background: on ? '#fff' : 'transparent', color: on ? '#18181B' : '#9F9FA9', boxShadow: on ? '0 1px 2px rgba(0,0,0,0.10)' : 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: FONT, transition: 'color 150ms ease', whiteSpace: 'nowrap' }}>{o.label}</button>
         );
      })}
   </div>
);

const StatCard = ({ label, value, loading }: { label: string; value: React.ReactNode; loading: boolean }) => (
   <div style={{ border: '1px solid #F4F4F5', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 13, color: '#71717B' }}>{label}</span>
      <span style={{ fontSize: 24, fontWeight: 700, color: '#18181B' }}>{loading ? <SkeletonBox w={40} h={26} /> : value}</span>
   </div>
);

/** Blinking-robot empty state — same copy/structure the AI Visibility tables use when a
 *  filter combination yields nothing. */
const EmptyState = ({ title, hint }: { title: string; hint: string }) => (
   <div style={{ border: '1px solid #F4F4F5', borderRadius: 12, padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
      <span style={{ fontSize: 28 }} className="aiv-robot" aria-hidden>🤖</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: '#18181B' }}>{title}</span>
      <span style={{ fontSize: 13, color: '#9F9FA9' }}>{hint}</span>
   </div>
);

/** Engine picker: mirrors the toolbar model dropdown ('' == all engines). Options come from
 *  the active payload's `engines`, each shown with its model glyph + AI_VIS_MODEL_LABEL. */
const EnginePicker = ({ engines, value, onChange }: { engines: string[]; value: string; onChange: (e: string) => void }) => {
   const [open, setOpen] = useState(false);
   const label = value ? engineLabel(value) : 'All models';
   const item = (id: string, name: string, on: boolean, icon: React.ReactNode) => (
      <button key={id || 'all'} type="button" onClick={() => { onChange(id); setOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', border: 'none', background: 'transparent', borderRadius: 8, cursor: 'pointer', fontSize: 14, color: '#18181B', textAlign: 'left', fontFamily: FONT }} onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F4F5'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
         {icon ? <span style={{ display: 'inline-flex', color: '#18181B', flexShrink: 0 }}>{icon}</span> : null}
         <span style={{ flex: 1 }}>{name}</span>
         {on ? <span style={{ display: 'inline-flex', color: '#18181B' }}><Check /></span> : null}
      </button>
   );
   return (
      <div style={{ position: 'relative' }}>
         <button type="button" style={subBtn} onClick={() => setOpen((o) => !o)}>
            {value && isKnownModel(label) ? <span style={{ display: 'inline-flex', flexShrink: 0 }}><ModelIcon model={label} size={16} /></span> : null}
            <span>{label}</span>
            <ChevronDown />
         </button>
         {open ? (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, minWidth: 220, background: '#fff', borderRadius: 12, padding: 8, boxShadow: '0 18px 40px rgba(17,24,39,0.14), 0 8px 18px rgba(17,24,39,0.09)', zIndex: 320, fontFamily: FONT, animation: 'growOut 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}>
               {item('', 'All models', value === '', null)}
               {engines.map((e) => item(e, engineLabel(e), value === e, isKnownModel(engineLabel(e)) ? <ModelIcon model={engineLabel(e)} size={16} /> : null))}
            </div>
         ) : null}
      </div>
   );
};

/** Right-side slide-over for a tracked prompt (or a fanout query), reusing the SourceDetail
 *  shell: overview stat cards, a metric trend chart, plus Brands + Fanout tables. */
const AiVisDetailModal = ({ slug, kind, items, index, onNavigate, onClose }: Props) => {
   const active = items[index];
   const promptId = kind === 'prompt' ? (active?.promptId ?? null) : null;
   const fanoutQuery = kind === 'fanout' ? (active?.query ?? null) : null;
   const [engine, setEngine] = useState('');
   const [tab, setTab] = useState<'overview' | 'responses'>('overview');
   const [metric, setMetric] = useState<Metric>('visibilityScore');

   // Both hooks are called unconditionally (hooks rule); the inactive one is disabled via a
   // null id, so only the active `kind` fires a request.
   const promptQ = useAiVisPromptDetail(slug, { promptId, engine: engine || undefined });
   const fanoutQ = useAiVisFanoutDetail(slug, { query: fanoutQuery, engine: engine || undefined });
   const activeQ = kind === 'prompt' ? promptQ : fanoutQ;

   // Reset engine to "all" whenever the entity changes, so a per-entity engine choice never
   // leaks onto the next prompt/query.
   useEffect(() => { setEngine(''); }, [promptId, fanoutQuery]);

   // Hard staleness guard: keepPreviousData holds the prior entity's payload during a refetch
   // after an index/engine change. Blank it while fetching so no stale numbers ever show.
   const payload: AiVisDetailPayload | undefined = activeQ.isFetching ? undefined : activeQ.data;
   const loading = activeQ.isFetching || !payload;

   // Slide-in on mount, slide-out on close — same chrome as SourceDetailModal.
   const [visible, setVisible] = useState(false);
   useEffect(() => { const t = setTimeout(() => setVisible(true), 10); return () => clearTimeout(t); }, []);
   const handleClose = () => { setVisible(false); setTimeout(onClose, 220); };

   const canPrev = index > 0;
   const canNext = index < items.length - 1;
   useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
         if (e.key === 'Escape') handleClose();
         if (e.key === 'ArrowUp' && index > 0) { e.preventDefault(); onNavigate(index - 1); }
         if (e.key === 'ArrowDown' && index < items.length - 1) { e.preventDefault(); onNavigate(index + 1); }
      };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [index, items.length, onNavigate]);

   const ov = payload?.overview;
   const brands = payload?.brands || [];
   const fanout = payload?.fanout || [];
   const engines = payload?.engines || [];

   // TrendLineChart plots `series.you.visibilityScore` only, so map the selected metric's value
   // into that slot. Nulls (no data / avg-position gaps) fall back to 0, matching the chart.
   const trendScans = useMemo(
      () => (payload?.series || []).map((p) => ({
         finishedAt: p.finishedAt,
         series: { you: { visibilityScore: (p[metric] ?? 0) as number } },
      })),
      [payload, metric],
   );

   if (!active) return null;
   const title = payload?.title || active.title;

   return (
      <>
         <style>{'@keyframes aivRobotBlink{0%,92%,100%{opacity:1}96%{opacity:.35}}.aiv-robot{display:inline-block;animation:aivRobotBlink 2.4s ease-in-out infinite}'}</style>
         <div onClick={handleClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.12)', opacity: visible ? 1 : 0, transition: 'opacity 200ms ease' }} role="presentation" />
         <div style={{ position: 'fixed', top: 8, bottom: 8, right: 8, width: 800, maxWidth: 'calc(100vw - 16px)', zIndex: 301, background: '#fff', borderRadius: 16, boxShadow: '0px 24px 64px rgba(0,0,0,0.16), 0px 8px 24px rgba(0,0,0,0.08)', border: '1px solid #E4E4E7', display: 'flex', flexDirection: 'column', overflow: 'hidden', transform: visible ? 'translateX(0)' : 'translateX(calc(100% + 16px))', transition: 'transform 220ms cubic-bezier(0.16,1,0.3,1)', fontFamily: FONT }} role="dialog" aria-modal="true">
            {/* Header: nav arrows (left) · Overview/Responses toggle (center) · close (right) */}
            <div style={{ padding: '20px 24px 16px', display: 'flex', flexDirection: 'column', gap: 16, borderBottom: '1px solid #F4F4F5' }}>
               <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                     <button type="button" aria-label="Previous" disabled={!canPrev} onClick={() => onNavigate(index - 1)} style={{ ...iconBtn, opacity: canPrev ? 1 : 0.35, cursor: canPrev ? 'pointer' : 'not-allowed' }}><ArrowUp /></button>
                     <button type="button" aria-label="Next" disabled={!canNext} onClick={() => onNavigate(index + 1)} style={{ ...iconBtn, opacity: canNext ? 1 : 0.35, cursor: canNext ? 'pointer' : 'not-allowed' }}><ArrowDown /></button>
                  </div>
                  <Segmented options={[{ id: 'overview', label: 'Overview' }, { id: 'responses', label: 'Responses' }]} value={tab} onChange={setTab} />
                  <button type="button" aria-label="Close" onClick={handleClose} style={iconBtn}><CloseIcon /></button>
               </div>
               <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#18181B', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{title}</h2>
               {/* Sub-row: Compare (placeholder) + functional engine picker */}
               <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <button type="button" style={{ ...subBtn, color: '#52525C' }} aria-label="Compare (coming soon)"><span>Compare</span></button>
                  <EnginePicker engines={engines} value={engine} onChange={setEngine} />
               </div>
            </div>

            {/* Body */}
            <div className="styled-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
               {tab === 'responses' ? (
                  <EmptyState title="Responses coming soon" hint="Per-model AI answers for this prompt will appear here." />
               ) : (
                  <>
                     <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                        <StatCard label="Visibility score" loading={loading} value={ov?.visibilityScore ?? 0} />
                        <StatCard label="Mention rate" loading={loading} value={`${ov?.mentionRate ?? 0}%`} />
                        <StatCard label="Average position" loading={loading} value={ov?.avgPosition != null ? ov.avgPosition.toFixed(1) : '—'} />
                     </div>

                     {/* Metric trend */}
                     <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                           <span style={{ fontSize: 15, fontWeight: 600, color: '#18181B' }}>Trend</span>
                           <Segmented options={METRICS} value={metric} onChange={setMetric} />
                        </div>
                        <div style={{ height: 320 }}>
                           {loading ? <SkeletonBox w="100%" h={320} /> : <TrendLineChart scans={trendScans} competitorDomain={null} />}
                        </div>
                     </div>

                     <div role="separator" style={{ height: 1, background: '#E4E4E7' }} />

                     {/* Brands */}
                     <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: '#18181B' }}>Brands <span style={{ color: '#9F9FA9', fontWeight: 400 }}>{brands.length}</span></span>
                        {loading ? (
                           <SkeletonBox w="100%" h={160} />
                        ) : brands.length === 0 ? (
                           <EmptyState title="No brands found" hint="Try changing the filters" />
                        ) : (
                           <div style={{ border: '1px solid #F4F4F5', borderRadius: 12, overflow: 'hidden' }}>
                              <div style={{ display: 'flex', borderBottom: '1px solid #F4F4F5', fontSize: 13, color: '#71717B' }}>
                                 <div style={{ ...cell, flex: 1, minWidth: 0 }}>Brand</div>
                                 <div style={{ ...cell, width: 150, flexShrink: 0, justifyContent: 'flex-end', borderLeft: '1px solid #F4F4F5' }}>Mentions</div>
                                 <div style={{ ...cell, width: 130, flexShrink: 0, justifyContent: 'flex-end', borderLeft: '1px solid #F4F4F5' }}>Avg. position</div>
                              </div>
                              {brands.map((b) => (
                                 <div key={`${b.domain}-${b.brand}`} style={{ display: 'flex', borderTop: '1px solid #F4F4F5' }}>
                                    <div style={{ ...cell, flex: 1, minWidth: 0, gap: 8 }}>
                                       <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          <span style={{ fontWeight: 500, color: '#18181B' }}>{b.brand}</span>
                                          {b.domain ? <span style={{ color: '#9F9FA9' }}> · {b.domain}</span> : null}
                                       </span>
                                    </div>
                                    <div style={{ ...cell, width: 150, flexShrink: 0, justifyContent: 'flex-end', borderLeft: '1px solid #F4F4F5', fontWeight: 600, color: '#18181B' }}>{b.mentions}</div>
                                    <div style={{ ...cell, width: 130, flexShrink: 0, justifyContent: 'flex-end', borderLeft: '1px solid #F4F4F5', color: b.avgPosition != null ? '#18181B' : '#9F9FA9' }}>{b.avgPosition != null ? b.avgPosition.toFixed(1) : '—'}</div>
                                 </div>
                              ))}
                           </div>
                        )}
                     </div>

                     <div role="separator" style={{ height: 1, background: '#E4E4E7' }} />

                     {/* Fanout queries */}
                     <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: '#18181B' }}>Fanout Queries <span style={{ color: '#9F9FA9', fontWeight: 400 }}>{fanout.length}</span></span>
                        {loading ? (
                           <SkeletonBox w="100%" h={160} />
                        ) : fanout.length === 0 ? (
                           <EmptyState title="No fanout queries found" hint="Try changing the filters" />
                        ) : (
                           <div style={{ border: '1px solid #F4F4F5', borderRadius: 12, overflow: 'hidden' }}>
                              <div style={{ display: 'flex', borderBottom: '1px solid #F4F4F5', fontSize: 13, color: '#71717B' }}>
                                 <div style={{ ...cell, flex: 1, minWidth: 0 }}>Query</div>
                                 <div style={{ ...cell, width: 120, flexShrink: 0, justifyContent: 'flex-end', borderLeft: '1px solid #F4F4F5' }}>Count</div>
                              </div>
                              {fanout.map((f) => (
                                 <div key={f.query} style={{ display: 'flex', borderTop: '1px solid #F4F4F5' }}>
                                    <div style={{ ...cell, flex: 1, minWidth: 0, color: '#18181B', lineHeight: 1.5 }}>{f.query}</div>
                                    <div style={{ ...cell, width: 120, flexShrink: 0, justifyContent: 'flex-end', borderLeft: '1px solid #F4F4F5', fontWeight: 600, color: '#18181B' }}>{f.timesShown}</div>
                                 </div>
                              ))}
                           </div>
                        )}
                     </div>
                  </>
               )}
            </div>
         </div>
      </>
   );
};

export default AiVisDetailModal;
