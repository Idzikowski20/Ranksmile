import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import AppShell from '../../../../components/common/AppShell';
import DomainSubLayout from '../../../../components/domains/DomainSubLayout';
import KeywordClusterModal from '../../../../components/keywordResearch/KeywordClusterModal';
import ScoreGauge from '../../../../components/articles/ScoreGauge';
import { Button } from '../../../../components/koala/core';
import { KeywordIntentBadge } from '../../../../components/koala/product/helpers/KeywordIntentBadge';
import { useKeywordResearchRun } from '../../../../services/keywordResearch';
import { useFetchDomains } from '../../../../services/domains';
import { slugToDomain } from '../../../../utils/slugToDomain';
import { AUDIT_COUNTRIES } from '../../../../lib/countryLang';
import { buildKwClusters, fmtNum, INTENTS, kwIntentToSearchIntent, type KwCluster, type KwIntent } from '../../../../lib/keywordResearchView';

const FONT = 'var(--font-family-primary)';
const TEXT = '#18181B';
const TEXT2 = '#3F3F46';
const MUTED = '#71717B';
const MUTED2 = '#9F9FA9';
const BORDER = '#E4E4E7';
const CARD_BORDER = '#E4E4E7';

type Tab = 'all' | 'progress' | 'done' | 'missing';
type SortKey = 'relevant' | 'msvHigh' | 'msvLow' | 'kdHigh' | 'kdLow';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
   { value: 'relevant', label: 'Most Relevant' },
   { value: 'msvHigh', label: 'Search Volume: High to Low' },
   { value: 'msvLow', label: 'Search Volume: Low to High' },
   { value: 'kdHigh', label: 'Difficulty: High To Low' },
   { value: 'kdLow', label: 'Difficulty: Low to High' },
];

const Chevron = ({ open }: { open?: boolean }) => (
   <svg viewBox="0 0 24 24" width={18} height={18} style={{ transition: 'transform 150ms ease', transform: open ? 'rotate(180deg)' : 'none' }}><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m19.5 8.25l-7.5 7.5l-7.5-7.5" /></svg>
);
const SearchIcon = () => (<svg viewBox="0 0 24 24" width={16} height={16} style={{ color: MUTED }}><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607" /></svg>);
const PencilIcon = () => (<svg viewBox="0 0 24 24" width={22} height={22}><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>);
const KebabIcon = () => (<svg viewBox="0 0 24 24" width={20} height={20}><path fill="currentColor" d="M12 8a2 2 0 1 0 0-4a2 2 0 0 0 0 4m0 6a2 2 0 1 0 0-4a2 2 0 0 0 0 4m0 6a2 2 0 1 0 0-4a2 2 0 0 0 0 4" /></svg>);
const EditorIcon = () => (<svg viewBox="0 0 24 24" width={16} height={16}><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>);
const ExportIcon = () => (<svg viewBox="0 0 24 24" width={18} height={18}><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>);
const GoogleIcon = () => (
   <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M15.68 8.18c0-.54-.04-1.08-.14-1.62H8v3.08h4.32a3.7 3.7 0 0 1-1.6 2.43v2h2.58a7.8 7.8 0 0 0 2.38-5.89" fill="#4285F4" /><path d="M8 16a7.6 7.6 0 0 0 5.3-1.93l-2.58-2a4.8 4.8 0 0 1-2.72.77 4.77 4.77 0 0 1-4.49-3.3H.85v2.06A8 8 0 0 0 8 16" fill="#34A853" /><path d="M3.51 9.53a4.8 4.8 0 0 1 0-3.06V4.41H.85a8 8 0 0 0 0 7.18z" fill="#FBBC04" /><path d="M8 3.17a4.35 4.35 0 0 1 3.07 1.2l2.28-2.29A7.7 7.7 0 0 0 8 0a8 8 0 0 0-7.15 4.41L3.5 6.47A4.77 4.77 0 0 1 8 3.17" fill="#EA4335" /></svg>
);

/* ─── Filter popovers ─────────────────────────────────────────────────────── */
const useOutside = (onClose: () => void) => {
   const ref = useRef<HTMLDivElement | null>(null);
   useEffect(() => {
      const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
      const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
      document.addEventListener('mousedown', onDown);
      document.addEventListener('keydown', onKey);
      return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
   }, [onClose]);
   return ref;
};

const FilterTrigger = ({ label, open, onClick }: { label: string; open: boolean; onClick: () => void }) => (
   <button type="button" onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 15, fontWeight: 600, color: TEXT2, padding: 0, fontFamily: FONT }}>
      {label}
      <Chevron open={open} />
   </button>
);

