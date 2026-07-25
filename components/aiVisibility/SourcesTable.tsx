import React, { useEffect, useMemo, useState } from 'react';
import { HoverTooltip, Button } from '../core';
import DomainFavicon from '../common/DomainFavicon';

const FONT = 'var(--font-family-primary)';

export type SourceBrand = { domain: string; brand: string };
export type SourceRow = { url: string; domain: string; timesShown: number; models: string[]; mentioned?: boolean; brands?: SourceBrand[]; compMentioned?: boolean };
type Group = { domain: string; urls: SourceRow[]; timesShown: number; models: string[]; mentioned: boolean; brands: SourceBrand[] };

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
const OpenDetailsIcon = () => (
   <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M13 17H16.75C17.99 17 19 15.99 19 14.75V5.25C19 4.01 17.99 3 16.75 3H13V17Z" fill="currentColor" /><path d="M11 3.5V16.5H3.25C2.28 16.5 1.5 15.72 1.5 14.75V5.25C1.5 4.28 2.28 3.5 3.25 3.5H11Z" stroke="currentColor" /></svg>
);

/** Dotted-underline column header that reveals a definition on hover. */
const HeadTip = ({ label, tip, align = 'left' }: { label: string; tip: string; align?: 'left' | 'right' | 'center' }) => (
   <HoverTooltip label={tip} align={align}>
      <span style={{ cursor: 'help', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 4, textDecorationColor: '#C4C4CC' }}>{label}</span>
   </HoverTooltip>
);

const BrandStack = ({ brands }: { brands: SourceBrand[] }) => {
   const shown = brands.slice(0, 3);
   if (!shown.length) return <span style={{ color: '#9F9FA9' }}>—</span>;
   return (
      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
         {shown.map((b, i) => (
            <span key={b.brand} title={b.brand} style={{ marginLeft: i ? -5 : 0, display: 'inline-flex' }}>
               <DomainFavicon
                  domain={b.domain || 'example.com'}
                  size={16}
                  style={{ borderRadius: 9999, border: '1px solid #fff', background: '#fff', opacity: b.domain ? 1 : 0.4 }}
               />
            </span>
         ))}
         {brands.length > 3 ? <span style={{ marginLeft: 6, fontSize: 13, color: '#71717B' }}>+{brands.length - 3}</span> : null}
      </span>
   );
};

const headCell: React.CSSProperties = { padding: '10px 16px', fontSize: 13, fontWeight: 500, color: '#71717B', fontFamily: FONT, borderLeft: '1px solid #F4F4F5', display: 'flex', alignItems: 'center', boxSizing: 'border-box' };
const bodyCell: React.CSSProperties = { padding: '12px 16px', fontSize: 14, fontFamily: FONT, borderLeft: '1px solid #F4F4F5', display: 'flex', alignItems: 'center', minHeight: 48, boxSizing: 'border-box' };
const rowStyle: React.CSSProperties = { display: 'flex', borderBottom: '1px solid #F4F4F5', cursor: 'pointer', background: '#fff', transition: 'background 100ms ease' };

