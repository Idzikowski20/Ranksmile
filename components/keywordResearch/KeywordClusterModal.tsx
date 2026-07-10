import React, { useEffect, useMemo, useState } from 'react';
import { Button, Checkbox } from '../core';
import { fmtNum, type KwCluster } from '../../lib/keywordResearchView';

const FONT = 'var(--font-family-primary)';
const TEXT = '#18181B';
const TEXT2 = '#3F3F46';
const MUTED = '#71717B';
const BORDER = '#E4E4E7';

const ArrowLeft = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M19.5 12h-15m0 0l6.75 6.75M4.5 12l6.75-6.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const ArrowRight = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const CloseIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>);

const IntentBadge = ({ intent }: { intent: string }) => (
   <span style={{ display: 'inline-flex', alignItems: 'center', height: 18, padding: '0 6px', borderRadius: 4, border: `1px solid ${'#D4D4D8'}`, fontSize: 11, fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase', color: MUTED, flexShrink: 0 }}>{intent}</span>
);

const StatBlock = ({ label, value, first }: { label: string; value: React.ReactNode; first?: boolean }) => (
   <div style={{ flex: 1, padding: '0 24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderLeft: first ? 'none' : `1px solid ${BORDER}` }}>
      <div style={{ fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.02em', color: MUTED }}>{label}</div>
      <div style={{ padding: '4px 0', fontSize: 18, fontWeight: 600, color: TEXT2 }}>{value}</div>
   </div>
);

type Props = {
   cluster: KwCluster;
   index: number;
   total: number;
   creating: boolean;
   onNavigate: (nextIndex: number) => void;
   onClose: () => void;
   onCreate: (keywords: string[]) => void;
};

const cell: React.CSSProperties = { fontSize: 14, fontFamily: FONT, color: TEXT2, display: 'flex', alignItems: 'center' };

const KeywordClusterModal = ({ cluster, index, total, creating, onNavigate, onClose, onCreate }: Props) => {
   const [visible, setVisible] = useState(false);
   const [checked, setChecked] = useState<Set<string>>(() => new Set(cluster.keywords.map((k) => k.keyword)));

   useEffect(() => {
      const t = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(t);
   }, []);

   // Reset selection when the viewed cluster changes.
   useEffect(() => { setChecked(new Set(cluster.keywords.map((k) => k.keyword))); }, [cluster]);

   const canPrev = index > 0;
   const canNext = index < total - 1;

   const handleClose = () => { setVisible(false); setTimeout(onClose, 200); };

   useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
         if (e.key === 'Escape') handleClose();
         if (e.key === 'ArrowLeft' && canPrev) onNavigate(index - 1);
         if (e.key === 'ArrowRight' && canNext) onNavigate(index + 1);
      };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [index, canPrev, canNext]);

   const toggle = (kw: string) => setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(kw)) next.delete(kw); else next.add(kw);
      return next;
   });

   const selectedList = useMemo(() => cluster.keywords.filter((k) => checked.has(k.keyword)).map((k) => k.keyword), [cluster, checked]);
   const total3 = `${cluster.keywords.length} of ${cluster.keywords.length}`;

   return (
      <>
         <div onClick={handleClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(9,9,11,0.45)', opacity: visible ? 1 : 0, transition: 'opacity 180ms ease' }} role="presentation" />
         <div
            style={{
               position: 'fixed', top: '50%', left: '50%', width: 860, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 160px)', zIndex: 301,
               transform: `translate(-50%, -50%) scale(${visible ? 1 : 0.97})`, opacity: visible ? 1 : 0, transition: 'transform 200ms cubic-bezier(0.16,1,0.3,1), opacity 200ms ease',
               background: '#fff', borderRadius: 16, boxShadow: '0px 24px 64px rgba(9,9,11,0.24)', border: `1px solid ${BORDER}`,
               display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: FONT,
            }}
            role="dialog"
            aria-modal="true"
         >
            {/* Header */}
            <div style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
               <Button type="button" variant="secondary" size="sm" aria-label="Previous" disabled={!canPrev} onClick={() => onNavigate(index - 1)} icon={<ArrowLeft />} />
               <Button type="button" variant="secondary" size="sm" aria-label="Next" disabled={!canNext} onClick={() => onNavigate(index + 1)} icon={<ArrowRight />} />
               <div style={{ marginLeft: 8, flex: 1, display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 'calc(100% - 120px)' }}>{cluster.title}</h2>
                  <IntentBadge intent={cluster.intent} />
               </div>
               <button type="button" onClick={handleClose} aria-label="Close modal" style={{ border: 'none', background: 'transparent', color: MUTED, cursor: 'pointer', padding: 0, display: 'inline-flex' }}>
                  <CloseIcon />
               </button>
            </div>

            {/* Stat blocks */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
               <StatBlock label="Monthly Search Volume (MSV)" value={fmtNum(cluster.msv)} first />
               <StatBlock label="Total Traffic" value={fmtNum(cluster.totalTraffic)} />
               <StatBlock label="Difficulty (KD)" value={cluster.kd} />
            </div>

            {/* Keywords table */}
            <div className="styled-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '0 24px 32px' }}>
               <div style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${BORDER}` }}>
                  <div style={{ ...cell, flex: '1 1 300px', minWidth: 200, fontSize: 13, color: MUTED }}>Keywords ({total3})</div>
                  <div style={{ ...cell, flex: 1, justifyContent: 'flex-end', fontSize: 13, color: MUTED }}>MSV</div>
                  <div style={{ ...cell, flex: 1, justifyContent: 'flex-end', fontSize: 13, color: MUTED }}>KD</div>
               </div>
               {cluster.keywords.map((kw) => (
                  <div key={kw.keyword} style={{ display: 'flex', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${'#F4F4F5'}` }}>
                     <div style={{ ...cell, flex: '1 1 300px', minWidth: 200, gap: 12 }}>
                        <div onClick={(e) => e.stopPropagation()} style={{ display: 'inline-flex' }}>
                           <Checkbox size="sm" checked={checked.has(kw.keyword)} onChange={() => toggle(kw.keyword)} />
                        </div>
                        <span style={{ color: '#27272A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{kw.keyword}</span>
                     </div>
                     <div style={{ ...cell, flex: 1, justifyContent: 'flex-end', color: TEXT2 }}>{fmtNum(kw.volume)}</div>
                     <div style={{ ...cell, flex: 1, justifyContent: 'flex-end', color: TEXT2 }}>{kw.kd ?? '—'}</div>
                  </div>
               ))}
            </div>

            {/* Footer: Create */}
            <div style={{ padding: '16px 24px', borderTop: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'flex-end' }}>
               <Button
                  type="button"
                  variant="primary"
                  onClick={() => onCreate(selectedList)}
                  disabled={creating || selectedList.length === 0}
                  busy={creating}
               >
                  {creating ? 'Creating' : 'Create'}
               </Button>
            </div>
         </div>
      </>
   );
};

export default KeywordClusterModal;
