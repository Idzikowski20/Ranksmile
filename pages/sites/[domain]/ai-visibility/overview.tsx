import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import AiVisPageShell from '../../../../components/aiVisibility/AiVisPageShell';
import { SkeletonBars, SkeletonRows, SkeletonBox } from '../../../../components/aiVisibility/SkeletonBlocks';
import CompetitorBarChart from '../../../../components/aiVisibility/CompetitorBarChart';
import CompetitorPicker from '../../../../components/aiVisibility/CompetitorPicker';
import TrendLineChart from '../../../../components/aiVisibility/TrendLineChart';
import { useAiVisOverview, useAiVisHistory, useStartAiVisScan } from '../../../../services/aiVisibility';
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

const StatCard = ({ label, value, vs, pending }: { label: string; value: React.ReactNode; vs?: React.ReactNode; pending: boolean }) => (
   <section style={card}>
      <div style={cardHeader}>
         <span style={{ ...cardTitle, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {label}: {pending ? <SkeletonBox w={24} h={16} /> : <span style={{ color: '#18181B', fontWeight: 700 }}>{value}</span>}
         </span>
      </div>
      <div style={{ padding: 24 }}>
         {pending ? <SkeletonBox w="100%" h={160} radius={10} /> : (
            <div style={{ height: 160, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: FONT }}>
               <span style={{ fontSize: 40, fontWeight: 700, color: '#18181B' }}>{value}</span>
               {vs != null ? <span style={{ fontSize: 14, color: '#71717B' }}>vs {vs}</span> : null}
            </div>
         )}
      </div>
   </section>
);

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
   useEffect(() => { if (!compareDomain && competitors.length) setCompareDomain(competitors[0].domain); }, [competitors, compareDomain]);

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
      <AiVisPageShell section="AI Visibility" title="Overview">
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

            let chartBody: React.ReactNode;
            if (pending) chartBody = <SkeletonBars />;
            else if (chartMode === 'bar') chartBody = <CompetitorBarChart competitors={competitors.map((c) => ({ domain: c.domain, overview: c.snapshot.overview }))} selected={compareDomain} onSelect={setCompareDomain} />;
            else chartBody = <TrendLineChart scans={historyQ.data?.scans || []} competitorDomain={compareDomain} />;

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
                           <div style={{ display: 'inline-flex', border: '1px solid #E4E4E7', borderRadius: 8, overflow: 'hidden' }}>
                              {(['bar', 'line'] as const).map((m) => (
                                 <button key={m} type="button" onClick={() => setChartMode(m)} title={m === 'bar' ? 'Competitor ranking' : 'Trend over time'} style={{ display: 'inline-flex', alignItems: 'center', border: 'none', padding: '6px 10px', background: chartMode === m ? '#F4F4F5' : '#fff', color: chartMode === m ? '#783AFB' : '#52525C', cursor: 'pointer' }}>{m === 'bar' ? <BarIcon /> : <LineIcon />}</button>
                              ))}
                           </div>
                           {competitorsAll.length ? <CompetitorPicker competitors={competitorsAll} selected={compareDomain} onSelect={setCompareDomain} /> : null}
                        </div>
                     )}
                  >
                     {chartBody}
                  </Panel>

                  {/* Topics & Prompts + Sources */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
                     <Panel
                        title="Topics & Prompts"
                        action={(
                           <div style={{ display: 'inline-flex', border: '1px solid #E4E4E7', borderRadius: 8, overflow: 'hidden' }}>
                              {(['topics', 'prompts'] as const).map((m) => (
                                 <button key={m} type="button" onClick={() => setPromptMode(m)} style={{ border: 'none', padding: '6px 10px', background: promptMode === m ? '#F4F4F5' : '#fff', color: '#18181B', cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 600 }}>{m === 'topics' ? '#' : '>_'}</button>
                              ))}
                           </div>
                        )}
                     >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                           <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#71717B', fontFamily: FONT }}>
                              <span>{promptMode === 'topics' ? 'Topics' : 'Prompts'}</span><span>Visibility score{comp ? ' (you vs)' : ''}</span>
                           </div>
                           {pending ? <SkeletonRows count={5} /> : rows.length === 0 ? (
                              <span style={{ fontSize: 14, color: '#9F9FA9', fontFamily: FONT }}>No data yet.</span>
                           ) : rows.map((r) => (
                              <div key={r.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                 <span title={r.label} style={{ fontSize: 14, color: '#18181B', fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
                                 <span style={{ fontSize: 14, fontWeight: 600, color: '#18181B', fontFamily: FONT, whiteSpace: 'nowrap' }}>
                                    {r.score}{r.vs != null ? <span style={{ color: '#71717B', fontWeight: 400 }}> vs {r.vs}</span> : null}
                                 </span>
                              </div>
                           ))}
                        </div>
                     </Panel>

                     <Panel title={<span>Sources{sourceCount ? `: ${sourceCount}` : ''}</span>}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                           <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#71717B', fontFamily: FONT }}>
                              <span>Link</span><span>Times shown</span>
                           </div>
                           {pending ? <SkeletonRows count={5} withIcon /> : sources.length === 0 ? (
                              <span style={{ fontSize: 14, color: '#9F9FA9', fontFamily: FONT }}>No sources yet.</span>
                           ) : sources.map((s) => (
                              <div key={s.url} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                 <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                    { /* eslint-disable-next-line @next/next/no-img-element */ }
                                    <img alt="" src={faviconFor(s.domain)} width={20} height={20} style={{ borderRadius: 4, flexShrink: 0 }} />
                                    <a href={s.url} target="_blank" rel="noopener noreferrer" title={s.url} style={{ fontSize: 14, color: '#18181B', fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none' }}>{s.domain}</a>
                                 </span>
                                 <span style={{ fontSize: 14, fontWeight: 600, color: '#18181B', fontFamily: FONT }}>{s.timesShown}</span>
                              </div>
                           ))}
                        </div>
                     </Panel>
                  </div>

                  {/* Stat cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
                     <StatCard label="Mention rate" value={own ? `${own.mentionRate}%` : '—'} vs={comp ? `${comp.mentionRate}%` : undefined} pending={!!pending} />
                     <StatCard label="Average position" value={own ? (own.avgPosition ?? '—') : '—'} vs={comp ? (comp.avgPosition ?? '—') : undefined} pending={!!pending} />
                     <StatCard label="Direct citations" value={own ? own.directCitations : '—'} vs={comp ? comp.directCitations : undefined} pending={!!pending} />
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
