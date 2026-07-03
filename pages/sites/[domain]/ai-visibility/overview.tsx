import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import React, { useState } from 'react';
import Link from 'next/link';
import AiVisPageShell from '../../../../components/aiVisibility/AiVisPageShell';
import { SkeletonBars, SkeletonRows, SkeletonBox } from '../../../../components/aiVisibility/SkeletonBlocks';
import { useAiVisData } from '../../../../services/aiVisibility';
import { AI_VIS_MODEL_LABEL, AI_VIS_ALL_MODELS } from '../../../../lib/aiVisibility';

const FONT = 'var(--font-family-primary)';

type OverviewData = {
   pending?: boolean;
   overview?: { visibilityScore: number; mentionRate: number; avgPosition: number | null; directCitations: number; pages: number; perModel: Array<{ model: string; score: number }> };
   sourceCount?: number;
};
type PromptsData = { pending?: boolean; prompts?: Array<{ id: number; topic: string; text: string; score: number }> };
type SourcesData = { pending?: boolean; sources?: Array<{ url: string; domain: string; timesShown: number }> };

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

/** Per-model visibility bar chart (heights scaled to score 0–100). */
const VisibilityBars = ({ perModel }: { perModel: Array<{ model: string; score: number }> }) => {
   const byModel = Object.fromEntries(perModel.map((m) => [m.model, m.score]));
   const models = AI_VIS_ALL_MODELS.filter((m) => m in byModel);
   const shown = models.length ? models : AI_VIS_ALL_MODELS;
   return (
      <div style={{ display: 'flex', height: 300, width: '100%' }}>
         {shown.map((model) => {
            const score = byModel[model] ?? 0;
            return (
               <div key={model} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#18181B', fontFamily: FONT }}>{score}</span>
                  <div style={{ width: 64, height: `${Math.max(2, score)}%`, borderRadius: '8px 8px 0 0', background: '#783AFB' }} />
                  <div style={{ height: 1, width: '100%', background: '#F4F4F5' }} />
                  <span style={{ fontSize: 12, color: '#52525C', fontFamily: FONT, textAlign: 'center', margin: '8px 0' }}>{AI_VIS_MODEL_LABEL[model] || model}</span>
               </div>
            );
         })}
      </div>
   );
};

const StatCard = ({ label, value, pending }: { label: string; value: React.ReactNode; pending: boolean }) => (
   <section style={card}>
      <div style={cardHeader}>
         <span style={{ ...cardTitle, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {label}: {pending ? <SkeletonBox w={24} h={16} /> : <span style={{ color: '#18181B', fontWeight: 700 }}>{value}</span>}
         </span>
      </div>
      <div style={{ padding: 24 }}>
         {pending ? <SkeletonBox w="100%" h={160} radius={10} /> : (
            <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 700, color: '#18181B', fontFamily: FONT }}>{value}</div>
         )}
      </div>
   </section>
);

const AiVisibilityOverview: NextPage = () => {
   const router = useRouter();
   const { domain: slug } = router.query as { domain: string };
   const [promptMode, setPromptMode] = useState<'topics' | 'prompts'>('topics');

   const overviewQ = useAiVisData<OverviewData>(slug, 'overview');
   const promptsQ = useAiVisData<PromptsData>(slug, 'prompts');
   const sourcesQ = useAiVisData<SourcesData>(slug, 'sources');

   return (
      <AiVisPageShell section="AI Visibility" title="Overview">
         {({ crunching }) => {
            const ov = overviewQ.data;
            const pending = crunching || overviewQ.isLoading || ov?.pending || !ov?.overview;
            const o = ov?.overview;

            // Topics view aggregates prompt scores by topic (mean).
            const prompts = promptsQ.data?.prompts || [];
            const topicRows = Object.values(prompts.reduce((acc, p) => {
               const t = acc[p.topic] || { label: p.topic, sum: 0, n: 0 };
               t.sum += p.score; t.n += 1; acc[p.topic] = t; return acc;
            }, {} as Record<string, { label: string; sum: number; n: number }>))
               .map((t) => ({ label: t.label, score: Math.round(t.sum / t.n) }))
               .sort((a, b) => b.score - a.score).slice(0, 5);
            const promptRows = [...prompts].sort((a, b) => b.score - a.score).slice(0, 5).map((p) => ({ label: p.text, score: p.score }));
            const rows = promptMode === 'topics' ? topicRows : promptRows;
            const sources = (sourcesQ.data?.sources || []).slice(0, 5);
            const sourcesPending = crunching || sourcesQ.isLoading || sourcesQ.data?.pending;
            const promptsPending = crunching || promptsQ.isLoading || promptsQ.data?.pending;

            return (
               <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {/* Visibility score */}
                  <Panel
                     title={<span>Visibility score: <span style={{ fontWeight: 400, color: '#18181B' }}>{pending || !o ? '—' : o.visibilityScore}</span></span>}
                     action={<Link href={`/sites/${slug}/ai-visibility/competitors`} passHref><a style={viewAll}>View Competitors</a></Link>}
                  >
                     {pending || !o ? <SkeletonBars /> : <VisibilityBars perModel={o.perModel} />}
                  </Panel>

                  {/* Topics & Prompts + Sources */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
                     <Panel
                        title="Topics & Prompts"
                        action={(
                           <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ display: 'inline-flex', border: '1px solid #E4E4E7', borderRadius: 8, overflow: 'hidden' }}>
                                 {(['topics', 'prompts'] as const).map((m) => (
                                    <button key={m} type="button" onClick={() => setPromptMode(m)} style={{ border: 'none', padding: '6px 10px', background: promptMode === m ? '#F4F4F5' : '#fff', color: '#18181B', cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 600 }}>{m === 'topics' ? '#' : '>_'}</button>
                                 ))}
                              </div>
                              <Link href={`/sites/${slug}/ai-visibility/prompts`} passHref><a style={viewAll}>View all</a></Link>
                           </div>
                        )}
                     >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                           <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#71717B', fontFamily: FONT }}>
                              <span>{promptMode === 'topics' ? 'Topics' : 'Prompts'}</span><span>Visibility score</span>
                           </div>
                           {promptsPending ? <SkeletonRows count={5} /> : rows.length === 0 ? (
                              <span style={{ fontSize: 14, color: '#9F9FA9', fontFamily: FONT }}>No data yet.</span>
                           ) : rows.map((r) => (
                              <div key={r.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                 <span title={r.label} style={{ fontSize: 14, color: '#18181B', fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
                                 <span style={{ fontSize: 14, fontWeight: 600, color: '#18181B', fontFamily: FONT }}>{r.score}</span>
                              </div>
                           ))}
                        </div>
                     </Panel>

                     <Panel
                        title={<span>Sources{ov?.sourceCount ? `: ${ov.sourceCount}` : ''}</span>}
                        action={<Link href={`/sites/${slug}/ai-visibility/sources`} passHref><a style={viewAll}>View all</a></Link>}
                     >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                           <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#71717B', fontFamily: FONT }}>
                              <span>Link</span><span>Times shown</span>
                           </div>
                           {sourcesPending ? <SkeletonRows count={5} withIcon /> : sources.length === 0 ? (
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
                     <StatCard label="Mention rate" value={o ? `${o.mentionRate}%` : '—'} pending={!!pending} />
                     <StatCard label="Average position" value={o ? (o.avgPosition ?? '—') : '—'} pending={!!pending} />
                     <StatCard label="Direct citations" value={o ? o.directCitations : '—'} pending={!!pending} />
                  </div>
               </div>
            );
         }}
      </AiVisPageShell>
   );
};

export default AiVisibilityOverview;
