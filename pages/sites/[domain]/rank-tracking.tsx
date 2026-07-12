import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React, { useEffect, useRef, useState } from 'react';
import AppShell from '../../../components/common/AppShell';
import DomainSubLayout from '../../../components/domains/DomainSubLayout';
import { SentryPanel } from '../../../components/sentry-pages';
import AddKeywordsModal from '../../../components/rankTracking/AddKeywordsModal';
import KeywordTrendModal from '../../../components/rankTracking/KeywordTrendModal';
import {
  Button,
  CompactSelect,
  Pagination,
  SearchBar,
  Skeleton,
  SortableHeader,
  ToolRibbon,
  getPaginationCaption,
} from '../../../components/core';
import type { SelectOption } from '../../../components/core';
import { useSortState } from '../../../lib/useSortState';
import type { ComparePeriod, RankTrackingRow } from '../../../lib/types/rankTracking';
import { useFetchDomains } from '../../../services/domains';
import {
  useAddRankKeywords,
  usePrefetchRankNextPage,
  useProcessRankRun,
  useRankConfigs,
  useRankResults,
  useRankRunPolling,
  useTriggerRankCheck,
} from '../../../services/rankTracking';
import { slugToDomain } from '../../../utils/slugToDomain';

const FONT = 'var(--font-family-primary)';

const COMPARE_OPTIONS: SelectOption[] = [
  { value: '1d', label: 'vs 1 day ago' },
  { value: '7d', label: 'vs 7 days ago' },
  { value: '30d', label: 'vs 30 days ago' },
  { value: '90d', label: 'vs 90 days ago' },
];

type SortKey = 'keyword' | 'position' | 'volume' | 'kd' | 'cpc';

function compactNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function CellSpinner({ align = 'flex-end' }: { align?: 'flex-start' | 'center' | 'flex-end' }) {
  return (
    <span style={{ display: 'flex', justifyContent: align, alignItems: 'center', width: '100%' }}>
      <span
        aria-hidden="true"
        style={{
          width: 14,
          height: 14,
          border: '2px solid #E4E4E7',
          borderTopColor: '#783AFB',
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

function PositionCell({ row, pending }: { row: RankTrackingRow; pending: boolean }) {
  const d = row.desktop;
  if (pending) return <CellSpinner />;
  const delta = d.position != null && d.previousPosition != null
    ? d.previousPosition - d.position
    : null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, width: '100%' }}>
      {delta != null && delta !== 0 && (
        <span style={{ fontSize: 12, fontWeight: 600, color: delta > 0 ? '#1AB25E' : '#FF6F77' }}>
          {delta > 0 ? '↑' : '↓'}{Math.abs(delta)}
        </span>
      )}
      <span style={{ fontSize: 13, fontWeight: 500, color: '#3F3F47', fontFamily: FONT }}>
        {d.found && d.position != null ? d.position : '—'}
      </span>
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
  const [comparePeriod, setComparePeriod] = useState<ComparePeriod>('7d');
  const [search, setSearch] = useState('');
  const [addModal, setAddModal] = useState(false);
  const [trendRow, setTrendRow] = useState<RankTrackingRow | null>(null);
  const [trendPoints, setTrendPoints] = useState<Array<{ date: string; position: number | null; found: boolean }>>([]);
  const { sortKey, sortDir, handleSort } = useSortState<SortKey>('keyword', 'asc');

  const resultsQ = useRankResults(slug, configId, {
    comparePeriod,
    page,
    pageSize: 50,
    search,
    sort: sortKey,
    order: sortDir,
  });
  const runQ = useRankRunPolling(slug, configId);
  const addKeywordsM = useAddRankKeywords(slug, configId);
  const checkM = useTriggerRankCheck(slug);
  const runM = useProcessRankRun(slug);
  const prefetchNext = usePrefetchRankNextPage(slug, configId, resultsQ.data?.nextCursor ?? null, { comparePeriod, pageSize: 50 });

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
      },
    });
  }, [runActive, configId, runM, resultsQ, runQ]);

  const rows = resultsQ.data?.rows ?? [];
  const total = resultsQ.data?.total ?? 0;
  const pageSize = resultsQ.data?.pageSize ?? 50;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const loading = configsQ.isLoading || resultsQ.isLoading;

  const openTrend = async (row: RankTrackingRow) => {
    setTrendRow(row);
    setTrendPoints([]);
    if (!slug || !configId) return;
    try {
      const res = await fetch(`/api/rank-tracking/${slug}/history/summary?configId=${configId}`);
      const data = await res.json() as {
        summaries?: Array<{ trackingKeywordId: number; device: string; points: Array<{ date: string; position: number | null; found: boolean }> }>;
      };
      const match = data.summaries?.find(
        (s) => s.trackingKeywordId === row.trackingKeywordId && s.device === 'desktop',
      );
      setTrendPoints(match?.points ?? []);
    } catch {
      setTrendPoints([]);
    }
  };

  return (
    <AppShell domains={domains} showAddModal={() => {}} showSettings={() => {}}>
      <Head><title>{`Rank Tracking — ${domain} — SerpBear`}</title></Head>
      <style>{`
        @keyframes rt-spin { to { transform: rotate(360deg); } }
        .rt-row:hover { background: #F8F8F9 !important; }
        .rt-row:hover .rt-row-link { color: #783AFB !important; }
      `}</style>

      <DomainSubLayout
        domain={domain}
        slug={slug || ''}
        section="Rank Tracking"
        heading="Rank Tracking"
        contentMaxWidth="100%"
        filters={(
          <ToolRibbon>
            <CompactSelect
              prefix="Compare"
              size="sm"
              value={comparePeriod}
              options={COMPARE_OPTIONS}
              onChange={(opt) => setComparePeriod(String(opt.value) as ComparePeriod)}
              menuMinWidth={180}
            />
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
              <Button type="button" variant="primary" size="sm" onClick={() => setAddModal(true)}>
                Add keywords
              </Button>
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
                <div style={{ padding: '10px 16px', flexGrow: 1, minWidth: 220 }}>
                  <Button type="button" variant="transparent" size="sm" onClick={() => handleSort('keyword')} style={{ gap: 4, padding: 0, color: '#52525C' }}>
                    <span style={{ fontSize: 13, fontWeight: sortKey === 'keyword' ? 600 : 400 }}>Keyword</span>
                  </Button>
                </div>
                <SortableHeader label="Position" sortKey="position" activeKey={sortKey} dir={sortDir} width={120} onSort={(k) => handleSort(k as SortKey)} />
                <div style={{ padding: '10px 16px', borderLeft: '1px solid #F4F4F5', width: 200, flexShrink: 0, fontSize: 13, fontWeight: 400, color: '#52525C', fontFamily: FONT }}>
                  URL
                </div>
                <SortableHeader label="Volume" sortKey="volume" activeKey={sortKey} dir={sortDir} width={100} onSort={(k) => handleSort(k as SortKey)} />
                <SortableHeader label="KD" sortKey="kd" activeKey={sortKey} dir={sortDir} width={80} onSort={(k) => handleSort(k as SortKey)} />
                <SortableHeader label="CPC" sortKey="cpc" activeKey={sortKey} dir={sortDir} width={90} onSort={(k) => handleSort(k as SortKey)} />
                <div style={{ padding: '10px 16px', borderLeft: '1px solid #F4F4F5', width: 120, flexShrink: 0, fontSize: 13, color: '#52525C', fontFamily: FONT }}>
                  SERP
                </div>
              </div>

              {loading ? (
                <Skeleton />
              ) : rows.length === 0 ? (
                <div style={{ padding: '48px 16px', textAlign: 'center', fontSize: 14, color: '#9F9FA9', fontFamily: FONT }}>
                  No keywords tracked yet. Use <strong style={{ color: '#52525C' }}>Add keywords</strong> to start monitoring positions.
                </div>
              ) : rows.map((row, i) => {
                const d = row.desktop;
                const pending = rowRankPending(row, rankChecking);
                const urlLabel = d.rankingUrl ? d.rankingUrl.replace(/^https?:\/\//, '').replace(/\/$/, '') : '';
                return (
                  <div
                    key={row.trackingKeywordId}
                    className="rt-row"
                    role="button"
                    tabIndex={0}
                    onClick={() => openTrend(row)}
                    onKeyDown={(e) => { if (e.key === 'Enter') openTrend(row); }}
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
                    <div style={{ padding: '12px 16px', flexGrow: 1, minWidth: 220, display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#09090B', fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.keyword}
                      </span>
                    </div>
                    <div style={{ borderLeft: '1px solid #F4F4F5', width: 120, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '12px 16px' }}>
                      <PositionCell row={row} pending={pending} />
                    </div>
                    <div style={{ borderLeft: '1px solid #F4F4F5', width: 200, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '12px 16px', minWidth: 0 }}>
                      {pending ? (
                        <CellSpinner align="flex-start" />
                      ) : d.rankingUrl ? (
                        <a
                          href={d.rankingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rt-row-link"
                          onClick={(e) => e.stopPropagation()}
                          style={{ fontSize: 12, color: '#52525C', fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none' }}
                        >
                          {urlLabel}
                        </a>
                      ) : (
                        <span style={{ fontSize: 13, color: '#9F9FA9', fontFamily: FONT }}>—</span>
                      )}
                    </div>
                    <div style={{ borderLeft: '1px solid #F4F4F5', width: 100, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '12px 16px' }}>
                      {pending ? (
                        <CellSpinner />
                      ) : (
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#3F3F47', fontFamily: FONT }}>
                          {row.searchVolume != null ? compactNum(row.searchVolume) : '—'}
                        </span>
                      )}
                    </div>
                    <div style={{ borderLeft: '1px solid #F4F4F5', width: 80, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '12px 16px' }}>
                      {pending ? (
                        <CellSpinner />
                      ) : (
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#3F3F47', fontFamily: FONT }}>
                          {row.keywordDifficulty ?? '—'}
                        </span>
                      )}
                    </div>
                    <div style={{ borderLeft: '1px solid #F4F4F5', width: 90, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '12px 16px' }}>
                      {pending ? (
                        <CellSpinner />
                      ) : (
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#3F3F47', fontFamily: FONT }}>
                          {row.cpc != null ? row.cpc.toFixed(2) : '—'}
                        </span>
                      )}
                    </div>
                    <div style={{ borderLeft: '1px solid #F4F4F5', width: 120, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '12px 16px', minWidth: 0 }}>
                      {pending ? (
                        <CellSpinner align="flex-start" />
                      ) : (
                        <span style={{ fontSize: 12, color: '#52525C', fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {d.serpFeatures.length ? d.serpFeatures.join(', ') : '—'}
                        </span>
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

      <KeywordTrendModal
        open={!!trendRow}
        keyword={trendRow?.keyword ?? ''}
        points={trendPoints}
        onClose={() => setTrendRow(null)}
      />
    </AppShell>
  );
};

export default RankTrackingPage;
