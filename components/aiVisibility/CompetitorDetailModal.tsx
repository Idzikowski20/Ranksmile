import React, { useEffect, useMemo, useState } from 'react';
import { SkeletonBox } from './SkeletonBlocks';
import { HoverTooltip, Button } from '../koala/core';
import { SourceStatusBadge } from '../koala/product/helpers/SourceStatusBadge';
import DomainFavicon from '../common/DomainFavicon';
import { useAiVisCompetitorDetail } from '../../services/aiVisibility';
import { AiVisSlidePortal, aiVisOverlayZ } from './AiVisSlidePortal';

const FONT = 'var(--font-family-primary)';
const brandName = (d: string) => { const base = d.replace(/^www\./, '').split('.')[0]; return base.charAt(0).toUpperCase() + base.slice(1); };

const InfoIcon = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--koala-text-secondary)', flexShrink: 0 }}><path d="M12 16v-4M12 8h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const ArrowUp = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const ArrowDown = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const CloseIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const SortArrow = ({ asc }: { asc: boolean }) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ transform: asc ? 'rotate(180deg)' : 'none' }}><path d="M12 5v14m0 0l-5-5m5 5l5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);

const StatCard = ({ label, value, hint }: { label: string; value: React.ReactNode; hint: string }) => (
   <div style={{ border: '1px solid var(--koala-border-primary)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--koala-text-secondary)' }}>
         {label}<HoverTooltip label={hint} align="center"><span style={{ display: 'inline-flex', cursor: 'help' }}><InfoIcon /></span></HoverTooltip>
      </span>
      <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--koala-text-primary)' }}>{value}</span>
   </div>
);

const cell: React.CSSProperties = { padding: '12px 16px', fontSize: 14, fontFamily: FONT, display: 'flex', alignItems: 'center', boxSizing: 'border-box' };

/** Only allow http/https source URLs as an href — reject `javascript:`/`data:`/malformed
 *  so a hostile scan URL can't execute when the row is clicked. */
const safeHref = (url: string): string | undefined => {
   try {
      const { protocol } = new URL(url);
      return protocol === 'http:' || protocol === 'https:' ? url : undefined;
   } catch {
      return undefined;
   }
};

type SourceRow = { url: string; domain: string; timesShown: number; mentioned?: boolean };
const splitUrl = (url: string, fallback: string) => { try { const u = new URL(url); return { host: u.host, path: `${u.pathname}${u.search}` }; } catch { return { host: fallback, path: '' }; } };

/** Compact Source | Mentioned | Times shown table with "View more" paging. */
const SourcesMini = ({ title, subtitle, sources }: { title: string; subtitle: string; sources: SourceRow[] }) => {
   const [visible, setVisible] = useState(5);
   const sorted = useMemo(() => [...sources].sort((a, b) => b.timesShown - a.timesShown), [sources]);
   return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
         <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--koala-text-primary)' }}>{title} <span style={{ color: 'var(--koala-text-secondary)', fontWeight: 400 }}>{sources.length}</span></span>
            <span style={{ fontSize: 13, color: 'var(--koala-text-secondary)' }}>{subtitle}</span>
         </div>
         {sorted.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', fontSize: 13, color: 'var(--koala-text-secondary)' }}>No sources yet.</div>
         ) : (
            <div style={{ overflow: 'hidden' }}>
               <div style={{ display: 'flex', borderBottom: '1px solid var(--koala-border-primary)', fontSize: 13, color: 'var(--koala-text-secondary)' }}>
                  <div style={{ ...cell, flex: 1, minWidth: 0 }}>Source</div>
                  <div style={{ ...cell, width: 110, flexShrink: 0, justifyContent: 'center' }}>Mentioned</div>
                  <div style={{ ...cell, width: 150, flexShrink: 0, justifyContent: 'flex-end' }}>Times shown</div>
               </div>
               {sorted.slice(0, visible).map((s) => {
                  const { host, path } = splitUrl(s.url, s.domain);
                  const href = safeHref(s.url);
                  const sourceInner = (
                     <>
                        <DomainFavicon domain={s.domain} size={18} />
                        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                           <span style={{ fontWeight: 500, color: 'var(--koala-text-primary)' }}>{host}</span>
                           <span style={{ color: 'var(--koala-text-secondary)' }}>{path}</span>
                        </span>
                     </>
                  );
                  return (
                     <div key={s.url} style={{ display: 'flex', borderTop: '1px solid var(--koala-border-primary)' }}>
                        {href ? (
                           <a href={href} target="_blank" rel="noopener noreferrer" style={{ ...cell, flex: 1, minWidth: 0, gap: 8, textDecoration: 'none', color: 'inherit' }}>{sourceInner}</a>
                        ) : (
                           <span title="Source URL is not a valid web link" style={{ ...cell, flex: 1, minWidth: 0, gap: 8, color: 'inherit' }}>{sourceInner}</span>
                        )}
                        <div style={{ ...cell, width: 110, flexShrink: 0, justifyContent: 'center' }}><SourceStatusBadge kind={s.mentioned ? 'yes' : 'no'} /></div>
                        <div style={{ ...cell, width: 150, flexShrink: 0, justifyContent: 'flex-end', fontWeight: 600, color: 'var(--koala-text-primary)' }}>
                           <span>{s.timesShown}</span>
                        </div>
                     </div>
                  );
               })}
            </div>
         )}
         {sorted.length > visible ? (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
               <Button type="button" variant="secondary" size="sm" onClick={() => setVisible((v) => v + 10)} style={{ gap: 6, fontFamily: FONT }}>View more <SortArrow asc={false} /></Button>
            </div>
         ) : null}
      </div>
   );
};

