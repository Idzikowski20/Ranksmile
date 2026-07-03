import React, { useEffect, useState } from 'react';
import { Tabs } from '../ui';
import type { KeywordGroup, TopicCluster } from '../../lib/topicalMap';

const FONT = 'var(--font-family-primary)';

const HexIcon = () => (
   <svg viewBox="0 0 256 256" width="20" height="20" aria-hidden="true" style={{ color: '#783AFB', flexShrink: 0 }}>
      <g fill="currentColor">
         <path d="M224 80.18v95.64a8 8 0 0 1-4.16 7l-88 48.18a8 8 0 0 1-7.68 0l-88-48.18a8 8 0 0 1-4.16-7V80.18a8 8 0 0 1 4.16-7l88-48.18a8 8 0 0 1 7.68 0l88 48.18a8 8 0 0 1 4.16 7" opacity="0.2" />
         <path d="m223.68 66.15l-88-48.15a15.88 15.88 0 0 0-15.36 0l-88 48.17a16 16 0 0 0-8.32 14v95.64a16 16 0 0 0 8.32 14l88 48.17a15.88 15.88 0 0 0 15.36 0l88-48.17a16 16 0 0 0 8.32-14V80.18a16 16 0 0 0-8.32-14.03M216 175.82L128 224l-88-48.18V80.18L128 32l88 48.17Z" />
      </g>
   </svg>
);
const XIcon = () => (
   <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" /></svg>
);
const ChevronUp = ({ open }: { open: boolean }) => (
   <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden="true" style={{ transform: open ? 'none' : 'rotate(180deg)', transition: 'transform 200ms ease', flexShrink: 0 }}>
      <path fillRule="evenodd" d="M9.47 6.47a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 1 1-1.06 1.06L10 8.06l-3.72 3.72a.75.75 0 0 1-1.06-1.06z" clipRule="evenodd" />
   </svg>
);

const STATUS_META: Record<TopicCluster['status'], { label: string; dot: string; color: string }> = {
   covered: { label: 'Covered', dot: '#1AB25E', color: '#15803D' },
   recommended: { label: 'Recommended', dot: '#FF6F77', color: '#B91C1C' },
   not_covered: { label: 'Not covered', dot: '#9F9FA9', color: '#52525C' },
};

const num = (v: number | null | undefined): string => (v === null || v === undefined ? '' : String(v));

const StatCell = ({ label, value }: { label: string; value: React.ReactNode }) => (
   <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 20px', flex: 1, minWidth: 0 }}>
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#71717B', fontFamily: FONT }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: '#18181B', fontFamily: FONT }}>{value}</span>
   </div>
);

const OverviewSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
   <section style={{ border: '1px solid #F4F4F5', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h3 style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#71717B', fontFamily: FONT }}>{title}</h3>
      {children}
   </section>
);

const TIER_COLORS: Record<string, { bg: string; color: string }> = {
   'Very High': { bg: '#F0FDF4', color: '#15803D' },
   High: { bg: 'rgba(120,58,251,0.08)', color: '#783AFB' },
   Medium: { bg: '#FEF3C7', color: '#B45309' },
   Low: { bg: '#F4F4F5', color: '#52525C' },
};

const OverviewTab = ({ cluster }: { cluster: TopicCluster }) => {
   const { opportunity: opp } = cluster;
   const tier = TIER_COLORS[opp.tier];
   return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
         <OverviewSection title="Opportunity">
            <div style={{ display: 'flex', border: '1px solid #F4F4F5', borderRadius: 8 }}>
               <StatCell label="Opportunity" value={(
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                     {opp.score}
                     <span style={{ background: tier.bg, color: tier.color, borderRadius: 9999, padding: '1px 8px', fontSize: 11, fontWeight: 600 }}>{opp.tier}</span>
                  </span>
               )} />
               <div style={{ width: 1, background: '#F4F4F5' }} />
               <StatCell label="Estimated gain" value={`+${opp.estGainClicks} clicks/mo`} />
               <div style={{ width: 1, background: '#F4F4F5' }} />
               <StatCell label="Difficulty" value={opp.difficulty} />
               <div style={{ width: 1, background: '#F4F4F5' }} />
               <StatCell label="Priority" value={opp.priority} />
            </div>
         </OverviewSection>
      </div>
   );
};

const KW_TH: React.CSSProperties = { padding: '8px 16px', textAlign: 'right', fontSize: 13, fontWeight: 400, color: '#71717B', fontFamily: FONT, borderLeft: '1px solid #F4F4F5', textDecoration: 'underline dotted', textDecorationColor: '#9F9FA9', textUnderlineOffset: 4, whiteSpace: 'nowrap' };
const KW_TD: React.CSSProperties = { padding: '12px 16px', textAlign: 'right', fontSize: 14, color: '#18181B', fontFamily: FONT, borderLeft: '1px solid #F4F4F5' };

