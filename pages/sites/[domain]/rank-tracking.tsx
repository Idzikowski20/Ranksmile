import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from 'react-query';
import AppShell from '../../../components/common/AppShell';
import DomainSubLayout from '../../../components/domains/DomainSubLayout';
import { SentryPanel } from '../../../components/sentry-pages';
import AddKeywordsModal from '../../../components/rankTracking/AddKeywordsModal';
import RankKeywordDetailPanel from '../../../components/rankTracking/RankKeywordDetailPanel';
import MiniSparkline from '../../../components/rankTracking/MiniSparkline';
import {
  Button,
  DeltaDown,
  DeltaUp,
  Pagination,
  SearchBar,
  Skeleton,
  SortableHeader,
  ToolRibbon,
  getPaginationCaption,
} from '../../../components/core';
import { useSortState } from '../../../lib/useSortState';
import { computeHistory7dStats, sparklineFromHistoryPoints } from '../../../lib/rankTracking/sparkline';
import type { RankHistorySummaryPoint, RankTrackingRow } from '../../../lib/types/rankTracking';
import { useFetchDomains } from '../../../services/domains';
import {
  useAddRankKeywords,
  usePrefetchRankNextPage,
  useProcessRankRun,
  useRankConfigs,
  useRankHistorySummary,
  useRankResults,
  useRankRunPolling,
  useTriggerRankCheck,
} from '../../../services/rankTracking';
import { slugToDomain } from '../../../utils/slugToDomain';

const FONT = 'var(--font-family-primary)';

type SortKey = 'keyword' | 'position' | 'best' | 'impressions' | 'visits';

type ScMetrics = { impressions: number; visits: number };

function aggregateScByKeyword(items: SearchAnalyticsItem[]): Map<string, ScMetrics> {
  const map = new Map<string, ScMetrics>();
  for (const item of items) {
    const key = (item.keyword || '').trim().toLowerCase();
    if (!key) continue;
    const existing = map.get(key);
    if (existing) {
      existing.impressions += item.impressions || 0;
      existing.visits += item.clicks || 0;
    } else {
      map.set(key, { impressions: item.impressions || 0, visits: item.clicks || 0 });
    }
  }
  return map;
}

function CellSpinner({ align = 'center' }: { align?: 'flex-start' | 'center' | 'flex-end' }) {
  return (
    <span style={{ display: 'flex', justifyContent: align, alignItems: 'center', width: '100%' }}>
      <span
        aria-hidden="true"
        style={{
          width: 14,
          height: 14,
          border: '2px solid #E4E4E7',
          borderTopColor: '#F29964',
          borderRadius: '50%',
          animation: 'rt-spin 0.7s linear infinite',
          flexShrink: 0,
        }}
      />
    </span>
  );
}

function rowRankPending(row: RankTrackingRow, checking: boolean): boolean {
  return checking && !row.desktop.hasSnapshot;
}

const CELL_CENTER: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
};

const METRIC_TEXT: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: '#3F3F47',
  fontFamily: FONT,
  textAlign: 'center',
};

function MetricCell({ value, pending }: { value: React.ReactNode; pending?: boolean }) {
  if (pending) return <CellSpinner />;
  return (
    <div style={CELL_CENTER}>
      <span style={METRIC_TEXT}>{value}</span>
    </div>
  );
}

function PositionCell({ row, pending, position7dAgo }: { row: RankTrackingRow; pending: boolean; position7dAgo: number | null }) {
  const d = row.desktop;
  if (pending) return <CellSpinner />;
  const current = d.found && d.position != null ? d.position : null;
  if (current == null) {
    return (
      <div style={CELL_CENTER}>
        <span style={METRIC_TEXT}>—</span>
      </div>
    );
  }
  const baseline = position7dAgo ?? d.previousPosition;
  const delta = baseline != null ? baseline - current : null;
  return (
    <div style={{ ...CELL_CENTER, gap: 4 }}>
      {delta != null && delta !== 0 && (delta > 0 ? <DeltaUp /> : <DeltaDown />)}
      <span style={METRIC_TEXT}>{current}</span>
    </div>
  );
}

