import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React, { useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import AppShell from '../../../components/common/AppShell';
import DomainSubLayout from '../../../components/domains/DomainSubLayout';
import { useFetchDomains } from '../../../services/domains';
import { slugToDomain } from '../../../utils/slugToDomain';
import { Tabs, Toggle, SearchBar, SortableHeader, Checkbox, Skeleton, Button, CompactSelect, DataTable, DataTableScroll, DataTableContent, DataTableHeader, DataTableBody, DataTableRow, TableLoadMore, useTableLoadMore } from '../../../components/core';
import { useSortState } from '../../../lib/useSortState';
import { buildTopicClusters, TopicCluster } from '../../../lib/topicalMap';
import TopicalFilters, { DEFAULT_TOPICAL_FILTERS, TopicalFilterState, applyTopicalFilters } from '../../../components/domains/TopicalFilters';
import TopicalClusterPanel from '../../../components/domains/TopicalClusterPanel';
import TopicalMapCanvas from '../../../components/domains/TopicalMapCanvas';
import { useSetupStatus } from '../../../services/domainPipeline';

const FONT = 'var(--font-family-primary)';

/* ─── Icons ─── */
const InfoIcon = () => (
   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ color: '#9F9FA9', flexShrink: 0 }}>
      <path d="M12 16V12M12 8H12.01M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
   </svg>
);
const FeedbackIcon = () => (
   <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path fillRule="evenodd" d="M5.337 21.718a7 7 0 0 1-.533-.074a.75.75 0 0 1-.44-1.223a3.73 3.73 0 0 0 .814-1.686c.023-.115-.022-.317-.254-.543C3.274 16.587 2.25 14.41 2.25 12c0-5.03 4.428-9 9.75-9s9.75 3.97 9.75 9s-4.428 9-9.75 9c-.833 0-1.643-.097-2.417-.279a6.72 6.72 0 0 1-4.246.997" clipRule="evenodd" />
   </svg>
);
const ChevronDownIcon = () => (
   <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m19.5 8.25l-7.5 7.5l-7.5-7.5" />
   </svg>
);
const KebabIcon = () => (
   <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6.75 12a.75.75 0 1 1-1.5 0a.75.75 0 0 1 1.5 0m6 0a.75.75 0 1 1-1.5 0a.75.75 0 0 1 1.5 0m6 0a.75.75 0 1 1-1.5 0a.75.75 0 0 1 1.5 0" />
   </svg>
);
export const HexIcon = ({ size = 20, color = '#F29964' }: { size?: number; color?: string }) => (
   <svg viewBox="0 0 256 256" width={size} height={size} aria-hidden="true" style={{ color, flexShrink: 0 }}>
      <g fill="currentColor">
         <path d="M224 80.18v95.64a8 8 0 0 1-4.16 7l-88 48.18a8 8 0 0 1-7.68 0l-88-48.18a8 8 0 0 1-4.16-7V80.18a8 8 0 0 1 4.16-7l88-48.18a8 8 0 0 1 7.68 0l88 48.18a8 8 0 0 1 4.16 7" opacity="0.2" />
         <path d="m223.68 66.15l-88-48.15a15.88 15.88 0 0 0-15.36 0l-88 48.17a16 16 0 0 0-8.32 14v95.64a16 16 0 0 0 8.32 14l88 48.17a15.88 15.88 0 0 0 15.36 0l88-48.17a16 16 0 0 0 8.32-14V80.18a16 16 0 0 0-8.32-14.03M216 175.82L128 224l-88-48.18V80.18L128 32l88 48.17Z" />
      </g>
   </svg>
);

/* ─── Small building blocks ─── */
const STATUS_META: Record<TopicCluster['status'], { label: string; dot: string; color: string }> = {
   covered: { label: 'Covered', dot: '#1AB25E', color: '#15803D' },
   recommended: { label: 'Recommended', dot: '#FF6F77', color: '#B91C1C' },
   not_covered: { label: 'Not covered', dot: '#9F9FA9', color: '#52525C' },
};
export const StatusChip = ({ status }: { status: TopicCluster['status'] }) => {
   const m = STATUS_META[status];
   return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, color: m.color, fontFamily: FONT, whiteSpace: 'nowrap' }}>
         <span style={{ width: 8, height: 8, borderRadius: 9999, background: m.dot, flexShrink: 0 }} />
         {m.label}
      </span>
   );
};

