import React, { useEffect, useMemo, useState } from 'react';
import HoverTooltip from '../common/HoverTooltip';

const FONT = 'var(--font-family-primary)';
const faviconFor = (d: string) => `https://www.google.com/s2/favicons?domain=${d}&sz=32`;

export type SourceRow = { url: string; domain: string; timesShown: number; models: string[] };
type Group = { domain: string; urls: SourceRow[]; timesShown: number; models: string[] };

export const splitSourceUrl = (url: string, fallback: string): { host: string; path: string } => {
   try { const u = new URL(url); return { host: u.host, path: `${u.pathname}${u.search}` }; } catch { return { host: fallback, path: '' }; }
};

const PAGE_SIZE = 50;

const ChevronRight = ({ open }: { open: boolean }) => (
   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 150ms ease' }}><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const SortArrow = ({ asc }: { asc: boolean }) => (
   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ transform: asc ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }}><path d="M12 5v14m0 0l-5-5m5 5l5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

const headCell: React.CSSProperties = { padding: '10px 16px', fontSize: 13, fontWeight: 500, color: '#71717B', fontFamily: FONT, borderLeft: '1px solid #F4F4F5', display: 'flex', alignItems: 'center', boxSizing: 'border-box' };
const bodyCell: React.CSSProperties = { padding: '12px 16px', fontSize: 14, fontFamily: FONT, borderLeft: '1px solid #F4F4F5', display: 'flex', alignItems: 'center', minHeight: 48, boxSizing: 'border-box' };
const rowStyle: React.CSSProperties = { display: 'flex', borderBottom: '1px solid #F4F4F5', cursor: 'pointer', background: '#fff', transition: 'background 100ms ease' };