type MentionSource = { url: string; domain: string; timesShown: number; ownMentioned: boolean; compMentioned: boolean };

const HeadHint = ({ label }: { label: string }) => (
   <span title={label} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 4, textDecorationColor: '#C4C4CC' }}>{label}</span>
);

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
         <circle cx={cx2} cy={37} r={yourR} fill="#F84416" fillOpacity={0.75} />
         {shared > 0 ? <circle cx={cx2} cy={37} r={yourR} fill="#FF6F77" clipPath="url(#cdm-gapclip)" /> : null}
      </svg>
   );
};

const Legend = ({ n, label, color }: { n: number; label: string; color: string }) => (
   <>
      <div style={{ textAlign: 'right', fontWeight: 600, color: 'var(--koala-text-primary)', fontSize: 14 }}>{n}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--koala-text-primary)' }}>{label}<span style={{ width: 8, height: 8, borderRadius: 9999, background: color }} /></div>
   </>
);

/** Mention gap table: Source | {own} mentioned | {competitor} mentioned | Times shown. */
const MentionTable = ({ rows, brand, ownLabel }: { rows: MentionSource[]; brand: string; ownLabel: string }) => {
   const [visible, setVisible] = useState(5);
   if (!rows.length) {
      return <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--koala-text-secondary)' }}>No sources yet.</div>;
   }
   return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
         <div style={{ overflow: 'hidden', overflowX: 'auto' }}>
            <div style={{ minWidth: 480 }}>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--koala-border-primary)', fontSize: 13, color: 'var(--koala-text-secondary)' }}>
               <div style={{ ...cell, flex: 1, minWidth: 0 }}>Source</div>
               <div style={{ ...cell, width: 120, flexShrink: 0, justifyContent: 'center' }}><HeadHint label={`${ownLabel} mentioned`} /></div>
               <div style={{ ...cell, width: 120, flexShrink: 0, justifyContent: 'center' }}><HeadHint label={`${brand} mentioned`} /></div>
               <div style={{ ...cell, width: 150, flexShrink: 0, justifyContent: 'flex-end', fontWeight: 600, color: 'var(--koala-text-secondary)' }}>Times shown</div>
            </div>
            {rows.slice(0, visible).map((s) => {
               const { host, path } = splitUrl(s.url, s.domain);
               const href = safeHref(s.url);
               const sourceInner = (
                  <>
                     { /* eslint-disable-next-line @next/next/no-img-element */ }
                     <DomainFavicon domain={s.domain} size={18} />
                     <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 500, color: 'var(--koala-text-primary)' }}>{host}</span>
                        <span style={{ color: 'var(--koala-text-secondary)' }}>{path}</span>
                     </span>
                  </>
               );
               return (
                  <div key={s.url} style={{ display: 'flex', borderTop: '1px solid var(--koala-border-primary)' }}>
                     {href ? (
                        <a href={href} target="_blank" rel="noopener noreferrer" style={{ ...cell, flex: 1, minWidth: 0, gap: 8, textDecoration: 'none', color: 'inherit' }}>{sourceInner}</a>
                     ) : (
                        <span title="Source URL is not a valid web link" style={{ ...cell, flex: 1, minWidth: 0, gap: 8, color: 'inherit' }}>{sourceInner}</span>
                     )}
                     <div style={{ ...cell, width: 120, flexShrink: 0, justifyContent: 'center' }}><SourceStatusBadge kind={s.ownMentioned ? 'yes' : 'no'} /></div>
                     <div style={{ ...cell, width: 120, flexShrink: 0, justifyContent: 'center' }}><SourceStatusBadge kind={s.compMentioned ? 'yes' : 'no'} /></div>
                     <div style={{ ...cell, width: 150, flexShrink: 0, justifyContent: 'flex-end', gap: 10, fontWeight: 600, color: 'var(--koala-text-primary)' }}>
                        <span>{s.timesShown}</span>
                     </div>
                  </div>
               );
            })}
            </div>
         </div>
         {rows.length > visible ? (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
               <Button type="button" variant="secondary" size="sm" onClick={() => setVisible((v) => v + 10)} style={{ gap: 6, fontFamily: FONT }}>View more <SortArrow asc={false} /></Button>
            </div>
         ) : null}
      </div>
   );
};