const popStyle: React.CSSProperties = { position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 200, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: '0px 12px 32px rgba(9,9,11,0.12)', padding: 16, animation: 'growOut 0.2s cubic-bezier(0.16,1,0.3,1)', fontFamily: FONT };

const IntentFilter = ({ counts, selected, onChange }: { counts: Record<KwIntent, number>; selected: Set<KwIntent>; onChange: (s: Set<KwIntent>) => void }) => {
   const [open, setOpen] = useState(false);
   const ref = useOutside(() => setOpen(false));
   const toggle = (it: KwIntent) => {
      const next = new Set(selected);
      if (next.has(it)) next.delete(it); else next.add(it);
      onChange(next);
   };
   return (
      <div style={{ position: 'relative' }} ref={ref}>
         <FilterTrigger label="Intent" open={open} onClick={() => setOpen((o) => !o)} />
         {open && (
            <div style={{ ...popStyle, minWidth: 240 }}>
               {INTENTS.map((it) => {
                  const n = counts[it] || 0;
                  const disabled = n === 0;
                  const on = selected.has(it);
                  return (
                     <button key={it} type="button" disabled={disabled} onClick={() => toggle(it)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px', border: 'none', background: 'transparent', cursor: disabled ? 'default' : 'pointer', fontSize: 15, color: disabled ? MUTED2 : TEXT2, opacity: disabled ? 0.5 : 1, fontFamily: FONT }}>
                        <span style={{ width: 16, color: on ? '#18181B' : 'transparent' }}>✓</span>
                        <span>{it} ({n})</span>
                     </button>
                  );
               })}
            </div>
         )}
      </div>
   );
};

const RangeFilter = ({ label, heading, presets, value, onApply }: {
   label: string; heading: string; presets: { label: string; min: number; max: number }[];
   value: { min: number; max: number }; onApply: (v: { min: number; max: number }) => void;
}) => {
   const [open, setOpen] = useState(false);
   const ref = useOutside(() => setOpen(false));
   const [min, setMin] = useState(String(value.min));
   const [max, setMax] = useState(String(value.max));
   useEffect(() => { setMin(String(value.min)); setMax(String(value.max)); }, [value, open]);
   const inputStyle: React.CSSProperties = { flex: 1, height: 44, padding: '0 14px', borderRadius: 10, border: '1px solid #D4D4D8', fontSize: 15, color: TEXT2, fontFamily: FONT, outline: 'none' };
   return (
      <div style={{ position: 'relative' }} ref={ref}>
         <FilterTrigger label={label} open={open} onClick={() => setOpen((o) => !o)} />
         {open && (
            <div style={{ ...popStyle, width: 400 }}>
               <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: MUTED, marginBottom: 12 }}>{heading}</div>
               <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                  <input value={min} onChange={(e) => setMin(e.target.value.replace(/[^0-9]/g, ''))} style={inputStyle} />
                  <input value={max} onChange={(e) => setMax(e.target.value.replace(/[^0-9]/g, ''))} style={inputStyle} />
               </div>
               <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: MUTED, marginBottom: 10 }}>Most popular ranges</div>
               <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  {presets.map((p) => (
                     <button key={p.label} type="button" onClick={() => { setMin(String(p.min)); setMax(String(p.max)); }} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#F4F4F5', color: TEXT2, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: FONT }}>{p.label}</button>
                  ))}
               </div>
               <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button type="button" onClick={() => setOpen(false)} style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: '#F4F4F5', color: TEXT2, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>Cancel</button>
                  <button type="button" onClick={() => { onApply({ min: Number(min) || 0, max: Number(max) || Number.MAX_SAFE_INTEGER }); setOpen(false); }} style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: '#18181B', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>Apply</button>
               </div>
            </div>
         )}
      </div>
   );
};

