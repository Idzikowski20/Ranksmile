import React, { useEffect, useMemo, useState } from 'react';
import { SkeletonBox } from './SkeletonBlocks';
import HoverTooltip from '../common/HoverTooltip';
import { useAiVisCompetitorDetail } from '../../services/aiVisibility';

const FONT = 'var(--font-family-primary)';
const faviconFor = (d: string) => `https://www.google.com/s2/favicons?domain=${d}&sz=32`;
const brandName = (d: string) => { const base = d.replace(/^www\./, '').split('.')[0]; return base.charAt(0).toUpperCase() + base.slice(1); };

const InfoIcon = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: '#9F9FA9', flexShrink: 0 }}><path d="M12 16v-4M12 8h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const ArrowUp = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const ArrowDown = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const CloseIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const SortArrow = ({ asc }: { asc: boolean }) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ transform: asc ? 'rotate(180deg)' : 'none' }}><path d="M12 5v14m0 0l-5-5m5 5l5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);

const iconBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', padding: 4, color: '#52525C', cursor: 'pointer', borderRadius: 6 };

const StatCard = ({ label, value, hint }: { label: string; value: React.ReactNode; hint: string }) => (
   <div style={{ border: '1px solid #F4F4F5', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#71717B' }}>
         {label}<HoverTooltip label={hint} align="center"><span style={{ display: 'inline-flex', cursor: 'help' }}><InfoIcon /></span></HoverTooltip>
      </span>
      <span style={{ fontSize: 24, fontWeight: 700, color: '#18181B' }}>{value}</span>
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

type MentionSource = { url: string; domain: string; timesShown: number; ownMentioned: boolean; compMentioned: boolean };

const Tabs = ({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: Array<{ key: string; label: string }> }) => (
   <div style={{ display: 'inline-flex', gap: 4, background: '#F4F4F5', borderRadius: 10, padding: 4, alignSelf: 'flex-start' }}>
      {options.map((o) => (
         <button key={o.key} type="button" onClick={() => onChange(o.key)} style={{ border: 'none', borderRadius: 7, padding: '6px 12px', fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', background: value === o.key ? '#fff' : 'transparent', color: value === o.key ? '#18181B' : '#52525C', boxShadow: value === o.key ? '0 1px 2px rgba(0,0,0,0.06)' : 'none' }}>{o.label}</button>
      ))}
   </div>
);

const YesBadge = () => (<span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 6, padding: '2px 10px', fontSize: 13, fontWeight: 500, color: '#1AB25E', background: '#EAF8F0' }}>Yes</span>);

/** Two overlapping circles: competitor (orange, ∝ gap+shared) + own (violet), shared
 *  intersection in red — the Mention Gap glyph. */
const GapBubble = ({ gap, shared, you }: { gap: number; shared: number; you: number }) => {
   const compR = 37;
   const compTotal = Math.max(1, gap + shared);
   const yourR = Math.max(3, Math.min(compR, Math.round((compR * Math.sqrt(Math.max(1, shared + you))) / Math.sqrt(compTotal))));
   const cx2 = 2 * compR - 2;
   const w = cx2 + yourR + 2;
   return (
      <svg width={w} height={74} style={{ overflow: 'visible', flexShrink: 0 }} aria-hidden>
         <defs><clipPath id="cdm-gapclip"><circle cx={compR} cy={37} r={compR} /></clipPath></defs>
         <circle cx={compR} cy={37} r={compR} fill="#F97316" fillOpacity={0.7} />
         <circle cx={cx2} cy={37} r={yourR} fill="#783AFB" fillOpacity={0.75} />
         {shared > 0 ? <circle cx={cx2} cy={37} r={yourR} fill="#FF6F77" clipPath="url(#cdm-gapclip)" /> : null}
      </svg>
   );
};

const Legend = ({ n, label, color }: { n: number; label: string; color: string }) => (
   <>
      <div style={{ textAlign: 'right', fontWeight: 600, color: '#18181B', fontSize: 14 }}>{n}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: '#18181B' }}>{label}<span style={{ width: 8, height: 8, borderRadius: 9999, background: color }} /></div>
   </>
);

/** Mention table: one "Mentioned" column (All Sources) or two ({own} / {competitor})
 *  in the Mention gap tab. Paged with "View more". */
const MentionTable = ({ rows, brand, ownLabel, gapMode }: { rows: MentionSource[]; brand: string; ownLabel: string; gapMode: boolean }) => {
   const [visible, setVisible] = useState(5);
   if (!rows.length) {
      return <div style={{ border: '1px solid #F4F4F5', borderRadius: 12, padding: 24, textAlign: 'center', fontSize: 13, color: '#9F9FA9' }}>No sources yet.</div>;
   }
   const clip = (s: string) => (s.length > 18 ? `${s.slice(0, 17)}…` : s);
   return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
         <div style={{ border: '1px solid #F4F4F5', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid #F4F4F5', fontSize: 13, color: '#71717B' }}>
               <div style={{ ...cell, flex: 1, minWidth: 0 }}>Source</div>
               {gapMode ? <div style={{ ...cell, width: 130, flexShrink: 0, justifyContent: 'center', borderLeft: '1px solid #F4F4F5' }} title={`${ownLabel} mentioned`}>{clip(ownLabel)} men…</div> : null}
               <div style={{ ...cell, width: 130, flexShrink: 0, justifyContent: 'center', borderLeft: '1px solid #F4F4F5' }} title={`${brand} mentioned`}>{gapMode ? `${clip(brand)} men…` : 'Mentioned'}</div>
               <div style={{ ...cell, width: 130, flexShrink: 0, justifyContent: 'flex-end', borderLeft: '1px solid #F4F4F5' }}>Times shown</div>
            </div>
            {rows.slice(0, visible).map((s) => {
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
                     {gapMode ? <div style={{ ...cell, width: 130, flexShrink: 0, justifyContent: 'center', borderLeft: '1px solid #F4F4F5', color: s.ownMentioned ? '#18181B' : '#71717B' }}>{s.ownMentioned ? <YesBadge /> : 'No'}</div> : null}
                     <div style={{ ...cell, width: 130, flexShrink: 0, justifyContent: 'center', borderLeft: '1px solid #F4F4F5', color: s.compMentioned ? '#18181B' : '#71717B' }}>{s.compMentioned ? <YesBadge /> : 'No'}</div>
                     <div style={{ ...cell, width: 130, flexShrink: 0, justifyContent: 'flex-end', borderLeft: '1px solid #F4F4F5', fontWeight: 600, color: '#18181B' }}>{s.timesShown}</div>
                  </div>
               );
            })}
         </div>
         {rows.length > visible ? (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
               <button type="button" onClick={() => setVisible((v) => v + 10)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', color: '#18181B', fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer' }}>View more <SortArrow asc={false} /></button>
            </div>
         ) : null}
      </div>
   );
};

const MentionsSection = ({ brand, ownLabel, mentions, sources, gap }: { brand: string; ownLabel: string; mentions: number; sources: MentionSource[]; gap: { gap: number; shared: number; you: number } }) => {
   const [tab, setTab] = useState<'all' | 'gap'>('all');
   const gapSources = useMemo(() => sources.filter((s) => s.compMentioned && !s.ownMentioned), [sources]);
   return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
         <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#18181B' }}>Mentions <span style={{ color: '#9F9FA9', fontWeight: 400 }}>{mentions}</span></span>
            <span style={{ fontSize: 13, color: '#71717B' }}>See which sources mention {brand}</span>
         </div>
         <Tabs value={tab} onChange={(v) => setTab(v as 'all' | 'gap')} options={[{ key: 'all', label: 'All Sources' }, { key: 'gap', label: 'Mention gap' }]} />
         {tab === 'gap' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
               <GapBubble gap={gap.gap} shared={gap.shared} you={gap.you} />
               <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 16px' }}>
                  <Legend n={gap.gap} label="Gap" color="#F97316" />
                  <Legend n={gap.shared} label="Shared" color="#FF6F77" />
                  <Legend n={gap.you} label={ownLabel} color="#783AFB" />
               </div>
            </div>
         ) : null}
         <MentionTable rows={tab === 'gap' ? gapSources : sources} brand={brand} ownLabel={ownLabel} gapMode={tab === 'gap'} />
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

/** Right slide-over for a competitor: stat cards, Mentions (All Sources / gap),
 *  per-prompt average position, and its own sources. */
const CompetitorDetailModal = ({ slug, list, index, onNavigate, onClose }: {
   slug: string | undefined;
   list: string[];
   index: number;
   onNavigate: (delta: number) => void;
   onClose: () => void;
}) => {
   const domain = list[index];
   const detailQ = useAiVisCompetitorDetail(slug, domain || null);
   const detail = detailQ.data;

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

   if (!domain) return null;
   const ov = detail?.overview;

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
               </div>

               <div role="separator" style={{ height: 1, background: '#F4F4F5' }} />

               {/* Mentions: which sources mention this competitor (+ Mention gap vs you) */}
               <div style={{ padding: 24 }}>
                  {detailQ.isLoading ? <SkeletonBox w="100%" h={220} /> : (
                     <MentionsSection
                        brand={detail?.brand || brandName(domain)}
                        ownLabel={detail?.ownLabel || 'You'}
                        mentions={detail?.mentions || 0}
                        sources={detail?.mentionSources || []}
                        gap={detail?.gap || { gap: 0, shared: 0, you: 0 }}
                     />
                  )}
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