const GroupBlock = ({ group }: { group: KeywordGroup }) => {
   const [open, setOpen] = useState(true);
   const covered = group.keywords.filter((k) => k.covered);
   const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : 0);
   const meta: Array<[string, string]> = [
      [`${group.keywords.length} KEYWORD${group.keywords.length > 1 ? 'S' : ''}`, ''],
      ...(covered.length ? [['AVG. POS.', String(avg(covered.map((k) => k.position || 0)))] as [string, string]] : []),
      ['AVG. KD', String(avg(group.keywords.map((k) => k.kd)))],
      ...(covered.length ? [['TOTAL IMPR.', String(group.keywords.reduce((s, k) => s + (k.impressions || 0), 0))] as [string, string]] : []),
      ['TOTAL VOL.', String(group.keywords.reduce((s, k) => s + k.vol, 0))],
   ];
   return (
      <div style={{ border: '1px solid #F4F4F5', borderRadius: 8, overflow: 'hidden' }}>
         <div
            role="button"
            tabIndex={0}
            onClick={() => setOpen((o) => !o)}
            onKeyDown={(e) => { if (e.key === 'Enter') setOpen((o) => !o); }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: 12, background: '#F8F8F9', cursor: 'pointer' }}
         >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
               {group.url ? (
                  <a href={group.url} onClick={(e) => e.stopPropagation()} target="_blank" rel="noopener noreferrer" style={{ fontSize: 15, fontWeight: 600, color: '#18181B', fontFamily: FONT, textDecoration: 'none' }}>
                     {group.label} <span aria-hidden="true">↗</span>
                  </a>
               ) : (
                  <span style={{ fontSize: 15, fontWeight: 600, color: '#18181B', fontFamily: FONT }}>{group.label}</span>
               )}
               <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12, fontFamily: FONT }}>
                  {meta.map(([k, v], i) => (
                     <React.Fragment key={k}>
                        {i > 0 && <span style={{ color: '#9F9FA9' }}>•</span>}
                        <span>
                           <span style={{ color: '#71717B' }}>{k}</span>
                           {v && <span style={{ color: '#18181B', marginLeft: 4 }}>{v}</span>}
                        </span>
                     </React.Fragment>
                  ))}
               </div>
            </div>
            <ChevronUp open={open} />
         </div>
         {open && (
            <div style={{ borderTop: '1px solid #F4F4F5' }}>
               <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                     <tr style={{ borderBottom: '1px solid #F4F4F5' }}>
                        <th style={{ ...KW_TH, textAlign: 'left', borderLeft: 'none', textDecoration: 'none', width: '100%' }}>Keywords</th>
                        <th style={KW_TH}>Position</th>
                        <th style={KW_TH}>KD</th>
                        <th style={KW_TH}>Impr.</th>
                        <th style={KW_TH}>Vol.</th>
                     </tr>
                  </thead>
                  <tbody>
                     {group.keywords.map((k) => (
                        <tr key={k.text} style={{ borderBottom: '1px solid #F4F4F5', height: 48 }}>
                           <td style={{ ...KW_TD, textAlign: 'left', borderLeft: 'none' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                 {k.text}
                                 {k.isMain && (
                                    <span style={{ background: '#3F3F47', color: '#fff', borderRadius: 4, padding: '1px 6px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', fontFamily: FONT }}>main</span>
                                 )}
                              </span>
                           </td>
                           <td style={KW_TD}>{num(k.position)}</td>
                           <td style={KW_TD}>{k.kd}</td>
                           <td style={KW_TD}>{num(k.impressions)}</td>
                           <td style={KW_TD}>{k.vol}</td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         )}
      </div>
   );
};

export type PanelTab = 'overview' | 'keywords' | 'competitors';

const TopicalClusterPanel = ({ cluster, initialTab = 'overview', onClose }: { cluster: TopicCluster | null; initialTab?: PanelTab; onClose: () => void }) => {
   const [visible, setVisible] = useState(false);
   const [tab, setTab] = useState<PanelTab>(initialTab);

   useEffect(() => {
      if (cluster) {
         setTab(initialTab);
         const t = setTimeout(() => setVisible(true), 10);
         return () => clearTimeout(t);
      }
      setVisible(false);
      return undefined;
   }, [cluster, initialTab]);

   const handleClose = () => { setVisible(false); setTimeout(onClose, 220); };
   if (!cluster) return null;
   const m = STATUS_META[cluster.status];

   return (
      <>
         <div onClick={handleClose} role="presentation" style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.12)', opacity: visible ? 1 : 0, transition: 'opacity 200ms ease' }} />
         <div style={{ position: 'fixed', top: 8, bottom: 8, right: 8, width: 920, maxWidth: 'calc(100vw - 16px)', zIndex: 301, background: '#fff', borderRadius: 16, boxShadow: '0px 24px 64px rgba(0,0,0,0.16), 0px 8px 24px rgba(0,0,0,0.08)', border: '1px solid #E4E4E7', display: 'flex', flexDirection: 'column', overflow: 'hidden', transform: visible ? 'translateX(0)' : 'translateX(calc(100% + 16px))', transition: 'transform 220ms cubic-bezier(0.16,1,0.3,1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 24px 16px' }}>
               <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <HexIcon />
                  <span style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', color: '#52525C', fontFamily: FONT }}>Idea</span>
               </span>
               <button type="button" aria-label="Close" onClick={handleClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#18181B', padding: 0, display: 'inline-flex' }}>
                  <XIcon />
               </button>
            </div>
            <div className="styled-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
               <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                     <span style={{ fontSize: 18, fontWeight: 600, color: '#18181B', fontFamily: FONT }}>{cluster.mainKeyword}</span>
                     <span style={{ fontSize: 14, color: '#18181B', fontFamily: FONT }}>includes {cluster.keywords.length} keywords</span>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, color: m.color, fontFamily: FONT, whiteSpace: 'nowrap', alignSelf: 'center' }}>
                     <span style={{ width: 8, height: 8, borderRadius: 9999, background: m.dot }} />
                     {m.label}
                  </span>
               </div>
               <div style={{ display: 'flex', border: '1px solid #F4F4F5', borderRadius: 8 }}>
                  <StatCell label="Avg. Position" value={num(cluster.position)} />
                  <div style={{ width: 1, background: '#F4F4F5' }} />
                  <StatCell label="KD" value={cluster.kd} />
                  <div style={{ width: 1, background: '#F4F4F5' }} />
                  <StatCell label="Total Impressions" value={cluster.impressions} />
                  <div style={{ width: 1, background: '#F4F4F5' }} />
                  <StatCell label="Vol." value={cluster.vol} />
               </div>
               <div>
                  <Tabs
                     items={[
                        { value: 'overview', label: 'Overview' },
                        { value: 'keywords', label: 'Keywords', count: cluster.keywords.length },
                        { value: 'competitors', label: 'Competitors', count: cluster.competitors.length },
                     ]}
                     value={tab}
                     onChange={(v) => setTab(v as PanelTab)}
                  />
               </div>
               {tab === 'overview' && <OverviewTab cluster={cluster} />}
               {tab === 'keywords' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                     {cluster.groups.map((g) => <GroupBlock key={g.label} group={g} />)}
                  </div>
               )}
               {tab === 'competitors' && (
                  <div className="styled-scrollbar" style={{ border: '1px solid #F4F4F5', borderRadius: 8, maxHeight: 480, overflowY: 'auto' }}>
                     <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                           <tr style={{ borderBottom: '1px solid #F4F4F5' }}>
                              <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 14, fontWeight: 400, color: '#18181B', fontFamily: FONT, width: 300 }}>Domain</th>
                              <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 14, fontWeight: 400, color: '#18181B', fontFamily: FONT, borderLeft: '1px solid #F4F4F5' }}>URL</th>
                           </tr>
                        </thead>
                        <tbody>
                           {cluster.competitors.map((cp) => (
                              <tr key={cp.domain} style={{ borderBottom: '1px solid #F4F4F5' }}>
                                 <td style={{ padding: 12, width: 300 }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                       <img alt="" width={20} height={20} style={{ borderRadius: 4, flexShrink: 0 }} src={`https://www.google.com/s2/favicons?domain=${cp.domain}&sz=32`} />
                                       <span style={{ fontSize: 14, fontWeight: 600, color: '#18181B', fontFamily: FONT }}>{cp.domain}</span>
                                    </span>
                                 </td>
                                 <td style={{ padding: 12, borderLeft: '1px solid #F4F4F5', maxWidth: 430 }}>
                                    <a href={cp.href} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#18181B', fontFamily: FONT, textDecoration: 'none', display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                       {cp.path} <span aria-hidden="true">↗</span>
                                    </a>
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               )}
            </div>
         </div>
      </>
   );
};

export default TopicalClusterPanel;
