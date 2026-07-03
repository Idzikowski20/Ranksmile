import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import AiVisPageShell from '../../../../components/aiVisibility/AiVisPageShell';
import { SkeletonBars, SkeletonRows, SkeletonBox } from '../../../../components/aiVisibility/SkeletonBlocks';
import CompetitorBarChart from '../../../../components/aiVisibility/CompetitorBarChart';
import TrendLineChart from '../../../../components/aiVisibility/TrendLineChart';
import TopCompetitorsList from '../../../../components/aiVisibility/TopCompetitorsList';
import MetricTrendChart from '../../../../components/aiVisibility/MetricTrendChart';
import { useAiVisOverview, useAiVisHistory, useStartAiVisScan, type DomainOverview } from '../../../../services/aiVisibility';
import { Modal } from '../../../../components/ui';

const FONT = 'var(--font-family-primary)';

type MetricDelta = { current: number; previous: number; delta: number; trend: 'up' | 'down' | 'same' };
type OverviewDelta = {
   visibilityScore: MetricDelta;
   perModel: Array<{ model: string } & MetricDelta>;
   sources: { added: string[]; removed: string[] };
   prompts: { gained: number[]; lost: number[] };
};

const card: React.CSSProperties = { border: '1px solid #F4F4F5', borderRadius: 12, background: '#fff' };
const cardHeader: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '20px 24px 0' };
const cardTitle: React.CSSProperties = { fontSize: 15, fontWeight: 600, color: '#3F3F47', fontFamily: FONT };
const viewAll: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', border: '1px solid #E4E4E7', borderRadius: 8, padding: '6px 12px', fontSize: 14, fontWeight: 600, color: '#52525C', fontFamily: FONT, textDecoration: 'none', whiteSpace: 'nowrap' };

const Panel = ({ title, action, children }: { title: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) => (
   <section style={card}>
      <div style={cardHeader}><span style={cardTitle}>{title}</span>{action}</div>
      <div style={{ padding: 24 }}>{children}</div>
   </section>
);

const faviconFor = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

const BarIcon = () => (<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="7" width="3" height="6" rx="1" fill="currentColor" /><rect x="5.5" y="4" width="3" height="9" rx="1" fill="currentColor" /><rect x="10" y="1" width="3" height="12" rx="1" fill="currentColor" /></svg>);
const LineIcon = () => (<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><polyline points="1,10 5,6 8,8 13,2" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const HashIcon = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M9.5 3L6.5 21M17.5 3L14.5 21M20.5 8H3.5M19.5 16H2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const PromptIcon = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M3.29289 4.29289C3.68342 3.90237 4.31658 3.90237 4.70711 4.29289L10.7071 10.2929C11.0976 10.6834 11.0976 11.3166 10.7071 11.7071L4.70711 17.7071C4.31658 18.0976 3.68342 18.0976 3.29289 17.7071C2.90237 17.3166 2.90237 16.6834 3.29289 16.2929L8.58579 11L3.29289 5.70711C2.90237 5.31658 2.90237 4.68342 3.29289 4.29289Z" fill="currentColor" /><path fillRule="evenodd" clipRule="evenodd" d="M11 19C11 18.4477 11.4477 18 12 18H20C20.5523 18 21 18.4477 21 19C21 19.5523 20.5523 20 20 20H12C11.4477 20 11 19.5523 11 19Z" fill="currentColor" /></svg>);
const InfoIcon = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ color: '#9F9FA9', flexShrink: 0 }}><path d="M12 16v-4M12 8h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);