const MentionsSection = ({ brand, ownLabel, mentions, sources, gap }: { brand: string; ownLabel: string; mentions: number; sources: MentionSource[]; gap: { gap: number; shared: number; you: number } }) => (
   <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
         <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--koala-text-primary)' }}>Mentions <span style={{ color: 'var(--koala-text-secondary)', fontWeight: 400 }}>{mentions}</span></span>
         <span style={{ fontSize: 13, color: 'var(--koala-text-secondary)' }}>See which sources mention {brand}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
         <GapBubble gap={gap.gap} shared={gap.shared} you={gap.you} />
         <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 16px' }}>
            <Legend n={gap.gap} label="Gap" color="#F97316" />
            <Legend n={gap.shared} label="Shared" color="#FF6F77" />
            <Legend n={gap.you} label={ownLabel} color="#F84416" />
         </div>
      </div>
      <MentionTable rows={sources} brand={brand} ownLabel={ownLabel} />
   </div>
);

const PromptsTable = ({ prompts }: { prompts: Array<{ promptId: number; text: string; avgPosition: number | null }> }) => {
   const [asc, setAsc] = useState(true);
   const sorted = useMemo(() => [...prompts].sort((a, b) => (asc ? (a.avgPosition ?? Infinity) - (b.avgPosition ?? Infinity) : (b.avgPosition ?? -Infinity) - (a.avgPosition ?? -Infinity))), [prompts, asc]);
   return (
      <div style={{ overflow: 'hidden' }}>
         <div style={{ display: 'flex', borderBottom: '1px solid var(--koala-border-primary)', fontSize: 13, color: 'var(--koala-text-secondary)' }}>
            <div style={{ ...cell, flex: 1, minWidth: 0 }}>Prompt</div>
            <div style={{ ...cell, width: 160, flexShrink: 0, justifyContent: 'flex-end' }}>
               <Button type="button" variant="transparent" size="sm" onClick={() => setAsc((v) => !v)} style={{ gap: 4, fontWeight: 600, color: 'var(--koala-text-secondary)' }}>Avg. position <SortArrow asc={asc} /></Button>
            </div>
         </div>
         {sorted.map((p) => (
            <div key={p.promptId} style={{ display: 'flex', borderTop: '1px solid var(--koala-border-primary)' }}>
               <div style={{ ...cell, flex: 1, minWidth: 0, color: 'var(--koala-text-primary)', lineHeight: 1.5 }}>{p.text}</div>
               <div style={{ ...cell, width: 160, flexShrink: 0, justifyContent: 'flex-end', color: p.avgPosition != null ? 'var(--koala-text-primary)' : 'var(--koala-text-secondary)' }}>{p.avgPosition != null ? p.avgPosition.toFixed(1) : '—'}</div>
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
      <AiVisSlidePortal>
         <div onClick={handleClose} style={{ position: 'fixed', inset: 0, zIndex: aiVisOverlayZ.backdrop, background: 'rgba(0,0,0,0.12)', opacity: visible ? 1 : 0, transition: 'opacity 200ms ease' }} role="presentation" />
         <div style={{ position: 'fixed', top: 8, bottom: 8, right: 8, width: 650, maxWidth: 'calc(100vw - 16px)', zIndex: aiVisOverlayZ.panel, background: 'var(--koala-bg-primary)', borderRadius: 16, boxShadow: '0px 24px 64px rgba(0,0,0,0.16), 0px 8px 24px rgba(0,0,0,0.08)', border: '1px solid var(--koala-border-primary)', display: 'flex', flexDirection: 'column', overflow: 'hidden', transform: visible ? 'translateX(0)' : 'translateX(calc(100% + 16px))', transition: 'transform 220ms cubic-bezier(0.16,1,0.3,1)', fontFamily: FONT }} role="dialog" aria-modal="true">
            {/* Header */}
            <div style={{ padding: '20px 24px 16px', display: 'flex', flexDirection: 'column', gap: 16, borderBottom: '1px solid var(--koala-border-primary)' }}>
               <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                     <Button type="button" variant="transparent" size="sm" aria-label="Previous" disabled={!canUp} onClick={() => onNavigate(-1)} icon={<ArrowUp />} style={{ opacity: canUp ? 1 : 0.35 }} />
                     <Button type="button" variant="transparent" size="sm" aria-label="Next" disabled={!canDown} onClick={() => onNavigate(1)} icon={<ArrowDown />} style={{ opacity: canDown ? 1 : 0.35 }} />
                  </div>
                  <Button type="button" variant="transparent" size="sm" aria-label="Close" onClick={handleClose} icon={<CloseIcon />} />
               </div>
               <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  { /* eslint-disable-next-line @next/next/no-img-element */ }
                  <DomainFavicon domain={domain} size={22} />
                  <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--koala-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{domain}</span>
               </h2>
            </div>

            {/* Body */}
            <div className="styled-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
               <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                     <StatCard label="Visibility score" hint="Average visibility across all tracked prompts and models" value={detailQ.isLoading ? <SkeletonBox w={40} h={26} /> : (ov?.visibilityScore ?? 0)} />
                     <StatCard label="Mention rate" hint="Share of prompt/model answers that cite this competitor" value={detailQ.isLoading ? <SkeletonBox w={40} h={26} /> : `${ov?.mentionRate ?? 0}%`} />
                     <StatCard label="Average position" hint="Average citation rank when this competitor is cited" value={detailQ.isLoading ? <SkeletonBox w={40} h={26} /> : (ov?.avgPosition != null ? ov.avgPosition.toFixed(1) : '—')} />
                  </div>
               </div>

               <div role="separator" style={{ height: 1, background: 'var(--koala-border-primary)' }} />

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

               <div role="separator" style={{ height: 1, background: 'var(--koala-border-primary)' }} />

               {/* Prompts */}
               <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                     <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--koala-text-primary)' }}>Prompts <span style={{ color: 'var(--koala-text-secondary)', fontWeight: 400 }}>{detail?.prompts.length ?? 0}</span></span>
                     <span style={{ fontSize: 13, color: 'var(--koala-text-secondary)' }}>See how {brandName(domain)} performs across different prompts</span>
                  </div>
                  {detailQ.isLoading ? <SkeletonBox w="100%" h={200} /> : <PromptsTable prompts={detail?.prompts || []} />}
               </div>

               <div role="separator" style={{ height: 1, background: 'var(--koala-border-primary)' }} />

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
      </AiVisSlidePortal>
   );
};

export default CompetitorDetailModal;
