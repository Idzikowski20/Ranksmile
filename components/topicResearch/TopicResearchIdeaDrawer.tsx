import React, { useEffect, useState } from 'react';
import { ShellPortal, overlayZ } from '../koala/overlay/ShellPortal';
import { Button, SegmentedControl } from '../koala/core';
import type { TopicIdea } from '../../lib/topicResearchTypes';

const FONT = 'var(--font-family-primary)';

const fmtVol = (v: number | null): string => {
   if (v == null) return '—';
   if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}m`;
   if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
   return v.toLocaleString();
};

const ArrowUp = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const ArrowDown = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const CloseIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>);

export type DrawerIdea = { idea: TopicIdea; clusterTitle: string };

type Props = {
   items: DrawerIdea[];
   index: number | null;
   onNavigate: (nextIndex: number) => void;
   onClose: () => void;
   onCreate: (keyword: string) => void;
};

const cell: React.CSSProperties = { padding: '12px 16px', fontSize: 14, fontFamily: FONT, display: 'flex', alignItems: 'center', boxSizing: 'border-box' };

const StatCard = ({ label, value }: { label: string; value: React.ReactNode }) => (
   <div style={{ border: '1px solid #F4F4F5', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#71717B' }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 700, color: '#18181B' }}>{value}</span>
   </div>
);

const EmptyState = ({ title, hint }: { title: string; hint: string }) => (
   <div style={{ border: '1px solid #F4F4F5', borderRadius: 12, padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
      <span style={{ fontSize: 28 }} aria-hidden>🔍</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: '#18181B' }}>{title}</span>
      <span style={{ fontSize: 13, color: '#9F9FA9' }}>{hint}</span>
   </div>
);

/** Right-side slide-over for a topic idea — same chrome as the AI Visibility competitor
 *  detail modal: overlay fade, nav arrows (prev/next idea), close, stat cards, tabbed body. */
const TopicResearchIdeaDrawer = ({ items, index, onNavigate, onClose, onCreate }: Props) => {
   const open = index != null && index >= 0 && index < items.length;
   const [tab, setTab] = useState<'keywords' | 'competitors'>('keywords');
   const [visible, setVisible] = useState(false);

   useEffect(() => {
      if (!open) { setVisible(false); return undefined; }
      const t = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(t);
   }, [open]);

   useEffect(() => { setTab('keywords'); }, [index]);

   const canPrev = open && (index as number) > 0;
   const canNext = open && (index as number) < items.length - 1;

   useEffect(() => {
      if (!open) return undefined;
      const onKey = (e: KeyboardEvent) => {
         if (e.key === 'Escape') handleClose();
         if (e.key === 'ArrowUp' && canPrev) { e.preventDefault(); onNavigate((index as number) - 1); }
         if (e.key === 'ArrowDown' && canNext) { e.preventDefault(); onNavigate((index as number) + 1); }
      };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [open, index, canPrev, canNext, onNavigate]);

   const handleClose = () => { setVisible(false); setTimeout(onClose, 220); };

   if (!open) return null;
   const { idea, clusterTitle } = items[index as number];
   const notCoveredVol = idea.keywords.reduce((s, k) => s + (k.volume ?? 0), 0);
   const avgKd = idea.keywords.length ? Math.round(idea.keywords.reduce((s, k) => s + (k.kd ?? 0), 0) / idea.keywords.length) : null;

   return (
      <ShellPortal>
         <div onClick={handleClose} style={{ position: 'fixed', inset: 0, zIndex: overlayZ.drawer, background: 'rgba(0,0,0,0.12)', opacity: visible ? 1 : 0, transition: 'opacity 200ms ease' }} role="presentation" />
         <div style={{ position: 'fixed', top: 8, bottom: 8, right: 8, width: 800, maxWidth: 'calc(100vw - 16px)', zIndex: overlayZ.drawerPanel, background: '#fff', borderRadius: 16, boxShadow: '0px 24px 64px rgba(0,0,0,0.16), 0px 8px 24px rgba(0,0,0,0.08)', border: '1px solid #E4E4E7', display: 'flex', flexDirection: 'column', overflow: 'hidden', transform: visible ? 'translateX(0)' : 'translateX(calc(100% + 16px))', transition: 'transform 220ms cubic-bezier(0.16,1,0.3,1)', fontFamily: FONT }} role="dialog" aria-modal="true">
            {/* Header: nav arrows · title/meta · Create + close */}
            <div style={{ padding: '20px 24px 16px', display: 'flex', flexDirection: 'column', gap: 16, borderBottom: '1px solid #F4F4F5' }}>
               <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                     <Button type="button" variant="transparent" size="sm" aria-label="Previous" disabled={!canPrev} onClick={() => onNavigate((index as number) - 1)} icon={<ArrowUp />} style={{ opacity: canPrev ? 1 : 0.35 }} />
                     <Button type="button" variant="transparent" size="sm" aria-label="Next" disabled={!canNext} onClick={() => onNavigate((index as number) + 1)} icon={<ArrowDown />} style={{ opacity: canNext ? 1 : 0.35 }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                     <Button type="button" variant="primary" size="sm" onClick={() => onCreate(idea.main)}>Create content</Button>
                     <Button type="button" variant="transparent" size="sm" aria-label="Close" onClick={handleClose} icon={<CloseIcon />} />
                  </div>
               </div>
               <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#9F9FA9', marginBottom: 4 }}>{clusterTitle || 'Idea'}</div>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#18181B' }}>{idea.main}</h2>
                  <div style={{ fontSize: 13, color: '#71717B', marginTop: 4 }}>includes {idea.keywords.length} keyword{idea.keywords.length === 1 ? '' : 's'}</div>
               </div>
            </div>

            {/* Body */}
            <div className="styled-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  <StatCard label="Avg. position" value={idea.position ?? 'N/A'} />
                  <StatCard label="KD" value={idea.kd ?? '—'} />
                  <StatCard label="Total impressions" value="N/A" />
                  <StatCard label="Vol." value={fmtVol(idea.volume)} />
               </div>

               <SegmentedControl
                  size="sm"
                  value={tab}
                  onChange={setTab}
                  options={[
                     { value: 'keywords', label: `Keywords ${idea.keywords.length}` },
                     { value: 'competitors', label: 'Competitors' },
                  ]}
               />

               {tab === 'competitors' ? (
                  <EmptyState title="No competitor data" hint="Competitor coverage for this idea is not available yet." />
               ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                     <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: '#18181B' }}>Not Covered</div>
                        <div style={{ fontSize: 12, color: '#9F9FA9', marginTop: 2 }}>{idea.keywords.length} keywords · avg. KD {avgKd ?? '—'} · total vol. {fmtVol(notCoveredVol)}</div>
                     </div>
                     <div style={{ overflow: 'hidden' }}>
                        <div style={{ display: 'flex', borderBottom: '1px solid #F4F4F5', fontSize: 13, color: '#71717B' }}>
                           <div style={{ ...cell, flex: 1, minWidth: 0 }}>Keywords</div>
                           <div style={{ ...cell, width: 90, flexShrink: 0, justifyContent: 'flex-end' }}>Position</div>
                           <div style={{ ...cell, width: 70, flexShrink: 0, justifyContent: 'flex-end' }}>KD</div>
                           <div style={{ ...cell, width: 90, flexShrink: 0, justifyContent: 'flex-end' }}>Vol.</div>
                        </div>
                        {idea.keywords.map((kw, i) => (
                           <div key={kw.keyword} style={{ display: 'flex', borderTop: i === 0 ? 'none' : '1px solid #F4F4F5' }}>
                              <div style={{ ...cell, flex: 1, minWidth: 0, gap: 8 }}>
                                 <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#18181B' }}>{kw.keyword}</span>
                                 {kw.keyword === idea.main && <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', color: '#52525C', background: '#F4F4F5', borderRadius: 4, padding: '2px 6px' }}>MAIN</span>}
                              </div>
                              <div style={{ ...cell, width: 90, flexShrink: 0, justifyContent: 'flex-end', color: kw.position != null ? '#18181B' : '#9F9FA9' }}>{kw.position ?? '—'}</div>
                              <div style={{ ...cell, width: 70, flexShrink: 0, justifyContent: 'flex-end', color: '#52525C' }}>{kw.kd ?? '—'}</div>
                              <div style={{ ...cell, width: 90, flexShrink: 0, justifyContent: 'flex-end', fontWeight: 600, color: '#18181B' }}>{fmtVol(kw.volume)}</div>
                           </div>
                        ))}
                     </div>
                  </div>
               )}
            </div>
         </div>
      </ShellPortal>
   );
};

export default TopicResearchIdeaDrawer;