const SortSelect = ({ value, onChange }: { value: SortKey; onChange: (v: SortKey) => void }) => {
   const [open, setOpen] = useState(false);
   const ref = useOutside(() => setOpen(false));
   const current = SORT_OPTIONS.find((o) => o.value === value) || SORT_OPTIONS[0];
   return (
      <div style={{ position: 'relative', width: 180 }} ref={ref}>
         <button type="button" onClick={() => setOpen((o) => !o)} style={{ width: '100%', height: 32, display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px 0 12px', borderRadius: 8, border: '1px solid #D4D4D8', background: '#fff', cursor: 'pointer', fontSize: 14, color: TEXT2, fontFamily: FONT }}>
            <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{current.label}</span>
            <span style={{ color: MUTED }}><Chevron open={open} /></span>
         </button>
         {open && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, minWidth: 240, zIndex: 200, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: '0px 12px 32px rgba(9,9,11,0.12)', padding: 6, animation: 'growOut 0.2s cubic-bezier(0.16,1,0.3,1)' }}>
               {SORT_OPTIONS.map((o) => (
                  <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '9px 12px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, fontWeight: o.value === value ? 600 : 400, color: TEXT2, borderRadius: 8, fontFamily: FONT }}>
                     <span>{o.label}</span>
                     {o.value === value && <span style={{ color: '#18181B' }}>✓</span>}
                  </button>
               ))}
            </div>
         )}
      </div>
   );
};

/* ─── Tabs ────────────────────────────────────────────────────────────────── */
const TabItem = ({ label, count, active, disabled, onClick }: { label: string; count: number; active: boolean; disabled?: boolean; onClick: () => void }) => (
   <button type="button" disabled={disabled} onClick={onClick} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0 4px 14px', border: 'none', background: 'transparent', cursor: disabled ? 'default' : 'pointer', fontSize: 14, fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase', color: disabled ? MUTED2 : active ? '#18181B' : MUTED, opacity: disabled ? 0.6 : 1, fontFamily: FONT }}>
      {label}
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 20, height: 18, padding: '0 5px', borderRadius: 6, background: active ? '#18181B' : '#E4E4E7', color: active ? '#fff' : '#52525C', fontSize: 12, fontWeight: 600 }}>{count}</span>
      {active && <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, background: '#F84416', borderRadius: 2 }} />}
   </button>
);