const KebabMenu = ({ items }: { items: Array<{ label: string; onClick: () => void }> }) => (
   <CompactSelect
      size="sm"
      options={items.map((it) => ({ value: it.label, label: it.label }))}
      trigger={(props, isOpen) => (
         <Button {...props} type="button" variant="transparent" size="sm" aria-label="More actions" aria-expanded={isOpen} icon={<KebabIcon />} style={{ padding: 4 }} />
      )}
      onChange={(opt) => items.find((it) => it.label === opt.value)?.onClick()}
   />
);

const CellNum = ({ v, width }: { v: React.ReactNode; width: number }) => (
   <div style={{ width, flexShrink: 0, padding: '12px 16px', borderLeft: '1px solid #F4F4F5', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', alignSelf: 'stretch' }}>
      <span style={{ fontSize: 14, color: '#18181B', fontFamily: FONT }}>{v}</span>
   </div>
);

type SortKey = 'kd' | 'vol' | 'position' | 'opportunity';

const TopicalMapPage: NextPage = () => {
   const router = useRouter();
   const { domain: slug } = router.query as { domain: string };
   const domain = slug ? slugToDomain(slug) : '';

   const { data: domainsData } = useFetchDomains(router, true);
   const domains = domainsData?.domains || [];
   const activeDomain = domains.find((d: DomainType) => d.slug === slug);
   const activeDomainId: number | null = activeDomain?.ID ?? null;

   const { data: topicsData, isLoading: topicsLoading } = useQuery(
      ['domain-topics', activeDomainId],
      async () => {
         const r = await fetch(`/api/domains/${slug}/topics`);
         return r.json() as Promise<{ topics: Array<{ id: number; title: string; summary: string | null }> }>;
      },
      { enabled: !!activeDomainId, staleTime: 60_000 },
   );
   const { data: setupStatus } = useSetupStatus(slug);
   const isAnalyzing = setupStatus?.status === 'running' || setupStatus?.status === 'queued';

   const [view, setView] = useState<'topics' | 'map'>('topics');
   const [showTitles, setShowTitles] = useState(false);
   const [query, setQuery] = useState('');
   const [panelCluster, setPanelCluster] = useState<TopicCluster | null>(null);
   const [panelInitialTab, setPanelInitialTab] = useState<'overview' | 'keywords' | 'competitors'>('overview');
   const [selected, setSelected] = useState<Set<number>>(new Set());
   const [filters, setFilters] = useState<TopicalFilterState>(DEFAULT_TOPICAL_FILTERS);
   const { sortKey, sortDir, handleSort } = useSortState<SortKey>('vol');

   const domainName = activeDomain?.domain;
   const clusters = useMemo(() => buildTopicClusters(topicsData?.topics ?? [], domainName), [topicsData, domainName]);

   const openPanel = (c: TopicCluster, tab: 'overview' | 'keywords' | 'competitors' = 'overview') => {
      setPanelInitialTab(tab);
      setPanelCluster(c);
   };

   const shown = useMemo(() => {
      let list = applyTopicalFilters(clusters, filters);
      const q = query.trim().toLowerCase();
      if (q) list = list.filter((c) => c.mainKeyword.includes(q) || c.name.toLowerCase().includes(q));
      const dir = sortDir === 'asc' ? 1 : -1;
      const val = (c: TopicCluster): number => (sortKey === 'opportunity' ? c.opportunity.score : Number(c[sortKey] ?? -1));
      return [...list].sort((a, b) => (val(a) - val(b)) * dir);
   }, [clusters, query, sortKey, sortDir, filters]);

   const tableChunk = useTableLoadMore(shown, {
      pageSize: 20,
      resetKey: `tm-${sortKey}-${sortDir}-${query}-${shown.length}-${JSON.stringify(filters)}`,
   });

   const toggleSelect = (id: number) => setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
   });

   return (
      <AppShell domains={domains} showAddModal={() => {}} showSettings={() => {}}>
         <Head>
            <title>{`Topical Map — ${domain} — Ranksmile`}</title>
         </Head>

         <DomainSubLayout domain={domain} slug={slug || ''} section="Topical Map" contentMaxWidth="100%" fillHeight>
            {/* ─── Title row ─── */}
            <div className="tm-title-row">
               <div className="tm-title-main">
                  <span style={{ fontSize: 18, fontWeight: 600, color: '#09090B', fontFamily: FONT }}>
                     Topical Map <span style={{ color: '#9F9FA9', fontWeight: 400 }}>{clusters.length}</span>
                  </span>
                  <InfoIcon />
               </div>
               <div className="tm-title-actions">
                  <Button type="button" variant="transparent" size="sm" icon={<FeedbackIcon />}>Leave feedback</Button>
                  <Button type="button" variant="primary" size="sm" icon={<ChevronDownIcon />}>Export</Button>
               </div>
            </div>

            {topicsLoading || (isAnalyzing && !clusters.length) ? (
               <Skeleton />
            ) : clusters.length === 0 ? (
               <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', textAlign: 'center', gap: 20 }}>
                  <div style={{ width: 64, height: 64, borderRadius: 16, background: '#F4F4F5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#52525C' }}>
                     <HexIcon size={32} color="#52525C" />
                  </div>
                  <div>
                     <h2 style={{ fontSize: 20, fontWeight: 700, color: '#09090B', fontFamily: FONT, margin: '0 0 8px' }}>Topical Map</h2>
                     <p style={{ fontSize: 14, color: '#71717B', maxWidth: 420, margin: '0 auto', lineHeight: 1.6, fontFamily: FONT }}>
                        Discover topic clusters and content gaps for <strong>{domain}</strong>. Topics will appear here once the domain analysis completes.
                     </p>
                  </div>
               </div>
            ) : (
               <>
                  {/* ─── Toolbar ─── */}
                  <div className="tm-toolbar">
                     <Tabs
                        items={[
                           { value: 'topics', label: 'All topics' },
                           { value: 'map', label: (<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><HexIcon size={18} />Map</span>) },
                        ]}
                        value={view}
                        onChange={(v) => setView(v as 'topics' | 'map')}
                     />
                     <div className="tm-toolbar-controls">
                        <div className="tm-toolbar-toggles">
                           <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                              <Toggle checked={showTitles} onChange={() => setShowTitles((s) => !s)} />
                              <span style={{ fontSize: 14, fontWeight: 600, color: '#3F3F47', fontFamily: FONT }}>Show titles</span>
                           </label>
                           <TopicalFilters value={filters} onChange={setFilters} />
                        </div>
                        <SearchBar value={query} onChange={setQuery} placeholder="Search by main keyword" width={250} />
                     </div>
                  </div>

                  {view === 'map' ? (
                     <TopicalMapCanvas clusters={shown} showTitles={showTitles} onKeywordClick={(c) => openPanel(c, 'keywords')} />
                  ) : (
                  <div className="tm-split">
                     {/* Left: Topic cluster */}
                     <DataTable className="tm-cluster-table">
                        <DataTableScroll>
                           <DataTableContent aria-label="Topic clusters">
                              <DataTableHeader>
                                 <div style={{ flex: 1, padding: '12px 16px', fontSize: 13, color: '#52525C', fontFamily: FONT }}>Topic cluster</div>
                                 <div style={{ width: 50, flexShrink: 0, alignSelf: 'stretch', borderLeft: '1px solid #E4E4E7' }} />
                              </DataTableHeader>
                              <DataTableBody>
                                 {tableChunk.visibleItems.map((c) => (
                                    <DataTableRow
                                       key={c.id}
                                       selected={panelCluster?.id === c.id}
                                       style={{ minHeight: 72, alignItems: 'center' }}
                                    >
                                       <div style={{ flex: 1, minWidth: 0, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                          <span title={c.name} style={{ fontSize: 14, fontWeight: 600, color: '#18181B', fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                             {([['KD', String(c.kd)], ['Vol.', String(c.vol)], ['Cov.', c.covRatio]] as Array<[string, string]>).map(([k, v]) => (
                                                <span key={k} style={{ display: 'inline-flex', gap: 4, fontSize: 12, fontFamily: FONT }}>
                                                   <span style={{ fontWeight: 500, color: '#3F3F47' }}>{k}</span>
                                                   <span style={{ color: '#71717B' }}>{v}</span>
                                                </span>
                                             ))}
                                          </div>
                                       </div>
                                       <div style={{ width: 50, flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', borderLeft: '1px solid #F4F4F5', alignSelf: 'stretch' }}>
                                          <KebabMenu items={[
                                             { label: 'View details', onClick: () => openPanel(c) },
                                             { label: 'Copy main keyword', onClick: () => { navigator.clipboard?.writeText(c.mainKeyword); } },
                                          ]} />
                                       </div>
                                    </DataTableRow>
                                 ))}
                                 <TableLoadMore hasMore={tableChunk.hasMore} isLoading={tableChunk.isLoading} onLoadMore={tableChunk.loadMore} />
                              </DataTableBody>
                           </DataTableContent>
                        </DataTableScroll>
                     </DataTable>

                     {/* Right: Main keyword */}
                     <DataTable className="tm-keyword-table">
                        <DataTableScroll>
                           <DataTableContent minWidth={850} aria-label="Main keywords">
                              <DataTableHeader>
                                 <div style={{ width: 50, flexShrink: 0 }} />
                                 <div style={{ flex: 1, minWidth: 220, padding: '12px 16px', display: 'flex', alignItems: 'center', borderLeft: '1px solid #E4E4E7', fontSize: 13, color: '#52525C', fontFamily: FONT }}>Main keyword</div>
                                 <SortableHeader label="KD" sortKey="kd" activeKey={sortKey} dir={sortDir} width={100} onSort={(k) => handleSort(k as SortKey)} />
                                 <SortableHeader label="Vol." sortKey="vol" activeKey={sortKey} dir={sortDir} width={100} onSort={(k) => handleSort(k as SortKey)} />
                                 <SortableHeader label="Position" sortKey="position" activeKey={sortKey} dir={sortDir} width={100} onSort={(k) => handleSort(k as SortKey)} />
                                 <SortableHeader label="Opp." sortKey="opportunity" activeKey={sortKey} dir={sortDir} width={90} onSort={(k) => handleSort(k as SortKey)} />
                                 <div style={{ width: 50, flexShrink: 0, borderLeft: '1px solid #E4E4E7' }} />
                              </DataTableHeader>
                              <DataTableBody>
                                 {tableChunk.visibleItems.map((c) => (
                                    <DataTableRow
                                       key={c.id}
                                       className="tm-row"
                                       selected={selected.has(c.id)}
                                       style={{ minHeight: 72, alignItems: 'center' }}
                                    >
                                       <div style={{ width: 50, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                                          <Checkbox checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} />
                                       </div>
                                       <div
                                          role="button"
                                          tabIndex={0}
                                          onClick={() => openPanel(c)}
                                          onKeyDown={(e) => { if (e.key === 'Enter') openPanel(c); }}
                                          style={{ flex: 1, minWidth: 220, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, cursor: 'pointer', borderLeft: '1px solid #F4F4F5', alignSelf: 'stretch' }}
                                       >
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                                             <span style={{ fontSize: 14, fontWeight: 600, color: '#18181B', fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.mainKeyword}</span>
                                             <span style={{ fontSize: 13, color: '#71717B', fontFamily: FONT }}>incl. {c.keywords.length} keywords</span>
                                          </div>
                                          <StatusChip status={c.status} />
                                       </div>
                                       <CellNum v={c.kd} width={100} />
                                       <CellNum v={c.vol} width={100} />
                                       <CellNum v={c.position ?? ''} width={100} />
                                       <div style={{ width: 90, flexShrink: 0, padding: '12px 16px', borderLeft: '1px solid #F4F4F5', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', alignSelf: 'stretch' }}>
                                          <span style={{ fontSize: 12, fontWeight: 600, fontFamily: FONT, borderRadius: 9999, padding: '2px 8px', background: c.opportunity.score >= 60 ? 'rgba(242,153,100,0.08)' : '#F4F4F5', color: c.opportunity.score >= 60 ? '#F29964' : '#52525C' }}>{c.opportunity.score}</span>
                                       </div>
                                       <div style={{ width: 50, flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', borderLeft: '1px solid #F4F4F5', alignSelf: 'stretch' }}>
                                          <KebabMenu items={[{ label: 'View details', onClick: () => openPanel(c) }]} />
                                       </div>
                                    </DataTableRow>
                                 ))}
                                 <TableLoadMore hasMore={tableChunk.hasMore} isLoading={tableChunk.isLoading} onLoadMore={tableChunk.loadMore} />
                              </DataTableBody>
                           </DataTableContent>
                        </DataTableScroll>
                     </DataTable>
                  </div>
                  )}
                  <style>{'.tm-row:hover { background: #fafafa; }'}</style>
               </>
            )}
            <TopicalClusterPanel cluster={panelCluster} initialTab={panelInitialTab} onClose={() => setPanelCluster(null)} />
         </DomainSubLayout>
      </AppShell>
   );
};

export default TopicalMapPage;