/** Source cell: favicon + host(bold)/path(gray) over a horizontal fill bar sized by share. */
const SourceCell = ({ icon, host, path, fillPct, indent = false, chevronOpen }: { icon: string; host: string; path: string; fillPct: number; indent?: boolean; chevronOpen?: boolean }) => (
   <div style={{ ...bodyCell, borderLeft: 'none', flex: 1, minWidth: 0, position: 'relative', gap: 8, paddingLeft: indent ? 44 : 16 }}>
      <div aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, fillPct)}%`, background: 'linear-gradient(to right, rgba(244,244,245,0), #F0F0F2)', pointerEvents: 'none' }} />
      {chevronOpen !== undefined ? <span style={{ zIndex: 1, display: 'inline-flex', color: '#71717B' }}><ChevronRight open={chevronOpen} /></span> : null}
      { /* eslint-disable-next-line @next/next/no-img-element */ }
      <img alt="" src={faviconFor(icon)} width={20} height={20} style={{ borderRadius: 4, flexShrink: 0, zIndex: 1 }} />
      <span style={{ zIndex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 14, fontFamily: FONT }}>
         <span style={{ fontWeight: 600, color: '#18181B' }}>{host}</span>
         <span style={{ color: '#9F9FA9' }}>{path}</span>
      </span>
   </div>
);

const ModelsCell = ({ models, modelLabel }: { models: string[]; modelLabel: Record<string, string> }) => {
   const labels = models.map((m) => modelLabel[m] || m);
   return (
      <div style={{ ...bodyCell, width: 110, flexShrink: 0 }}>
         {labels.length ? (
            <HoverTooltip label={labels.join(' · ')} align="right">
               <span style={{ fontSize: 13, color: '#52525C', cursor: 'default', whiteSpace: 'nowrap' }}>{labels.length} {labels.length === 1 ? 'model' : 'models'}</span>
            </HoverTooltip>
         ) : <span style={{ color: '#9F9FA9' }}>—</span>}
      </div>
   );
};

const TimesCell = ({ v }: { v: number }) => (
   <div style={{ ...bodyCell, width: 150, flexShrink: 0, justifyContent: 'flex-end', fontWeight: 600, color: '#18181B' }}>{v}</div>
);

const hoverOn = (e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.background = '#FAFAFA'; };
const hoverOff = (e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.background = '#fff'; };

/** SurferSEO-style sources table: fill-bar source column, optional group-by-domain with
 *  expandable URL rows, sortable Times shown, incremental "Show more" paging.
 *  onSelect receives the navigable list + index so the detail modal can page through it. */
const SourcesTable = ({ sources, grouped, modelLabel, onSelect }: {
   sources: SourceRow[];
   grouped: boolean;
   modelLabel: Record<string, string>;
   onSelect: (list: SourceRow[], index: number, navigable: boolean) => void;
}) => {
   const [asc, setAsc] = useState(false);
   const [visible, setVisible] = useState(PAGE_SIZE);
   const [expanded, setExpanded] = useState<Set<string>>(new Set());

   useEffect(() => { setVisible(PAGE_SIZE); setExpanded(new Set()); }, [sources, grouped]);

   const sorted = useMemo(() => [...sources].sort((a, b) => (asc ? a.timesShown - b.timesShown : b.timesShown - a.timesShown)), [sources, asc]);
   const groups: Group[] = useMemo(() => {
      if (!grouped) return [];
      const map = new Map<string, Group>();
      for (const s of sorted) {
         const g = map.get(s.domain) ?? { domain: s.domain, urls: [], timesShown: 0, models: [] };
         g.urls.push(s);
         g.timesShown += s.timesShown;
         map.set(s.domain, g);
      }
      const out = Array.from(map.values());
      for (const g of out) g.models = Array.from(new Set(g.urls.flatMap((u) => u.models)));
      return out.sort((a, b) => (asc ? a.timesShown - b.timesShown : b.timesShown - a.timesShown));
   }, [sorted, grouped, asc]);

   const maxUrl = useMemo(() => Math.max(1, ...sources.map((s) => s.timesShown)), [sources]);
   const maxGroup = useMemo(() => Math.max(1, ...groups.map((g) => g.timesShown)), [groups]);

   const toggleGroup = (domain: string) => {
      setExpanded((prev) => { const next = new Set(prev); if (next.has(domain)) next.delete(domain); else next.add(domain); return next; });
   };

   const total = grouped ? groups.length : sorted.length;
   const remaining = Math.max(0, total - visible);

   if (!sources.length) {
      return <div style={{ border: '1px solid #F4F4F5', borderRadius: 12, padding: '48px 24px', textAlign: 'center', fontSize: 14, color: '#9F9FA9', fontFamily: FONT }}>No sources yet.</div>;
   }

   return (
      <div style={{ border: '1px solid #F4F4F5', borderRadius: 12, background: '#fff' }}>
         {/* Header */}
         <div style={{ display: 'flex', borderBottom: '1px solid #F4F4F5' }}>
            <div style={{ ...headCell, borderLeft: 'none', flex: 1, minWidth: 0 }}>Source</div>
            {grouped ? <div style={{ ...headCell, width: 90, flexShrink: 0, justifyContent: 'flex-end' }}>URLs</div> : null}
            <div style={{ ...headCell, width: 110, flexShrink: 0 }}>Models</div>
            <div style={{ ...headCell, width: 150, flexShrink: 0, justifyContent: 'flex-end' }}>
               <button type="button" onClick={() => setAsc((v) => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 600, color: '#52525C' }}>
                  Times shown <SortArrow asc={asc} />
               </button>
            </div>
         </div>

         {grouped ? groups.slice(0, visible).map((g) => (
            <React.Fragment key={g.domain}>
               <div style={rowStyle} onClick={() => toggleGroup(g.domain)} onMouseEnter={hoverOn} onMouseLeave={hoverOff} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') toggleGroup(g.domain); }}>
                  <SourceCell icon={g.domain} host={g.domain} path="" fillPct={(g.timesShown / maxGroup) * 100} chevronOpen={expanded.has(g.domain)} />
                  <div style={{ ...bodyCell, width: 90, flexShrink: 0, justifyContent: 'flex-end', color: '#52525C' }}>{g.urls.length}</div>
                  <ModelsCell models={g.models} modelLabel={modelLabel} />
                  <TimesCell v={g.timesShown} />
               </div>
               {expanded.has(g.domain) && g.urls.map((u, i) => {
                  const { host, path } = splitSourceUrl(u.url, u.domain);
                  return (
                     <div key={u.url} style={{ ...rowStyle, background: '#FCFCFD' }} onClick={() => onSelect(g.urls, i, true)} onMouseEnter={hoverOn} onMouseLeave={(e) => { e.currentTarget.style.background = '#FCFCFD'; }} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onSelect(g.urls, i, true); }}>
                        <SourceCell icon={u.domain} host={host} path={path} fillPct={(u.timesShown / maxUrl) * 100} indent />
                        <div style={{ ...bodyCell, width: 90, flexShrink: 0 }} />
                        <ModelsCell models={u.models} modelLabel={modelLabel} />
                        <TimesCell v={u.timesShown} />
                     </div>
                  );
               })}
            </React.Fragment>
         )) : sorted.slice(0, visible).map((s, i) => {
            const { host, path } = splitSourceUrl(s.url, s.domain);
            return (
               <div key={s.url} style={rowStyle} onClick={() => onSelect(sorted, i, true)} onMouseEnter={hoverOn} onMouseLeave={hoverOff} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onSelect(sorted, i, true); }}>
                  <SourceCell icon={s.domain} host={host} path={path} fillPct={(s.timesShown / maxUrl) * 100} />
                  <ModelsCell models={s.models} modelLabel={modelLabel} />
                  <TimesCell v={s.timesShown} />
               </div>
            );
         })}

         {remaining > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 12 }}>
               <button type="button" onClick={() => setVisible((v) => v + 100)} style={{ border: '1px solid #E4E4E7', borderRadius: 8, padding: '7px 14px', background: '#fff', color: '#18181B', fontSize: 13, fontWeight: 600, fontFamily: FONT, cursor: 'pointer' }}>
                  Show more ({remaining} left)
               </button>
            </div>
         )}
      </div>
   );
};

export default SourcesTable;
