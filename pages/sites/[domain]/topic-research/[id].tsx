import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React, { useMemo, useState } from 'react';
import AppShell from '../../../../components/common/AppShell';
import DomainSubLayout from '../../../../components/domains/DomainSubLayout';
import TopicalMapCanvas from '../../../../components/domains/TopicalMapCanvas';
import TopicResearchIdeaDrawer, { DrawerIdea } from '../../../../components/topicResearch/TopicResearchIdeaDrawer';
import { SearchBar, Toggle, Button, SegmentedControl, Checkbox } from '../../../../components/core';
import { useTopicResearchRun } from '../../../../services/topicResearch';
import { useFetchDomains } from '../../../../services/domains';
import { slugToDomain } from '../../../../utils/slugToDomain';
import { langForCountry } from '../../../../lib/countryLang';
import type { TopicCluster, TopicIdea, TopicResearchResult } from '../../../../lib/topicResearchTypes';
import { type TopicCluster as MapCluster, type TopicKeyword as MapKeyword } from '../../../../lib/topicalMap';
import { honeycombOffsets } from '../../../../lib/topicalMapGeometry';

const FONT = 'var(--font-family-primary)';

type Tab = 'all' | 'recommendations' | 'map';

const fmtVol = (v: number | null | undefined): string => {
   if (v == null) return '—';
   if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}m`;
   if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
   return v.toLocaleString();
};

const BORDER = '#E9E9EB';
const MUTED = '#71717B';
const TEXT = '#18181B';
const TEXT2 = '#3F3F46';

const CheckIcon = ({ color }: { color: string }) => (
   <svg viewBox="0 0 24 24" width={18} height={18} style={{ flexShrink: 0 }}><path fill={color} fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12m13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094z" clipRule="evenodd" /></svg>
);
const FireIcon = () => (
   <svg viewBox="0 0 20 20" width={18} height={18} style={{ flexShrink: 0, color: '#FF6F77' }}><path fill="currentColor" fillRule="evenodd" d="M13.5 4.938a7 7 0 1 1-9.006 1.737c.202-.257.59-.218.793.039q.418.53.943.954c.332.269.786-.049.773-.476L7 7c0-.919.206-1.789.575-2.567a6.03 6.03 0 0 1 2.486-2.665c.247-.14.55-.016.677.238A6.97 6.97 0 0 0 13.5 4.938M14 12a4 4 0 0 1-4 4c-1.913 0-3.52-1.398-3.91-3.182c-.093-.429.44-.643.814-.413a4 4 0 0 0 1.601.564c.303.038.531-.24.51-.544a5.98 5.98 0 0 1 1.315-4.192a.45.45 0 0 1 .431-.16A4 4 0 0 1 14 12" clipRule="evenodd" /></svg>
);
const CubeIcon = () => (
   <svg viewBox="0 0 256 256" width={18} height={18} style={{ flexShrink: 0, color: '#F29964' }}><g fill="currentColor"><path d="M224 80.18v95.64a8 8 0 0 1-4.16 7l-88 48.18a8 8 0 0 1-7.68 0l-88-48.18a8 8 0 0 1-4.16-7V80.18a8 8 0 0 1 4.16-7l88-48.18a8 8 0 0 1 7.68 0l88 48.18a8 8 0 0 1 4.16 7" opacity=".2" /><path d="m223.68 66.15l-88-48.15a15.88 15.88 0 0 0-15.36 0l-88 48.17a16 16 0 0 0-8.32 14v95.64a16 16 0 0 0 8.32 14l88 48.17a15.88 15.88 0 0 0 15.36 0l88-48.17a16 16 0 0 0 8.32-14V80.18a16 16 0 0 0-8.32-14.03M216 175.82L128 224l-88-48.18V80.18L128 32l88 48.17Z" /></g></svg>
);
const KebabIcon = () => (
   <svg viewBox="0 0 24 24" width={16} height={16}><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6.75 12a.75.75 0 1 1-1.5 0a.75.75 0 0 1 1.5 0m6 0a.75.75 0 1 1-1.5 0a.75.75 0 0 1 1.5 0m6 0a.75.75 0 1 1-1.5 0a.75.75 0 0 1 1.5 0" /></svg>
);
const InfoIcon = () => (
   <svg viewBox="0 0 20 20" width={15} height={15} style={{ color: TEXT2, flexShrink: 0 }}><path fill="currentColor" fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0a8 8 0 0 1 16 0m-7-4a1 1 0 1 1-2 0a1 1 0 0 1 2 0M9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9z" clipRule="evenodd" /></svg>
);
const SortArrow = ({ active }: { active?: boolean }) => (
   <svg viewBox="0 0 20 20" width={15} height={15} style={{ color: active ? '#18181B' : '#71717B', flexShrink: 0 }}><path fill="currentColor" fillRule="evenodd" d="M10 3a.75.75 0 0 1 .75.75v10.638l3.96-4.158a.75.75 0 1 1 1.08 1.04l-5.25 5.5a.75.75 0 0 1-1.08 0l-5.25-5.5a.75.75 0 1 1 1.08-1.04l3.96 4.158V3.75A.75.75 0 0 1 10 3" clipRule="evenodd" /></svg>
);

const StatCard = ({ label, value, info }: { label: string; value: React.ReactNode; info?: boolean }) => (
   <div style={{ flex: '1 1 0', minWidth: 120, border: '1px solid #DAD9DE', boxShadow: '0 4px 0 0 #e4e4e7', borderRadius: 12, background: '#fff', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 4, fontFamily: FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
         <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', color: MUTED }}>{label}</span>
         {info && <InfoIcon />}
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: TEXT }}>{value}</div>
   </div>
);

const ClusterStat = ({ label, value }: { label: string; value: React.ReactNode }) => (
   <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 500, color: '#52525C' }}>{label}</span>
      <span style={{ fontSize: 11, color: MUTED }}>{value}</span>
   </span>
);

const HeadCell = ({ width, grow, align, sortable, active, children }: { width: number; grow?: boolean; align?: 'right'; sortable?: boolean; active?: boolean; children: React.ReactNode }) => (
   <div style={{ width, flexGrow: grow ? 1 : 0, flexShrink: 0, borderLeft: `1px solid ${BORDER}`, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: align === 'right' ? 'flex-end' : 'flex-start', gap: 4 }}>
      <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: TEXT2, textDecorationLine: sortable ? 'underline' : 'none', textDecorationStyle: 'dotted', textDecorationColor: '#B4B4BB', textUnderlineOffset: 4 }}>{children}</span>
      {sortable && <SortArrow active={active} />}
   </div>
);

const BodyCell = ({ width, color, children }: { width: number; color?: string; children: React.ReactNode }) => (
   <div style={{ width, flexShrink: 0, borderLeft: `1px solid ${BORDER}`, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
      <span style={{ fontSize: 14, color: color || TEXT }}>{children}</span>
   </div>
);

type FlatIdea = { idea: TopicIdea; cluster: TopicCluster; clusterIdx: number; ideaIdx: number };

/** Adapt Topic Research clusters into the radar-canvas shape used by the Topical Map page.
 *  One node per cluster; each idea becomes a satellite keyword. `id` = cluster index so a
 *  node click can open that cluster's ideas in the drawer. Fields the canvas never reads are
 *  filled with inert defaults.
 *
 *  Ranksmile-style radial layout: clusters are ranked by search volume; only the top one sits
 *  in the central HIGH zone, the rest fan outward into MEDIUM/LOW rings, spread by the golden
 *  angle so blobs don't collide. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const toMapClusters = (result: TopicResearchResult): MapCluster[] => {
   const n = result.clusters.length;
   const rankOf = new Map<number, number>();
   result.clusters
      .map((c, idx) => ({ idx, vol: c.volume }))
      .sort((a, b) => b.vol - a.vol)
      .forEach((r, rank) => rankOf.set(r.idx, rank));

   return result.clusters.map((c, idx) => {
      const rank = rankOf.get(idx) ?? 0;
      // Rank 0 → center (HIGH); others pushed out to 0.42–0.92 of the radar radius.
      const mag = rank === 0 ? 0.05 : 0.42 + 0.5 * ((rank - 1) / Math.max(1, n - 2));
      const angle = rank * GOLDEN_ANGLE;
      const status: MapCluster['status'] = c.covered > 0 ? 'covered' : (c.ideas.some((i) => i.recommended) ? 'recommended' : 'not_covered');
      const keywords: MapKeyword[] = [
         { text: c.title, isMain: true, covered: c.covered > 0, position: null, kd: c.kd, impressions: null, vol: c.volume },
         ...c.ideas.map((i) => ({ text: i.main, isMain: false, covered: i.position != null, position: i.position, kd: i.kd ?? 0, impressions: null, vol: i.volume ?? 0 })),
      ];
      return {
         id: idx,
         name: c.title,
         mainKeyword: c.ideas[0]?.main ?? c.title,
         keywords,
         groups: [],
         competitors: [],
         kd: c.kd,
         vol: c.volume,
         position: null,
         impressions: 0,
         covRatio: `${c.covered}/${c.total}`,
         status,
         articleStatus: 'Not started',
         dims: [],
         aiGap: [],
         opportunity: { score: 0, tier: 'Low', estGainClicks: 0, difficulty: 'Medium', priority: 'Low' },
         aiAuthority: { score: 0, subs: [] },
         map: { x: Math.cos(angle) * mag, y: Math.sin(angle) * mag, size: 1 },
      };
   });
};

const TopicResearchDetailPage: NextPage = () => {
   const router = useRouter();
   const { domain: slug, id } = router.query as { domain: string; id: string };
   const domain = slug ? slugToDomain(slug) : '';
   const runId = id ? Number(id) : undefined;

   const { data: domainsData } = useFetchDomains(router, true);
   const domains = domainsData?.domains || [];
   const activeDomain = domains.find((d: DomainType) => d.slug === slug);
   const domainId = activeDomain?.ID ?? null;

   const runQ = useTopicResearchRun(slug, runId);
   const run = runQ.data?.run;
   const result = runQ.data?.result;

   const [tab, setTab] = useState<Tab>('all');
   const [showTitles, setShowTitles] = useState(true);
   const [query, setQuery] = useState('');
   const [selectedClusterIdx, setSelectedClusterIdx] = useState<number | null>(null);
   const [drawerItems, setDrawerItems] = useState<DrawerIdea[]>([]);
   const [drawerIndex, setDrawerIndex] = useState<number | null>(null);
   const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
   const toggleRow = (key: string) => setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
   });

   const failed = runQ.isError || run?.status === 'failed';
   const busy = !failed && (runQ.isLoading || !run || run.status === 'queued' || run.status === 'running');

   const flatIdeas: FlatIdea[] = useMemo(() => {
      if (!result) return [];
      const out: FlatIdea[] = [];
      result.clusters.forEach((cluster, clusterIdx) => {
         cluster.ideas.forEach((idea, ideaIdx) => { out.push({ idea, cluster, clusterIdx, ideaIdx }); });
      });
      return out;
   }, [result]);

   const filteredIdeas = useMemo(() => {
      let list = flatIdeas;
      if (tab === 'recommendations') list = list.filter((x) => x.idea.recommended);
      if (selectedClusterIdx != null) list = list.filter((x) => x.clusterIdx === selectedClusterIdx);
      const q = query.trim().toLowerCase();
      if (q) {
         list = list.filter((x) => {
            if (x.idea.main.toLowerCase().includes(q)) return true;
            if (showTitles && x.cluster.title.toLowerCase().includes(q)) return true;
            return x.idea.keywords.some((k) => k.keyword.toLowerCase().includes(q));
         });
      }
      return list.sort((a, b) => (b.idea.volume ?? 0) - (a.idea.volume ?? 0));
   }, [flatIdeas, tab, selectedClusterIdx, query, showTitles]);

   const mapClusters = useMemo(() => (result ? toMapClusters(result) : []), [result]);
   const satOffsets = useMemo(() => {
      const maxIdeas = mapClusters.reduce((m, c) => Math.max(m, c.keywords.length - 1), 0);
      return honeycombOffsets(maxIdeas);
   }, [mapClusters]);

   const goCreate = (keyword: string) => {
      if (!domainId || !run?.country) return;
      const q = new URLSearchParams();
      q.set('domainId', String(domainId));
      q.set('keywords', keyword);
      q.set('country', run.country);
      q.set('language', langForCountry(run.country));
      q.set('flow', 'new');
      router.push(`/articles/deep-analysis?${q.toString()}`);
   };

   const openDrawerFrom = (list: FlatIdea[], pos: number) => {
      setDrawerItems(list.map((x) => ({ idea: x.idea, clusterTitle: showTitles ? x.cluster.title : `Cluster ${x.clusterIdx + 1}` })));
      setDrawerIndex(pos);
   };
   const openClusterDrawer = (clusterIdx: number) => {
      const list = flatIdeas.filter((x) => x.clusterIdx === clusterIdx);
      if (list.length) openDrawerFrom(list, 0);
   };
   const closeDrawer = () => setDrawerIndex(null);

   return (
      <AppShell domains={domains} showAddModal={() => {}} showSettings={() => {}}>
         <Head><title>{`${run?.seed || 'Topic Research'} — ${domain}`}</title></Head>
         <style>{'@keyframes spin{to{transform:rotate(360deg)}}@keyframes auditPulse{0%,100%{opacity:.5}50%{opacity:1}}'}</style>
         <DomainSubLayout domain={domain} slug={slug || ''} section="Topic Research" contentMaxWidth="100%">
            <div style={{ width: '100%', fontFamily: FONT, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)', minHeight: 520, overflow: 'hidden' }}>
               {/* Header: title + Google country badge + Export */}
               <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'transparent', paddingBottom: 16, minHeight: 36 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                     <button type="button" onClick={() => router.push(`/sites/${slug}/topic-research`)} aria-label="Back" style={{ border: 'none', background: 'transparent', color: MUTED, fontSize: 20, lineHeight: 1, cursor: 'pointer', padding: 0, flexShrink: 0 }}>‹</button>
                     <span style={{ fontSize: 18, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{run?.seed || '…'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                     <span style={{ position: 'relative', display: 'inline-flex' }} title={run?.country ? `Results for ${run.country}` : undefined}>
                        <svg width={18} height={18} viewBox="0 0 16 16" fill="none"><path d="M15.6823 8.18368C15.6823 7.63986 15.6382 7.0931 15.5442 6.55811H7.99829V9.63876H12.3194C12.1401 10.6323 11.564 11.5113 10.7203 12.0698V14.0687H13.2983C14.8122 12.6753 15.6823 10.6176 15.6823 8.18368Z" fill="#4285F4" /><path d="M7.99812 16C10.1558 16 11.9753 15.2915 13.3011 14.0687L10.7231 12.0698C10.0058 12.5578 9.07988 12.8341 8.00106 12.8341C5.91398 12.8341 4.14436 11.426 3.50942 9.53296H0.849121V11.5936C2.2072 14.295 4.97332 16 7.99812 16Z" fill="#34A853" /><path d="M3.50665 9.53295C3.17154 8.53938 3.17154 7.4635 3.50665 6.46993V4.4093H0.849292C-0.285376 6.66982 -0.285376 9.33306 0.849292 11.5936L3.50665 9.53295Z" fill="#FBBC04" /><path d="M7.99812 3.16589C9.13867 3.14825 10.241 3.57743 11.067 4.36523L13.3511 2.0812C11.9048 0.723121 9.98526 -0.0235266 7.99812 -1.02057e-05C4.97332 -1.02057e-05 2.2072 1.70493 0.849121 4.40932L3.50648 6.46995C4.13848 4.57394 5.91104 3.16589 7.99812 3.16589Z" fill="#EA4335" /></svg>
                        <span style={{ position: 'absolute', top: -3, right: -3, width: 7, height: 7, borderRadius: 9999, background: '#1AB25E' }} />
                     </span>
                     <Button type="button" variant="primary" size="sm" icon={<svg viewBox="0 0 24 24" width={16} height={16}><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>}>Export</Button>
                  </div>
               </div>

               {failed && (
                  <div style={{ border: '1px solid #FECACA', background: '#FEF2F2', borderRadius: 8, padding: 20, color: '#B91C1C', fontSize: 14 }}>
                     {run?.status === 'failed' ? `Research failed${run?.error ? `: ${run.error}` : '.'}` : 'Could not load this research.'}
                  </div>
               )}

               {!failed && busy && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0 }}>
                     <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: '#18181B', fontSize: 14, fontWeight: 600 }}>
                        <svg viewBox="0 0 24 24" width={16} height={16} style={{ animation: 'spin 0.7s linear infinite' }}><path fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" d="M12 3a9 9 0 1 0 9 9" /></svg>
                        Researching topics…
                     </div>
                     <div style={{ display: 'flex', gap: 12 }}>
                        {[0, 1, 2, 3, 4, 5].map((i) => (
                           <div key={i} style={{ flex: '1 1 0', border: '1px solid #DAD9DE', boxShadow: '0 4px 0 0 #e4e4e7', borderRadius: 12, background: '#fff', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <span style={{ display: 'block', width: '70%', height: 10, borderRadius: 4, background: '#E4E4E7', animation: `auditPulse 1.4s ease-in-out ${i * 0.1}s infinite` }} />
                              <span style={{ display: 'block', width: '40%', height: 16, borderRadius: 4, background: '#E4E4E7', animation: `auditPulse 1.4s ease-in-out ${i * 0.1}s infinite` }} />
                           </div>
                        ))}
                     </div>
                     <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
                        <div style={{ width: 330, flexShrink: 0, border: '1px solid #DAD9DE', boxShadow: '0 4px 0 0 #e4e4e7', borderRadius: 12, background: '#fff', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                           {[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ display: 'block', height: 44, borderRadius: 8, background: '#F1F1F3', animation: `auditPulse 1.4s ease-in-out ${i * 0.1}s infinite` }} />)}
                        </div>
                        <div style={{ flex: 1, border: '1px solid #DAD9DE', boxShadow: '0 4px 0 0 #e4e4e7', borderRadius: 12, background: '#fff', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                           {[0, 1, 2, 3, 4, 5, 6].map((i) => <span key={i} style={{ display: 'block', height: 44, borderRadius: 8, background: '#F1F1F3', animation: `auditPulse 1.4s ease-in-out ${i * 0.08}s infinite` }} />)}
                        </div>
                     </div>
                  </div>
               )}

               {!failed && !busy && result && (() => {
                  const TABS: { id: Tab; label: string; icon?: 'fire' | 'cube'; count: number | null }[] = [
                     { id: 'all', label: 'All topics', count: result.stats.clusterCount },
                     { id: 'recommendations', label: 'Recommendations', icon: 'fire', count: result.stats.recommendationCount },
                     { id: 'map', label: 'Map', icon: 'cube', count: null },
                  ];
                  return (
                  <>
                     {/* Stats — 6 cards */}
                     <div style={{ flexShrink: 0, display: 'flex', gap: 12, padding: '4px 0 8px' }}>
                        <StatCard label="Topical Authority" value={result.stats.topicalAuthority} info />
                        <StatCard label="Covered Ideas" value={<span>{result.stats.coveredIdeas} <span style={{ color: MUTED, fontWeight: 400 }}>of {result.stats.totalIdeas}</span></span>} />
                        <StatCard label="KW in top 3" value={result.stats.kwTop3} />
                        <StatCard label="KW in top 10" value={result.stats.kwTop10} />
                        <StatCard label="KW in top 50" value={result.stats.kwTop50} />
                        <StatCard label="Search volume" value={fmtVol(result.stats.searchVolume).toUpperCase()} />
                     </div>
                     {(typeof result.stats.siteFocusScore === 'number' || typeof result.stats.siteRadius === 'number') && (
                        <div style={{ flexShrink: 0, fontSize: 12, color: MUTED, paddingBottom: 12, fontFamily: FONT }}>
                           Topical cohesion
                           {typeof result.stats.siteFocusScore === 'number' && (
                              <> · site focus {Math.round(result.stats.siteFocusScore * 100)}%</>
                           )}
                           {typeof result.stats.siteRadius === 'number' && (
                              <> · site radius {Math.round(result.stats.siteRadius * 100)}% (spread)</>
                           )}
                           {' '}— higher focus / lower radius = tighter topical map
                        </div>
                     )}

                     {/* Controls: tabs + toggle + filters + search */}
                     <div style={{ flexShrink: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingBottom: 12 }}>
                        <SegmentedControl
                           size="sm"
                           value={tab}
                           onChange={(v) => setTab(v as Tab)}
                           options={TABS.map((t) => ({
                              value: t.id,
                              icon: t.icon === 'fire' ? <FireIcon /> : t.icon === 'cube' ? <CubeIcon /> : <CheckIcon color="currentColor" />,
                              label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{t.label}{t.count != null && <span style={{ fontWeight: 400, opacity: 0.6 }}>{t.count}</span>}</span>,
                           }))}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                           <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                              <Toggle checked={showTitles} onChange={setShowTitles} aria-label="Show cluster titles" />
                              <span style={{ fontSize: 14, fontWeight: 600, color: TEXT2 }}>Show titles</span>
                           </label>
                           <button type="button" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', color: TEXT2, fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer' }}>
                              <svg viewBox="0 0 20 20" width={18} height={18}><path fill="currentColor" d="M17 2.75a.75.75 0 0 0-1.5 0v5.5a.75.75 0 0 0 1.5 0zm0 13a.75.75 0 0 0-1.5 0v1.5a.75.75 0 0 0 1.5 0zM3.75 15a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75M4.5 2.75a.75.75 0 0 0-1.5 0v5.5a.75.75 0 0 0 1.5 0zM10 11a.75.75 0 0 1 .75.75v5.5a.75.75 0 0 1-1.5 0v-5.5A.75.75 0 0 1 10 11m.75-8.25a.75.75 0 0 0-1.5 0v1.5a.75.75 0 0 0 1.5 0zM10 6a2 2 0 1 0 0 4a2 2 0 0 0 0-4m-6.25 4a2 2 0 1 0 0 4a2 2 0 0 0 0-4m12.5 0a2 2 0 1 0 0 4a2 2 0 0 0 0-4" /></svg>
                              Filters
                           </button>
                           <div style={{ width: 250 }}>
                              <SearchBar value={query} onChange={setQuery} placeholder="Search by main keyword" />
                           </div>
                        </div>
                     </div>

                     {tab === 'map' ? (
                        <div style={{ flex: 1, minHeight: 0 }}>
                           <TopicalMapCanvas
                              clusters={mapClusters}
                              showTitles={false}
                              satelliteOffsets={satOffsets}
                              onNodeClick={(c) => openClusterDrawer(c.id)}
                              onKeywordClick={(c) => openClusterDrawer(c.id)}
                           />
                        </div>
                     ) : (
                        <div style={{ display: 'flex', flexDirection: 'row', gap: 12, flex: 1, minHeight: 0 }}>
                           {/* Left: clusters */}
                           <div className="styled-scrollbar" style={{ background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'auto', flexShrink: 0, border: '1px solid #DAD9DE', boxShadow: '0 4px 0 0 #e4e4e7', borderRadius: 12 }}>
                              <div style={{ position: 'sticky', top: 0, zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', borderBottom: `1px solid ${BORDER}`, fontSize: 13, color: TEXT2 }}>
                                 <div style={{ width: 280, padding: '12px 16px' }}>Topic cluster</div>
                                 <div style={{ width: 50, padding: '12px 16px', borderLeft: `1px solid ${BORDER}` }} />
                              </div>
                              {result.clusters.map((c, idx) => {
                                 const selected = selectedClusterIdx === idx;
                                 return (
                                    <div key={c.index} onClick={() => setSelectedClusterIdx(selected ? null : idx)}
                                       style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'space-between', minHeight: 72, cursor: 'pointer', borderBottom: `1px solid ${BORDER}`, background: selected ? '#EFEFF1' : 'transparent', transition: 'background 150ms ease' }}
                                       onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = '#FAFAFA'; }}
                                       onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = 'transparent'; }}>
                                       <div style={{ width: 280, padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center', minWidth: 0 }}>
                                          <span style={{ fontSize: 14, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{showTitles ? c.title : `Cluster ${idx + 1}`}</span>
                                          <div style={{ display: 'flex', gap: 12 }}>
                                             <ClusterStat label="KD" value={c.kd} />
                                             <ClusterStat label="Vol." value={fmtVol(c.volume)} />
                                             <ClusterStat label="Cov." value={`${c.covered}/${c.total}`} />
                                          </div>
                                       </div>
                                       <div style={{ width: 50, borderLeft: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED }}>
                                          <button type="button" onClick={(e) => e.stopPropagation()} aria-label="Cluster actions" style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', display: 'inline-flex', padding: 4 }}><KebabIcon /></button>
                                       </div>
                                    </div>
                                 );
                              })}
                           </div>

                           {/* Right: ideas */}
                           <div className="styled-scrollbar" style={{ background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'auto', flexGrow: 1, minWidth: 0, border: '1px solid #DAD9DE', boxShadow: '0 4px 0 0 #e4e4e7', borderRadius: 12 }}>
                              <div style={{ position: 'sticky', top: 0, zIndex: 1, display: 'flex', alignItems: 'stretch', background: '#fff', borderBottom: `1px solid ${BORDER}`, minWidth: 860 }}>
                                 <div style={{ width: 50, flexShrink: 0 }} />
                                 <HeadCell width={450} grow>Main keyword</HeadCell>
                                 <HeadCell width={100} align="right" sortable>KD</HeadCell>
                                 <HeadCell width={100} align="right" sortable active>Vol.</HeadCell>
                                 <HeadCell width={100} align="right" sortable>Position</HeadCell>
                                 <div style={{ width: 50, flexShrink: 0, borderLeft: `1px solid ${BORDER}` }} />
                              </div>
                              {filteredIdeas.length === 0 && (
                                 <div style={{ padding: 32, textAlign: 'center', fontSize: 14, color: '#9F9FA9' }}>No ideas match your filters.</div>
                              )}
                              {filteredIdeas.map((row, rowPos) => (
                                 <div key={`${row.clusterIdx}-${row.idea.main}`} onClick={() => openDrawerFrom(filteredIdeas, rowPos)}
                                    style={{ display: 'flex', alignItems: 'stretch', minHeight: 72, minWidth: 860, cursor: 'pointer', borderBottom: `1px solid ${BORDER}`, transition: 'background 150ms ease' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = '#FAFAFA'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                                    <div onClick={(e) => e.stopPropagation()} style={{ width: 50, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                       <Checkbox size="sm" checked={selectedRows.has(`${row.clusterIdx}-${row.idea.main}`)} onChange={() => toggleRow(`${row.clusterIdx}-${row.idea.main}`)} />
                                    </div>
                                    <div style={{ width: 450, flexGrow: 1, borderLeft: `1px solid ${BORDER}`, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minWidth: 0 }}>
                                       <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                          <span style={{ fontSize: 14, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.idea.main}</span>
                                          <span style={{ fontSize: 13, color: TEXT2 }}>incl. {row.idea.keywords.length} keyword{row.idea.keywords.length === 1 ? '' : 's'}</span>
                                       </div>
                                       <span onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0 }}>
                                          <Button type="button" variant="secondary" size="sm" onClick={() => goCreate(row.idea.main)}>Create</Button>
                                       </span>
                                    </div>
                                    <BodyCell width={100}>{row.idea.kd ?? '—'}</BodyCell>
                                    <BodyCell width={100}>{fmtVol(row.idea.volume)}</BodyCell>
                                    <BodyCell width={100} color={row.idea.position != null && row.idea.position <= 10 ? '#1AB25E' : TEXT}>{row.idea.position ?? ''}</BodyCell>
                                    <div style={{ width: 50, flexShrink: 0, borderLeft: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED }}>
                                       <button type="button" onClick={(e) => e.stopPropagation()} aria-label="Idea actions" style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', display: 'inline-flex', padding: 4 }}><KebabIcon /></button>
                                    </div>
                                 </div>
                              ))}
                           </div>
                        </div>
                     )}
                  </>
                  );
               })()}
            </div>
         </DomainSubLayout>

         <TopicResearchIdeaDrawer
            items={drawerItems}
            index={drawerIndex}
            onNavigate={(next) => setDrawerIndex(next)}
            onClose={closeDrawer}
            onCreate={goCreate}
         />
      </AppShell>
   );
};

export default TopicResearchDetailPage;