const fmtK = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K` : String(n));
const splitUrl = (url: string, fallback: string): { host: string; path: string } => {
   try { const u = new URL(url); return { host: u.host, path: `${u.pathname}${u.search}` }; } catch { return { host: fallback, path: '' }; }
};

const DeltaBadge = ({ d }: { d: MetricDelta }) => {
   if (d.trend === 'same') return null;
   const up = d.trend === 'up';
   return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 13, fontWeight: 600, color: up ? '#1AB25E' : '#FF6F77', fontFamily: FONT }}>
         {up ? '↑' : '↓'}{Math.abs(d.delta)}
      </span>
   );
};

const daysAgo = (iso?: string | null): number | null => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : null);

const AiVisibilityOverview: NextPage = () => {
   const router = useRouter();
   const { domain: slug } = router.query as { domain: string };
   const [promptMode, setPromptMode] = useState<'topics' | 'prompts'>('topics');
   const [compareDomain, setCompareDomain] = useState<string | null>(null);
   const [chartMode, setChartMode] = useState<'bar' | 'line'>('bar');

   // Base query: own snapshot + top-5 competitor snapshots (no competitor param).
   const baseQ = useAiVisOverview(slug);
   const ov = baseQ.data;
   const competitors = ov?.competitors || []; // top-5, each with embedded snapshot (sources emptied)
   const competitorsAll = ov?.competitorsAll || []; // all domains, for the picker
   // Auto-select the #1 competitor ONCE when data first arrives. A ref (not a
   // `!compareDomain` guard) so an explicit "Clear comparison" isn't re-populated.
   const didInitCompare = useRef(false);
   useEffect(() => {
      if (!didInitCompare.current && competitors.length) { didInitCompare.current = true; setCompareDomain(competitors[0].domain); }
   }, [competitors]);

   // Local-first: an embedded top-5 snapshot is a pure state change; only a long-tail
   // pick (outside top-5) fires a second request (distinct query key → top-5 never refetches).
   const embeddedSnap = compareDomain ? (competitors.find((c) => c.domain === compareDomain)?.snapshot ?? null) : null;
   const isLongTail = !!compareDomain && !embeddedSnap;
   const longTailQ = useAiVisOverview(slug, isLongTail ? (compareDomain as string) : undefined);
   const compareSnap = embeddedSnap ?? (isLongTail ? (longTailQ.data?.compare?.snapshot ?? null) : null);

   const historyQ = useAiVisHistory(slug, compareDomain || undefined);

   const startScan = useStartAiVisScan(slug);
   const [confirmDays, setConfirmDays] = useState<number | null>(null);

   const runScan = async (force: boolean) => {
      const res = await startScan.mutateAsync(force ? { force: true } : undefined);
      if (res.needsConfirm) { setConfirmDays(res.lastScanDaysAgo); return; }
      setConfirmDays(null);
      toast.success('Scan started');
   };

   return (
      <AiVisPageShell
         section="AI Visibility"
         title="Overview"
         compareCompetitors={competitorsAll}
         compareSelected={compareDomain}
         onCompareSelect={setCompareDomain}
      >
         {({ crunching }) => {
            const pending = crunching || baseQ.isLoading || ov?.pending || !ov?.snapshot;
            const own = ov?.snapshot?.overview;
            const comp = compareSnap?.overview ?? null;
            const delta = (ov?.delta as OverviewDelta | null | undefined) || null;

            // Topics & Prompts come pre-scored from the snapshot; zip with the compared
            // snapshot by topic-name / promptId for the "vs" figure.
            const ownTopics = ov?.snapshot?.topics || [];
            const ownPrompts = ov?.snapshot?.prompts || [];
            const compTopicByName = new Map((compareSnap?.topics || []).map((t) => [t.topic, t.score]));
            const compPromptById = new Map((compareSnap?.prompts || []).map((p) => [p.promptId, p.score]));
            const topicRows = ownTopics.slice(0, 5).map((t) => ({ key: t.topic, label: t.topic, score: t.score, vs: comp ? (compTopicByName.get(t.topic) ?? 0) : null }));
            const promptRows = ownPrompts.slice(0, 5).map((p) => ({ key: String(p.promptId), label: p.text, score: p.score, vs: comp ? (compPromptById.get(p.promptId) ?? 0) : null }));
            const rows = promptMode === 'topics' ? topicRows : promptRows;

            const sources = (ov?.snapshot?.sources || []).slice(0, 5);
            const sourceCount = ov?.snapshot?.sources.length || 0;

            // Per-metric trend series (You + optional competitor) from /history.
            const histScans = historyQ.data?.scans || [];
            const histLabels = histScans.map((s) => (s.finishedAt ? new Date(s.finishedAt).toLocaleDateString() : ''));
            const youVals = (pick: (o: DomainOverview) => number | null): Array<number | null> => histScans.map((s) => (s.series.you ? pick(s.series.you) : null));
            const compVals = (pick: (o: DomainOverview) => number | null): Array<number | null> => histScans.map((s) => (s.series.competitor ? pick(s.series.competitor) : null));

            let chartBody: React.ReactNode;
            if (pending) {
               chartBody = <SkeletonBars />;
            } else if (chartMode === 'bar') {
               chartBody = <CompetitorBarChart competitors={competitors.map((c) => ({ domain: c.domain, overview: c.snapshot.overview }))} selected={compareDomain} onSelect={setCompareDomain} />;
            } else {
               // Line mode mirrors SurferSEO: trend on the left, a "Top Competitors"
               // picker on the right (the line only plots You + the chosen competitor).
               chartBody = (
                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                     <div style={{ flex: '1 1 380px', minWidth: 0 }}>
                        <TrendLineChart scans={historyQ.data?.scans || []} competitorDomain={compareDomain} />
                     </div>
                     <div style={{ flex: '1 1 200px', minWidth: 200, maxWidth: 300 }}>
                        <TopCompetitorsList competitors={competitors.map((c) => ({ domain: c.domain, score: c.snapshot.overview.visibilityScore }))} selected={compareDomain} onSelect={setCompareDomain} />
                     </div>
                  </div>
               );
            }

            return (
               <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                     <button
                        type="button"
                        onClick={() => runScan(false)}
                        disabled={startScan.isLoading || crunching}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #E4E4E7', borderRadius: 8, padding: '7px 14px', background: '#fff', color: '#18181B', fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: startScan.isLoading || crunching ? 'not-allowed' : 'pointer' }}
                     >
                        {crunching ? 'Scanning…' : 'Refresh data'}
                     </button>
                  </div>

                  {/* Visibility score — competitor ranking + Compare */}
                  <Panel
                     title={(
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                           Visibility score: <span style={{ fontWeight: 400, color: '#18181B' }}>{pending || !own ? '—' : own.visibilityScore}</span>
                           {!pending && delta ? <DeltaBadge d={delta.visibilityScore} /> : null}
                           {!pending && comp ? <span style={{ fontSize: 14, color: '#71717B', fontWeight: 400 }}>vs {comp.visibilityScore} · {compareDomain}</span> : null}
                           {!pending && daysAgo(ov?.finishedAt) !== null ? (
                              <span style={{ fontSize: 12, color: '#9F9FA9', fontWeight: 400 }}>· last updated {daysAgo(ov?.finishedAt) === 0 ? 'today' : `${daysAgo(ov?.finishedAt)}d ago`}</span>
                           ) : null}
                           {!pending && typeof ov?.daysUntilRefresh === 'number' ? (
                              <span style={{ fontSize: 12, color: '#9F9FA9', fontWeight: 400 }}>· next auto refresh in {ov.daysUntilRefresh}d</span>
                           ) : null}
                        </span>
                     )}
                     action={(
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                           <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: 3, borderRadius: 10, background: '#F4F4F5' }}>
                              {(['bar', 'line'] as const).map((m) => {
                                 const on = chartMode === m;
                                 return (
                                    <button key={m} type="button" onClick={() => setChartMode(m)} title={m === 'bar' ? 'Competitor ranking' : 'Trend over time'} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 28, border: 'none', borderRadius: 7, background: on ? '#fff' : 'transparent', color: on ? '#783AFB' : '#9F9FA9', boxShadow: on ? '0 1px 2px rgba(0,0,0,0.10)' : 'none', cursor: 'pointer', transition: 'color 150ms ease' }}>{m === 'bar' ? <BarIcon /> : <LineIcon />}</button>
                                 );
                              })}
                           </div>
                           <Link href={`/sites/${slug}/ai-visibility/competitors`} passHref><a style={viewAll}>View Competitors</a></Link>
                        </div>
                     )}
                  >
                     {chartBody}
                  </Panel>

                  {/* Topics & Prompts + Sources */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
                     <Panel
                        title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Topics &amp; Prompts <InfoIcon /></span>}
                        action={(
                           <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: 3, borderRadius: 10, background: '#F4F4F5' }}>
                                 {(['topics', 'prompts'] as const).map((m) => {
                                    const on = promptMode === m;
                                    return (
                                       <button key={m} type="button" onClick={() => setPromptMode(m)} title={m === 'topics' ? 'Topics' : 'Prompts'} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 28, border: 'none', borderRadius: 7, background: on ? '#fff' : 'transparent', color: on ? '#783AFB' : '#9F9FA9', boxShadow: on ? '0 1px 2px rgba(0,0,0,0.10)' : 'none', cursor: 'pointer' }}>{m === 'topics' ? <HashIcon /> : <PromptIcon />}</button>
                                    );
                                 })}
                              </div>
                              <Link href={`/sites/${slug}/ai-visibility/prompts`} passHref><a style={viewAll}>View all</a></Link>
                           </div>
                        )}
                     >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                           <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#71717B', fontFamily: FONT }}>
                              <span>{promptMode === 'topics' ? 'Topics' : 'Prompts'}</span><span>Visibility score</span>
                           </div>
                           {pending ? <SkeletonRows count={5} /> : rows.length === 0 ? (
                              <span style={{ fontSize: 14, color: '#9F9FA9', fontFamily: FONT }}>No data yet.</span>
                           ) : rows.map((r) => (
                              <div key={r.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                 <span title={r.label} style={{ fontSize: 14, color: '#18181B', fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
                                 <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 14, fontFamily: FONT, whiteSpace: 'nowrap' }}>
                                    <span style={{ color: '#18181B' }}>{r.score}</span>
                                    {r.vs != null ? <span style={{ color: '#9F9FA9' }}>vs. {r.vs}</span> : null}
                                 </span>
                              </div>
                           ))}
                        </div>
                     </Panel>

                     <Panel
                        title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Sources{sourceCount ? `: ${fmtK(sourceCount)}` : ''} <InfoIcon /></span>}
                        action={<Link href={`/sites/${slug}/ai-visibility/sources`} passHref><a style={viewAll}>View all</a></Link>}
                     >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                           <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#71717B', fontFamily: FONT }}>
                              <span>Link</span><span>Times shown</span>
                           </div>
                           {pending ? <SkeletonRows count={5} withIcon /> : sources.length === 0 ? (
                              <span style={{ fontSize: 14, color: '#9F9FA9', fontFamily: FONT }}>No sources yet.</span>
                           ) : sources.map((s) => {
                              const { host, path } = splitUrl(s.url, s.domain);
                              return (
                                 <div key={s.url} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                    <a href={s.url} target="_blank" rel="noopener noreferrer" title={s.url} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0, textDecoration: 'none' }}>
                                       { /* eslint-disable-next-line @next/next/no-img-element */ }
                                       <img alt="" src={faviconFor(s.domain)} width={20} height={20} style={{ borderRadius: 4, flexShrink: 0 }} />
                                       <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 14, fontFamily: FONT }}>
                                          <span style={{ fontWeight: 600, color: '#18181B' }}>{host}</span>
                                          <span style={{ color: '#9F9FA9' }}>{path}</span>
                                       </span>
                                    </a>
                                    <span style={{ fontSize: 14, fontWeight: 600, color: '#18181B', fontFamily: FONT, flexShrink: 0 }}>{s.timesShown}</span>
                                 </div>
                              );
                           })}
                        </div>
                     </Panel>
                  </div>

                  {/* Metric trends */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
                     <section style={card}>
                        <div style={cardHeader}>
                           <span style={{ ...cardTitle, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              Mention rate: <span style={{ color: '#18181B', fontWeight: 700 }}>{own ? `${own.mentionRate}%` : '—'}</span>
                              {comp ? <span style={{ color: '#9F9FA9', fontWeight: 400 }}>vs. {comp.mentionRate}%</span> : null}
                              <InfoIcon />
                           </span>
                        </div>
                        <div style={{ padding: 24 }}>
                           {pending ? <SkeletonBox w="100%" h={200} radius={10} /> : (
                              <MetricTrendChart
                                 labels={histLabels}
                                 lines={[
                                    { label: 'You', data: youVals((o) => o.mentionRate), color: '#783AFB' },
                                    ...(compareDomain ? [{ label: compareDomain, data: compVals((o) => o.mentionRate), color: '#9F9FA9' }] : []),
                                 ]}
                                 yMin={0}
                                 yMax={100}
                                 percent
                              />
                           )}
                        </div>
                     </section>

                     <section style={card}>
                        <div style={cardHeader}>
                           <span style={{ ...cardTitle, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              Average position: <span style={{ color: '#18181B', fontWeight: 700 }}>{own ? (own.avgPosition ?? '—') : '—'}</span>
                              {comp ? <span style={{ color: '#9F9FA9', fontWeight: 400 }}>vs. {comp.avgPosition ?? '—'}</span> : null}
                              <InfoIcon />
                           </span>
                        </div>
                        <div style={{ padding: 24 }}>
                           {pending ? <SkeletonBox w="100%" h={200} radius={10} /> : (
                              <MetricTrendChart
                                 labels={histLabels}
                                 lines={[
                                    { label: 'You', data: youVals((o) => o.avgPosition), color: '#783AFB' },
                                    ...(compareDomain ? [{ label: compareDomain, data: compVals((o) => o.avgPosition), color: '#9F9FA9' }] : []),
                                 ]}
                                 yMin={1}
                                 yMax={10}
                                 reverse
                              />
                           )}
                        </div>
                     </section>

                     <section style={card}>
                        <div style={{ ...cardHeader, gap: 16, flexWrap: 'wrap' }}>
                           <span style={{ ...cardTitle, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#18181B', flexShrink: 0 }} />
                              Direct citations: <span style={{ color: '#18181B', fontWeight: 700 }}>{own ? own.directCitations : '—'}</span>
                           </span>
                           <span style={{ ...cardTitle, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#9F9FA9', flexShrink: 0 }} />
                              Pages: <span style={{ color: '#18181B', fontWeight: 700 }}>{own ? own.pages : '—'}</span>
                           </span>
                        </div>
                        <div style={{ padding: 24 }}>
                           {pending ? <SkeletonBox w="100%" h={200} radius={10} /> : (
                              <MetricTrendChart
                                 labels={histLabels}
                                 lines={[
                                    { label: 'Direct citations', data: youVals((o) => o.directCitations), color: '#18181B' },
                                    { label: 'Pages', data: youVals((o) => o.pages), color: '#9F9FA9' },
                                 ]}
                                 yMin={0}
                              />
                           )}
                        </div>
                     </section>
                  </div>

                  {confirmDays !== null && (
                     <Modal title="Refresh AI Visibility?" onClose={() => setConfirmDays(null)} width={460}>
                        <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                           <p style={{ margin: 0, fontSize: 14, color: '#52525C', fontFamily: FONT }}>
                              Ostatni skan {confirmDays === 0 ? 'dzisiaj' : `${confirmDays} dni temu`}. Pełne odświeżenie to ~$4 kredytów DataForSEO. Odświeżyć mimo to?
                           </p>
                           <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                              <button type="button" onClick={() => setConfirmDays(null)} style={{ border: '1px solid #E4E4E7', borderRadius: 8, padding: '8px 16px', background: '#fff', color: '#18181B', fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer' }}>Anuluj</button>
                              <button type="button" onClick={() => runScan(true)} disabled={startScan.isLoading} style={{ border: 'none', borderRadius: 8, padding: '8px 16px', background: '#18181B', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer' }}>Odśwież (~$4)</button>
                           </div>
                        </div>
                     </Modal>
                  )}
               </div>
            );
         }}
      </AiVisPageShell>
   );
};

export default AiVisibilityOverview;