function HistorySparkline({ points, pending, loading }: { points: RankHistorySummaryPoint[]; pending: boolean; loading?: boolean }) {
  if (pending || loading) return <CellSpinner align="center" />;
  const { values, color } = sparklineFromHistoryPoints(points);
  if (!values.length) {
    return (
      <div style={CELL_CENTER}>
        <span style={{ ...METRIC_TEXT, color: '#9F9FA9' }}>—</span>
      </div>
    );
  }
  return (
    <div style={CELL_CENTER}>
      <div style={{ border: '1px solid #E4E4E7', borderRadius: 6, padding: '2px 4px', background: '#FAFAFA' }}>
        <MiniSparkline points={values} color={color} height={28} filled />
      </div>
    </div>
  );
}

const RankTrackingPage: NextPage = () => {
  const router = useRouter();
  const { domain: slug } = router.query as { domain: string };
  const domain = slug ? slugToDomain(slug) : '';
  const { data: domainsData } = useFetchDomains(router, true);
  const domains = domainsData?.domains || [];

  const configsQ = useRankConfigs(slug);
  const configId = configsQ.data?.configs?.[0]?.id;

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [addModal, setAddModal] = useState(false);
  const [detailRow, setDetailRow] = useState<RankTrackingRow | null>(null);
  const { sortKey, sortDir, handleSort } = useSortState<SortKey>('keyword', 'asc');

  const resultsQ = useRankResults(slug, configId, {
    comparePeriod: '7d',
    page,
    pageSize: 50,
    search,
    sort: sortKey === 'impressions' || sortKey === 'visits' || sortKey === 'best' ? 'keyword' : sortKey,
    order: sortDir,
  });
  const historySummaryQ = useRankHistorySummary(slug, configId);

  const scQ = useQuery(
    ['sckeywords', slug],
    async () => {
      const r = await fetch(`/api/searchconsole?domain=${slug}`);
      if (!r.ok) throw new Error('Failed to load Search Console data');
      return r.json() as Promise<{ data?: SCDomainDataType | null; error?: string | null }>;
    },
    { enabled: !!slug, staleTime: 120_000 },
  );

  const runQ = useRankRunPolling(slug, configId);
  const addKeywordsM = useAddRankKeywords(slug, configId);
  const checkM = useTriggerRankCheck(slug);
  const runM = useProcessRankRun(slug);
  const prefetchNext = usePrefetchRankNextPage(slug, configId, resultsQ.data?.nextCursor ?? null, { comparePeriod: '7d', pageSize: 50 });

  const lastKick = useRef(0);
  const runActive = runQ.data?.run?.status === 'pending' || runQ.data?.run?.status === 'running' || runQ.data?.run?.status === 'partial';
  const rankChecking = runActive || checkM.isLoading || addKeywordsM.isLoading;

  useEffect(() => {
    if (!runActive || !configId || runM.isLoading) return;
    const now = Date.now();
    if (now - lastKick.current < 2500) return;
    lastKick.current = now;
    runM.mutate(configId, {
      onSuccess: () => {
        resultsQ.refetch();
        runQ.refetch();
        historySummaryQ.refetch();
      },
    });
  }, [runActive, configId, runM, resultsQ, runQ, historySummaryQ]);

  const scByKeyword = useMemo(() => {
    const data = scQ.data?.data;
    const items = (data?.sevenDays?.length ? data.sevenDays : data?.thirtyDays) ?? [];
    return aggregateScByKeyword(items);
  }, [scQ.data]);

  const historyByKeywordId = useMemo(() => {
    const map = new Map<number, RankHistorySummaryPoint[]>();
    for (const s of historySummaryQ.data?.summaries ?? []) {
      if (s.device && s.device !== 'desktop') continue;
      map.set(s.trackingKeywordId, s.points);
    }
    return map;
  }, [historySummaryQ.data]);

  const rows = useMemo(() => {
    const base = resultsQ.data?.rows ?? [];
    if (sortKey !== 'impressions' && sortKey !== 'visits' && sortKey !== 'best') return base;
    const sorted = [...base];
    sorted.sort((a, b) => {
      if (sortKey === 'impressions' || sortKey === 'visits') {
        const aKey = a.keyword.trim().toLowerCase();
        const bKey = b.keyword.trim().toLowerCase();
        const aVal = scByKeyword.get(aKey)?.[sortKey === 'impressions' ? 'impressions' : 'visits'] ?? 0;
        const bVal = scByKeyword.get(bKey)?.[sortKey === 'impressions' ? 'impressions' : 'visits'] ?? 0;
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const aPts = historyByKeywordId.get(a.trackingKeywordId) ?? [];
      const bPts = historyByKeywordId.get(b.trackingKeywordId) ?? [];
      const aBest = computeHistory7dStats(aPts, a.desktop.position, a.desktop.found).best ?? 999;
      const bBest = computeHistory7dStats(bPts, b.desktop.position, b.desktop.found).best ?? 999;
      return sortDir === 'asc' ? aBest - bBest : bBest - aBest;
    });
    return sorted;
  }, [resultsQ.data?.rows, sortKey, sortDir, scByKeyword, historyByKeywordId]);

  const total = resultsQ.data?.total ?? 0;
  const pageSize = resultsQ.data?.pageSize ?? 50;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const loading = configsQ.isLoading || resultsQ.isLoading;
  const scLoading = scQ.isLoading;
  const scConnected = scQ.isSuccess && !!scQ.data?.data && !scQ.data?.error;

  return (
    <AppShell domains={domains} showAddModal={() => {}} showSettings={() => {}}>
      <Head><title>{`Rank Tracking — ${domain} — SerpBear`}</title></Head>
      <style>{`
        @keyframes rt-spin { to { transform: rotate(360deg); } }
        .rt-row:hover { background: #F8F8F9 !important; }
        .rt-row:hover .rt-kw-link { color: #F29964 !important; }
      `}</style>

      <DomainSubLayout
        domain={domain}
        slug={slug || ''}
        section="Rank Tracking"
        heading="Rank Tracking"
        contentMaxWidth="100%"
        actions={(
          <Button type="button" variant="primary" size="sm" onClick={() => setAddModal(true)}>
            Add keywords
          </Button>
        )}
        filters={(
          <ToolRibbon>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto', flexWrap: 'wrap' }}>
              {configId && total > 0 && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={checkM.isLoading || runActive}
                  busy={runActive}
                  onClick={() => checkM.mutate(configId)}
                >
                  {runActive ? 'Checking…' : 'Check ranks'}
                </Button>
              )}
              <SearchBar
                value={search}
                onChange={(v) => { setSearch(v); setPage(1); }}
                placeholder="Search"
                width={250}
              />
            </div>
          </ToolRibbon>
        )}
      >
        <SentryPanel noPadding>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: '100%', display: 'table', width: '100%' }}>
              <div style={{
                display: 'flex', alignItems: 'center', background: '#fff',
                borderBottom: '1px solid #F4F4F5', borderRadius: '8px 8px 0 0',
                position: 'sticky', top: 0, zIndex: 1,
              }}
              >
                <div style={{ padding: '10px 16px', flexGrow: 1, minWidth: 200 }}>
                  <Button type="button" variant="transparent" size="sm" onClick={() => handleSort('keyword')} style={{ gap: 4, padding: 0, color: '#52525C' }}>
                    <span style={{ fontSize: 13, fontWeight: sortKey === 'keyword' ? 600 : 400 }}>Keyword</span>
                  </Button>
                </div>
                <SortableHeader label="Position" sortKey="position" activeKey={sortKey} dir={sortDir} width={100} align="center" onSort={(k) => handleSort(k as SortKey)} />
                <SortableHeader label="Best" sortKey="best" activeKey={sortKey} dir={sortDir} width={80} align="center" onSort={(k) => handleSort(k as SortKey)} />
                <div style={{ padding: '10px 16px', borderLeft: '1px solid #F4F4F5', width: 110, flexShrink: 0, fontSize: 13, fontWeight: 400, color: '#52525C', fontFamily: FONT, textAlign: 'center' }}>
                  History
                </div>
                <SortableHeader label="Impr" sortKey="impressions" activeKey={sortKey} dir={sortDir} width={80} align="center" onSort={(k) => handleSort(k as SortKey)} />
                <SortableHeader label="Vis" sortKey="visits" activeKey={sortKey} dir={sortDir} width={80} align="center" onSort={(k) => handleSort(k as SortKey)} />
              </div>

              {loading ? (
                <Skeleton />
              ) : rows.length === 0 ? (
                <div style={{ padding: '48px 16px', textAlign: 'center', fontSize: 14, color: '#9F9FA9', fontFamily: FONT }}>
                  No keywords tracked yet. Use <strong style={{ color: '#52525C' }}>Add keywords</strong> to start monitoring positions.
                </div>
              ) : rows.map((row, i) => {
                const pending = rowRankPending(row, rankChecking);
                const sc = scByKeyword.get(row.keyword.trim().toLowerCase());
                const historyPoints = historyByKeywordId.get(row.trackingKeywordId) ?? [];
                const stats = computeHistory7dStats(historyPoints, row.desktop.position, row.desktop.found);
                const position7dAgo = stats.position7dAgo ?? row.desktop.previousPosition;
                return (
                  <div
                    key={row.trackingKeywordId}
                    className="rt-row"
                    role="button"
                    tabIndex={0}
                    onClick={() => setDetailRow(row)}
                    onKeyDown={(e) => { if (e.key === 'Enter') setDetailRow(row); }}
                    style={{
                      display: 'flex',
                      alignItems: 'stretch',
                      borderBottom: i < rows.length - 1 ? '1px solid #F4F4F5' : 'none',
                      minHeight: 56,
                      background: '#fff',
                      transition: 'background 120ms ease',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ padding: '12px 16px', flexGrow: 1, minWidth: 200, display: 'flex', alignItems: 'center' }}>
                      <span className="rt-kw-link" style={{ fontSize: 13, fontWeight: 600, color: '#09090B', fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: 'color 150ms ease' }}>
                        {row.keyword}
                      </span>
                    </div>
                    <div style={{ borderLeft: '1px solid #F4F4F5', width: 100, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 16px' }}>
                      <PositionCell row={row} pending={pending} position7dAgo={position7dAgo} />
                    </div>
                    <div style={{ borderLeft: '1px solid #F4F4F5', width: 80, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 16px' }}>
                      <MetricCell value={stats.best ?? '—'} pending={pending} />
                    </div>
                    <div style={{ borderLeft: '1px solid #F4F4F5', width: 110, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 16px' }}>
                      <HistorySparkline points={historyPoints} pending={pending} loading={historySummaryQ.isLoading} />
                    </div>
                    <div style={{ borderLeft: '1px solid #F4F4F5', width: 80, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 16px' }}>
                      {scLoading ? (
                        <CellSpinner />
                      ) : (
                        <MetricCell value={sc ? sc.impressions : (scConnected ? 0 : '—')} />
                      )}
                    </div>
                    <div style={{ borderLeft: '1px solid #F4F4F5', width: 80, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 16px' }}>
                      {scLoading ? (
                        <CellSpinner />
                      ) : (
                        <MetricCell value={sc ? sc.visits : (scConnected ? 0 : '—')} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </SentryPanel>

        {totalPages > 1 && (
          <div style={{ marginTop: 16 }}>
            <Pagination
              page={page}
              pageCount={totalPages}
              onPageChange={(p) => {
                if (p > page) prefetchNext();
                setPage(p);
              }}
              disabled={resultsQ.isFetching}
              caption={getPaginationCaption({ page, pageSize, total })}
            />
          </div>
        )}
      </DomainSubLayout>

      <AddKeywordsModal
        open={addModal}
        onClose={() => setAddModal(false)}
        loading={addKeywordsM.isLoading}
        onAdd={(keywords) => addKeywordsM.mutate(keywords)}
      />

      <RankKeywordDetailPanel
        row={detailRow}
        slug={slug || ''}
        configId={configId}
        onClose={() => setDetailRow(null)}
      />
    </AppShell>
  );
};

export default RankTrackingPage;