/* ─── Cluster card ────────────────────────────────────────────────────────── */
type CardState = 'idle' | 'creating' | 'preparing' | 'done' | 'editing';
const ClusterCard = ({ cluster, state, onOpenDetails, onOpenEditor }: {
   cluster: KwCluster;
   state: CardState;
   onOpenDetails: () => void;
   onOpenEditor: () => void;
}) => {
   const [hover, setHover] = useState(false);
   const [menuOpen, setMenuOpen] = useState(false);
   const menuRef = useOutside(() => setMenuOpen(false));
   const shown = cluster.keywords.slice(0, 5);
   const more = cluster.keywords.length - 1;
   const busy = state === 'creating' || state === 'preparing';
   const hasArticle = state === 'done' || state === 'editing';
   const menuItem: React.CSSProperties = { width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, fontWeight: 500, color: TEXT2, borderRadius: 8, fontFamily: FONT, whiteSpace: 'nowrap' };
   return (
      <div
         onMouseEnter={() => setHover(true)}
         onMouseLeave={() => setHover(false)}
         style={{
            position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 292,
            padding: 24, borderRadius: 12, border: `1px solid ${CARD_BORDER}`, background: '#fff',
            boxShadow: hover ? '0px 8px 20px rgba(24,26,34,0.06)' : 'none',
            transition: 'box-shadow 150ms ease', overflow: 'hidden', fontFamily: FONT,
         }}
      >
         {/* top row */}
         <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <KeywordIntentBadge intent={kwIntentToSearchIntent(cluster.intent)} label />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, fontWeight: 500, color: '#52525C', whiteSpace: 'nowrap' }}>
               <span><span style={{ color: MUTED2, textTransform: 'uppercase', paddingRight: 4 }}>MSV:</span>{fmtNum(cluster.msv)}</span>
               <span><span style={{ color: MUTED2, textTransform: 'uppercase', paddingRight: 4 }}>KD:</span>{cluster.kd}</span>
            </div>
         </div>
         {/* title */}
         <div style={{ paddingTop: 16, fontSize: 18, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {cluster.title}
            {more > 0 && <span style={{ paddingLeft: 8, fontSize: 15, fontWeight: 400, color: MUTED }}>+{more} more</span>}
         </div>
         {/* keyword list */}
         <div style={{ position: 'relative', flex: 1, marginTop: 12 }}>
            <div style={{ fontSize: 13, color: MUTED, paddingBottom: 6 }}>Keywords ({cluster.keywords.length} of {cluster.keywords.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
               {shown.map((k) => (
                  <span key={k.keyword} style={{ fontSize: 14, color: '#52525C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.keyword}</span>
               ))}
            </div>
            {/* bottom fade */}
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: -24, height: 72, background: 'linear-gradient(to bottom, transparent, #fff)', pointerEvents: 'none' }} />
         </div>
         {/* action */}
         {busy && (
            <div style={{ position: 'absolute', bottom: 24, right: 24, width: 42, height: 42, borderRadius: '50%', background: '#F4F4F5', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0px 4px 12px rgba(9,9,11,0.12)', zIndex: 5 }}>
               <div style={{ width: 20, height: 20, border: '2.5px solid #D4D4D8', borderTopColor: '#52525C', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            </div>
         )}
         {state === 'idle' && (
            <button type="button" aria-label="Open details" onClick={onOpenDetails} style={{ position: 'absolute', bottom: 24, right: 24, width: 42, height: 42, borderRadius: '50%', background: '#2F2F34', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0px 4px 12px rgba(9,9,11,0.24)', zIndex: 5, transition: 'background 150ms ease' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#F84416'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#2F2F34'; }}>
               <PencilIcon />
            </button>
         )}
         {hasArticle && (
            <div style={{ position: 'absolute', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, zIndex: 6 }}>
               <ScoreGauge score={0} pending size={52} />
               <div style={{ position: 'relative' }} ref={menuRef}>
                  <button type="button" aria-label="Article actions" onClick={() => setMenuOpen((o) => !o)} style={{ width: 42, height: 42, borderRadius: '50%', background: '#2F2F34', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0px 4px 12px rgba(9,9,11,0.24)', transition: 'background 150ms ease' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#F84416'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#2F2F34'; }}>
                     <KebabIcon />
                  </button>
                  {menuOpen && (
                     <div style={{ position: 'absolute', right: 0, bottom: 'calc(100% + 8px)', minWidth: 210, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: '0px 12px 32px rgba(9,9,11,0.18)', padding: 6, animation: 'growOut 0.2s cubic-bezier(0.16,1,0.3,1)' }}>
                        <button type="button" style={menuItem} onClick={() => { setMenuOpen(false); onOpenEditor(); }} onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F4F5'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                           <span style={{ color: MUTED, display: 'inline-flex' }}><EditorIcon /></span>Open Content Editor
                        </button>
                     </div>
                  )}
               </div>
            </div>
         )}
      </div>
   );
};

const SkeletonCard = ({ i }: { i: number }) => (
   <div style={{ minHeight: 292, borderRadius: 12, border: `1px solid ${CARD_BORDER}`, background: '#fff', padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
         <div style={{ width: 90, height: 18, borderRadius: 4, background: '#E4E4E7', animation: 'auditPulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.05}s` }} />
         <div style={{ width: 70, height: 18, borderRadius: 4, background: '#F1F1F3' }} />
      </div>
      <div style={{ width: '70%', height: 22, borderRadius: 6, background: '#E4E4E7', animation: 'auditPulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.05}s` }} />
      {[0, 1, 2, 3].map((r) => <div key={r} style={{ width: `${80 - r * 8}%`, height: 14, borderRadius: 4, background: '#F1F1F3' }} />)}
   </div>
);

const KeywordResearchDetailPage: NextPage = () => {
   const router = useRouter();
   const { domain: slug, id } = router.query as { domain: string; id: string };
   const domain = slug ? slugToDomain(slug) : '';
   const runId = id ? Number(id) : undefined;

   const { data: domainsData } = useFetchDomains(router, true);
   const domains = domainsData?.domains || [];
   const activeDomain = domains.find((d: DomainType) => d.slug === slug);
   const domainId = activeDomain?.ID ?? null;

   const runQ = useKeywordResearchRun(slug, runId);
   const run = runQ.data?.run;
   const result = runQ.data?.result;

   const [tab, setTab] = useState<Tab>('all');
   const [query, setQuery] = useState('');
   const [sort, setSort] = useState<SortKey>('relevant');
   const [intentSel, setIntentSel] = useState<Set<KwIntent>>(new Set(INTENTS));
   const [kwRange, setKwRange] = useState({ min: 0, max: Number.MAX_SAFE_INTEGER });
   const [volRange, setVolRange] = useState({ min: 0, max: Number.MAX_SAFE_INTEGER });

   const [modalIdx, setModalIdx] = useState<number | null>(null);
   const [creatingIdx, setCreatingIdx] = useState<number | null>(null);
   // clusterIndex → articleId while the content editor is being prepared / once ready.
   const [progressIds, setProgressIds] = useState<Map<number, number | null>>(new Map());
   const [doneIds, setDoneIds] = useState<Map<number, number>>(new Map());
   // clusterIndex → articleId once the user has opened the content editor.
   const [editingIds, setEditingIds] = useState<Map<number, number>>(new Map());

   const failed = runQ.isError || run?.status === 'failed';
   const busy = !failed && (runQ.isLoading || !run || run.status === 'queued' || run.status === 'running');

   const clusters = useMemo(() => (result ? buildKwClusters(result) : []), [result]);

   const intentCounts = useMemo(() => {
      const c = { Local: 0, 'Customer Investigation': 0, Informational: 0, Shopping: 0, 'Not detected': 0 } as Record<KwIntent, number>;
      clusters.forEach((cl) => { c[cl.intent] += 1; });
      return c;
   }, [clusters]);

   const stateOf = (idx: number): CardState => {
      if (creatingIdx === idx) return 'creating';
      if (progressIds.has(idx)) return 'preparing';
      if (editingIds.has(idx)) return 'editing';
      if (doneIds.has(idx)) return 'done';
      return 'idle';
   };

   const tabClusters = useMemo(() => {
      if (tab === 'progress') return clusters.filter((c) => progressIds.has(c.index) || editingIds.has(c.index));
      if (tab === 'done') return clusters.filter((c) => doneIds.has(c.index));
      if (tab === 'missing') return clusters.filter((c) => !progressIds.has(c.index) && !editingIds.has(c.index) && !doneIds.has(c.index));
      return clusters;
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [clusters, tab, progressIds, doneIds, editingIds]);

   const visibleClusters = useMemo(() => {
      let list = tabClusters.filter((c) => intentSel.has(c.intent));
      list = list.filter((c) => c.keywords.length >= kwRange.min && c.keywords.length <= kwRange.max);
      list = list.filter((c) => c.msv >= volRange.min && c.msv <= volRange.max);
      const q = query.trim().toLowerCase();
      if (q) list = list.filter((c) => c.title.toLowerCase().includes(q) || c.keywords.some((k) => k.keyword.toLowerCase().includes(q)));
      const sorted = [...list];
      if (sort === 'msvHigh') sorted.sort((a, b) => b.msv - a.msv);
      else if (sort === 'msvLow') sorted.sort((a, b) => a.msv - b.msv);
      else if (sort === 'kdHigh') sorted.sort((a, b) => b.kd - a.kd);
      else if (sort === 'kdLow') sorted.sort((a, b) => a.kd - b.kd);
      return sorted;
   }, [tabClusters, intentSel, kwRange, volRange, query, sort]);

   const countryMeta = AUDIT_COUNTRIES.find((c) => c.code === (run?.country || '').toUpperCase());

   const exportCsv = () => {
      const rows = [['Cluster', 'Keyword', 'MSV', 'KD', 'Intent']];
      clusters.forEach((c) => c.keywords.forEach((k) => rows.push([c.title, k.keyword, String(k.volume ?? ''), String(k.kd ?? ''), c.intent])));
      const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${run?.seed || 'keyword-research'}.csv`; a.click();
      URL.revokeObjectURL(url);
   };

   /**
    * Create an empty article for the cluster's keyword(s). Reuses the existing
    * deep-analysis "keyword mode" which creates a draft article and gathers only
    * SERP competitors + terms (no page fetch, no heavy pipeline). We consume the
    * SSE stream in the background and never navigate — the card just spins while
    * the editor is prepared, then moves to "Done" (click to open the article).
    */
   const doCreate = async (clusterIdx: number, keywords: string[]) => {
      if (!domainId) { toast.error('No domain resolved for this workspace.'); return; }
      const kws = keywords.length ? keywords : clusters.find((c) => c.index === clusterIdx)?.keywords.map((k) => k.keyword).slice(0, 1) ?? [];
      if (!kws.length) return;

      setCreatingIdx(clusterIdx);
      try {
         const res = await fetch('/api/articles/deep-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keywords: kws, country: run?.country || 'PL', domainId }),
         });
         if (!res.ok || !res.body) {
            const d = await res.json().catch(() => ({} as { error?: string }));
            throw new Error(d.error || `Request failed (${res.status})`);
         }

         const reader = res.body.getReader();
         const decoder = new TextDecoder();
         let buffer = '';
         let ev = '';
         let opened = false;
         let errored: string | null = null;

         const handle = (line: string) => {
            if (line.startsWith('event: ')) { ev = line.slice(7).trim(); return; }
            if (!line.startsWith('data: ')) return;
            let data: { articleId?: number; message?: string } = {};
            try { data = JSON.parse(line.slice(6)); } catch { return; }
            if (ev === 'created' && data.articleId != null) {
               if (!opened) {
                  opened = true;
                  setCreatingIdx(null);
                  setModalIdx(null);
                  toast.success('Content Editor created successfully.\nPlease wait while we prepare the Content Editor.');
               }
               setProgressIds((prev) => new Map(prev).set(clusterIdx, data.articleId!));
            } else if (ev === 'done') {
               setProgressIds((prev) => { const n = new Map(prev); n.delete(clusterIdx); return n; });
               if (data.articleId != null) setDoneIds((prev) => new Map(prev).set(clusterIdx, data.articleId!));
            } else if (ev === 'error') {
               errored = data.message || 'Analysis failed';
            }
            ev = '';
         };

         for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const l of lines) if (l.trim()) handle(l);
         }
         if (buffer.trim()) handle(buffer.trim());

         if (errored) throw new Error(errored);
      } catch (e) {
         setCreatingIdx(null);
         setProgressIds((prev) => { const n = new Map(prev); n.delete(clusterIdx); return n; });
         toast.error(e instanceof Error ? e.message : 'Failed to create content');
      }
   };

   const articleIdFor = (idx: number) => editingIds.get(idx) ?? doneIds.get(idx) ?? null;

   /** Open the content editor for a finished cluster and move it from
    *  "Done" to "Content Editors in Progress" (the human is now editing it). */
   const openEditor = (idx: number) => {
      const aid = articleIdFor(idx);
      if (aid == null) return;
      setDoneIds((prev) => { const n = new Map(prev); n.delete(idx); return n; });
      setEditingIds((prev) => new Map(prev).set(idx, aid));
      router.push(`/articles/${aid}`);
   };

   const modalCluster = modalIdx != null ? visibleClusters[modalIdx] : null;

   return (
      <AppShell domains={domains} showAddModal={() => {}} showSettings={() => {}}>
         <Head><title>{`${run?.seed || 'Keyword Research'} — ${domain}`}</title></Head>
         <style>{'@keyframes spin{to{transform:rotate(360deg)}}@keyframes auditPulse{0%,100%{opacity:.5}50%{opacity:1}}@keyframes growOut{from{opacity:0;transform:translateY(-6px) scale(0.98)}to{opacity:1;transform:none}}'}</style>
         <DomainSubLayout domain={domain} slug={slug || ''} section="Keyword Research" contentMaxWidth="100%">
            <div style={{ width: '100%', maxWidth: 1540, margin: '0 auto', fontFamily: FONT }}>
               {/* Header */}
               <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingBottom: 20, minHeight: 36 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                     <button type="button" onClick={() => router.push(`/sites/${slug}/keyword-research`)} aria-label="Back" style={{ border: 'none', background: 'transparent', color: MUTED, fontSize: 22, lineHeight: 1, cursor: 'pointer', padding: 0, flexShrink: 0 }}>‹</button>
                     <span style={{ fontSize: 18, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{run?.seed || '…'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                     <span title={countryMeta ? `Google · ${countryMeta.name}` : 'Google'} style={{ position: 'relative', display: 'inline-flex' }}>
                        <GoogleIcon />
                        <span style={{ position: 'absolute', top: -3, right: -3, width: 7, height: 7, borderRadius: '50%', background: '#1AB25E', border: '1.5px solid #fff' }} />
                     </span>
                     <Button type="button" variant="primary" size="sm" icon={<ExportIcon />} onClick={exportCsv} disabled={busy || !clusters.length}>Export to CSV</Button>
                  </div>
               </div>

               {failed && (
                  <div style={{ border: `1px solid ${CARD_BORDER}`, borderRadius: 12, background: '#fff', padding: '48px 24px', textAlign: 'center' }}>
                     <div style={{ fontSize: 15, fontWeight: 600, color: '#DC2626' }}>Research failed</div>
                     <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>{run?.error || 'Try again with a different seed keyword.'}</div>
                  </div>
               )}

               {!failed && (
                  <>
                     {/* Tabs */}
                     <div style={{ display: 'flex', alignItems: 'center', gap: 28, borderBottom: `1px solid ${'#EDEDEF'}`, marginBottom: 20 }}>
                        <TabItem label="All Clusters" count={clusters.length} active={tab === 'all'} onClick={() => setTab('all')} />
                        <TabItem label="Content Editors in Progress" count={progressIds.size + editingIds.size} active={tab === 'progress'} disabled={progressIds.size + editingIds.size === 0} onClick={() => setTab('progress')} />
                        <TabItem label="Done" count={doneIds.size} active={tab === 'done'} disabled={doneIds.size === 0} onClick={() => setTab('done')} />
                        <TabItem label="Missing" count={clusters.length - progressIds.size - editingIds.size - doneIds.size} active={tab === 'missing'} onClick={() => setTab('missing')} />
                     </div>

                     {/* Filters */}
                     <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                           <IntentFilter counts={intentCounts} selected={intentSel} onChange={setIntentSel} />
                           <RangeFilter label="Keywords" heading="Keywords in cluster range" value={kwRange} onApply={setKwRange} presets={[{ label: '1 — 5', min: 1, max: 5 }, { label: '5 — 10', min: 5, max: 10 }, { label: '10+', min: 10, max: 999 }]} />
                           <RangeFilter label="Search Volume" heading="Search volume range" value={volRange} onApply={setVolRange} presets={[{ label: '100+', min: 100, max: 999999999 }, { label: '500 — 1k', min: 500, max: 1000 }, { label: '2k — 5k', min: 2000, max: 5000 }, { label: '20k — 30k', min: 20000, max: 30000 }, { label: '75k — 100k', min: 75000, max: 100000 }, { label: '1m+', min: 1000000, max: 999999999 }]} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                           <div style={{ position: 'relative', width: 220 }}>
                              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', display: 'inline-flex' }}><SearchIcon /></span>
                              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" style={{ width: '100%', height: 32, padding: '0 12px 0 34px', borderRadius: 8, border: '1px solid #D4D4D8', fontSize: 14, color: TEXT2, fontFamily: FONT, outline: 'none' }} />
                           </div>
                           <SortSelect value={sort} onChange={setSort} />
                        </div>
                     </div>

                     {/* Grid */}
                     <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, paddingBottom: 40 }}>
                        {busy && Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={`sk-${i}`} i={i} />)}
                        {!busy && visibleClusters.map((c, i) => (
                           <ClusterCard
                              key={c.index}
                              cluster={c}
                              state={stateOf(c.index)}
                              onOpenDetails={() => setModalIdx(i)}
                              onOpenEditor={() => openEditor(c.index)}
                           />
                        ))}
                        {!busy && visibleClusters.length === 0 && (
                           <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: MUTED, fontSize: 14, padding: '48px 0' }}>No clusters match your filters.</div>
                        )}
                     </div>
                  </>
               )}
            </div>
         </DomainSubLayout>

         {modalCluster && modalIdx != null && (
            <KeywordClusterModal
               cluster={modalCluster}
               index={modalIdx}
               total={visibleClusters.length}
               creating={creatingIdx === modalCluster.index}
               onNavigate={(next) => setModalIdx(next)}
               onClose={() => setModalIdx(null)}
               onCreate={(keywords) => doCreate(modalCluster.index, keywords)}
            />
         )}
      </AppShell>
   );
};

export default KeywordResearchDetailPage;