/** Source cell: favicon + host(bold)/path(gray) over a horizontal fill bar sized by share. */
const SourceCell = ({ icon, host, path, fillPct, indent = false, chevronOpen }: { icon: string; host: string; path: string; fillPct: number; indent?: boolean; chevronOpen?: boolean }) => (
   <div style={{ ...bodyCell, borderLeft: 'none', flex: 1, minWidth: 0, position: 'relative', gap: 8, paddingLeft: indent ? 44 : 16 }}>
      <div aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, fillPct)}%`, background: 'linear-gradient(to right, rgba(244,244,245,0), #F0F0F2)', pointerEvents: 'none' }} />
      {chevronOpen !== undefined ? <span style={{ zIndex: 1, display: 'inline-flex', color: '#71717B' }}><ChevronRight open={chevronOpen} /></span> : null}
      <DomainFavicon domain={icon} size={20} style={{ zIndex: 1 }} />
      <span style={{ zIndex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 14, fontFamily: FONT }}>
         <span style={{ fontWeight: 600, color: '#18181B' }}>{host}</span>
         <span style={{ color: '#9F9FA9' }}>{path}</span>
      </span>
      <span data-open style={{ position: 'absolute', right: 12, opacity: 0, transition: 'opacity 120ms ease', color: '#71717B', zIndex: 1, display: 'inline-flex' }}><OpenDetailsIcon /></span>
   </div>
);

const MetaCells = ({ mentioned, brands }: { mentioned?: boolean; brands?: SourceBrand[] }) => (
   <>
      <div style={{ ...bodyCell, width: 100, flexShrink: 0, justifyContent: 'center', color: mentioned ? '#18181B' : '#71717B' }}>{mentioned ? 'Yes' : 'No'}</div>
      <div style={{ ...bodyCell, width: 120, flexShrink: 0 }}><BrandStack brands={brands || []} /></div>
      <div style={{ ...bodyCell, width: 90, flexShrink: 0, justifyContent: 'flex-end', color: '#9F9FA9' }}>N/A</div>
   </>
);

const TimesCell = ({ v }: { v: number }) => (
   <div style={{ ...bodyCell, width: 150, flexShrink: 0, justifyContent: 'flex-end', fontWeight: 600, color: '#18181B' }}>{v}</div>
);

const setOpenIcon = (el: HTMLElement, on: boolean) => { const ic = el.querySelector('[data-open]') as HTMLElement | null; if (ic) ic.style.opacity = on ? '1' : '0'; };
const hoverOn = (e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.background = '#FBFAFF'; setOpenIcon(e.currentTarget, true); };
const hoverOff = (e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.background = '#fff'; setOpenIcon(e.currentTarget, false); };
const hoverOffChild = (e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.background = '#FCFCFD'; setOpenIcon(e.currentTarget, false); };

/** Ranksmile-style sources table: fill-bar source column, optional group-by-domain with
 *  expandable URL rows, sortable Times shown, incremental "Show more" paging.
 *  onSelect receives the navigable list + index so the detail modal can page through it. */
const CompareCell = ({ on }: { on: boolean }) => (
   on
      ? <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 6, padding: '2px 10px', fontSize: 13, fontWeight: 500, color: '#1AB25E', background: '#EAF8F0' }}>Yes</span>
      : <span style={{ color: '#71717B' }}>No</span>
);

const SourcesTable = ({ sources, grouped, onSelect, compare }: {
   sources: SourceRow[];
   grouped: boolean;
   onSelect: (list: SourceRow[], index: number, navigable: boolean) => void;
   compare?: { ownLabel: string; compLabel: string };
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
         const g = map.get(s.domain) ?? { domain: s.domain, urls: [], timesShown: 0, models: [], mentioned: false, brands: [] };
         g.urls.push(s);
         g.timesShown += s.timesShown;
         map.set(s.domain, g);
      }
      const out = Array.from(map.values());
      for (const g of out) {
         g.models = Array.from(new Set(g.urls.flatMap((u) => u.models)));
         g.mentioned = g.urls.some((u) => u.mentioned);
         const seen = new Map<string, SourceBrand>();
         for (const u of g.urls) for (const b of (u.brands || [])) if (!seen.has(b.brand.toLowerCase())) seen.set(b.brand.toLowerCase(), b);
         g.brands = Array.from(seen.values());
      }
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
      return <div style={{ border: '1px solid #DAD9DE', boxShadow: '0 4px 0 0 #e4e4e7', borderRadius: 12, padding: '48px 24px', textAlign: 'center', fontSize: 14, color: '#9F9FA9', fontFamily: FONT }}>{compare ? 'No shared sources for this competitor.' : 'No sources yet.'}</div>;
   }

   // Compare mode: two Mentioned columns ({you} vs {competitor}) + Price, no Brands/grouping.
   if (compare) {
      const truncLabel: React.CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
      return (
         <div style={{ border: '1px solid #DAD9DE', boxShadow: '0 4px 0 0 #e4e4e7', borderRadius: 12, background: '#fff' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid #F4F4F5' }}>
               <div style={{ ...headCell, borderLeft: 'none', flex: 1, minWidth: 0 }}>Source</div>
               <div style={{ ...headCell, width: 130, flexShrink: 0, justifyContent: 'center' }}><span style={truncLabel} title={`${compare.ownLabel} Mentioned`}><HeadTip label={`${compare.ownLabel} Mentioned`} tip="Whether your brand is mentioned in AI answers citing this source" align="center" /></span></div>
               <div style={{ ...headCell, width: 150, flexShrink: 0, justifyContent: 'center' }}><span style={truncLabel} title={`${compare.compLabel} Mentioned`}><HeadTip label={`${compare.compLabel} Mentioned`} tip="Whether the competitor is cited on the same prompts as this source" align="center" /></span></div>
               <div style={{ ...headCell, width: 90, flexShrink: 0, justifyContent: 'flex-end' }}><HeadTip label="Price" tip="Price of offers from link and sponsored article providers" align="right" /></div>
               <div style={{ ...headCell, width: 150, flexShrink: 0, justifyContent: 'flex-end' }}>
                  <Button type="button" variant="transparent" size="sm" onClick={() => setAsc((v) => !v)} style={{ gap: 4, color: '#52525C', fontWeight: 600 }}>
                     <HeadTip label="Times shown" tip="Number of times the URL appears in AI answers" align="right" /> <SortArrow asc={asc} />
                  </Button>
               </div>
            </div>
            {sorted.slice(0, visible).map((s, i) => {
               const { host, path } = splitSourceUrl(s.url, s.domain);
               return (
                  <div key={s.url} style={rowStyle} onClick={() => onSelect(sorted, i, true)} onMouseEnter={hoverOn} onMouseLeave={hoverOff} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onSelect(sorted, i, true); }}>
                     <SourceCell icon={s.domain} host={host} path={path} fillPct={(s.timesShown / maxUrl) * 100} />
                     <div style={{ ...bodyCell, width: 130, flexShrink: 0, justifyContent: 'center' }}><CompareCell on={!!s.mentioned} /></div>
                     <div style={{ ...bodyCell, width: 150, flexShrink: 0, justifyContent: 'center' }}><CompareCell on={!!s.compMentioned} /></div>
                     <div style={{ ...bodyCell, width: 90, flexShrink: 0, justifyContent: 'flex-end', color: '#9F9FA9' }}>N/A</div>
                     <TimesCell v={s.timesShown} />
                  </div>
               );
            })}
            {remaining > 0 && (
               <div style={{ display: 'flex', justifyContent: 'center', padding: 12 }}>
                  <Button type="button" variant="secondary" size="sm" onClick={() => setVisible((v) => v + 100)}>
                     Show more ({remaining} left)
                  </Button>
               </div>
            )}
         </div>
      );
   }

   return (
      <div style={{ border: '1px solid #DAD9DE', boxShadow: '0 4px 0 0 #e4e4e7', borderRadius: 12, background: '#fff' }}>
         {/* Header */}
         <div style={{ display: 'flex', borderBottom: '1px solid #F4F4F5' }}>
            <div style={{ ...headCell, borderLeft: 'none', flex: 1, minWidth: 0 }}>Source</div>
            {grouped ? <div style={{ ...headCell, width: 80, flexShrink: 0, justifyContent: 'flex-end' }}>URLs</div> : null}
            <div style={{ ...headCell, width: 100, flexShrink: 0, justifyContent: 'center' }}><HeadTip label="Mentioned" tip="Whether your brand is mentioned in AI answers citing this source" align="center" /></div>
            <div style={{ ...headCell, width: 120, flexShrink: 0 }}><HeadTip label="Brands" tip="Brands mentioned in AI answers citing this source" /></div>
            <div style={{ ...headCell, width: 90, flexShrink: 0, justifyContent: 'flex-end' }}><HeadTip label="Price" tip="Price of offers from link and sponsored article providers" align="right" /></div>
            <div style={{ ...headCell, width: 150, flexShrink: 0, justifyContent: 'flex-end' }}>
               <Button type="button" variant="transparent" size="sm" onClick={() => setAsc((v) => !v)} style={{ gap: 4, color: '#52525C', fontWeight: 600 }}>
                  <HeadTip label="Times shown" tip="Number of times the URL appears in AI answers" align="right" /> <SortArrow asc={asc} />
               </Button>
            </div>
         </div>

         {grouped ? groups.slice(0, visible).map((g) => (
            <React.Fragment key={g.domain}>
               <div style={rowStyle} onClick={() => toggleGroup(g.domain)} onMouseEnter={hoverOn} onMouseLeave={hoverOff} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') toggleGroup(g.domain); }}>
                  <SourceCell icon={g.domain} host={g.domain} path="" fillPct={(g.timesShown / maxGroup) * 100} chevronOpen={expanded.has(g.domain)} />
                  <div style={{ ...bodyCell, width: 80, flexShrink: 0, justifyContent: 'flex-end', color: '#52525C' }}>{g.urls.length}</div>
                  <MetaCells mentioned={g.mentioned} brands={g.brands} />
                  <TimesCell v={g.timesShown} />
               </div>
               {expanded.has(g.domain) && g.urls.map((u, i) => {
                  const { host, path } = splitSourceUrl(u.url, u.domain);
                  return (
                     <div key={u.url} style={{ ...rowStyle, background: '#FCFCFD' }} onClick={() => onSelect(g.urls, i, true)} onMouseEnter={hoverOn} onMouseLeave={hoverOffChild} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onSelect(g.urls, i, true); }}>
                        <SourceCell icon={u.domain} host={host} path={path} fillPct={(u.timesShown / maxUrl) * 100} indent />
                        <div style={{ ...bodyCell, width: 80, flexShrink: 0 }} />
                        <MetaCells mentioned={u.mentioned} brands={u.brands} />
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
                  <MetaCells mentioned={s.mentioned} brands={s.brands} />
                  <TimesCell v={s.timesShown} />
               </div>
            );
         })}

         {remaining > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 12 }}>
               <Button type="button" variant="secondary" size="sm" onClick={() => setVisible((v) => v + 100)}>
                  Show more ({remaining} left)
               </Button>
            </div>
         )}
      </div>
   );
};

export default SourcesTable;
