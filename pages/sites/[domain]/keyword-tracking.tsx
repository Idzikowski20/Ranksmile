import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React, { useEffect, useMemo, useState } from 'react';
import AppShell from '../../../components/common/AppShell';
import DomainSubLayout from '../../../components/domains/DomainSubLayout';
import { PageHeader } from '../../../components/koala/layout';
import {
  AveragePositionCard,
  RankingBucketsCard,
  TrackingMovementCards,
  VisibilityChartCard,
} from '../../../components/rankTracking/TrackingOverview';
import TrackedKeywordsTable from '../../../components/rankTracking/TrackedKeywordsTable';
import { Skeleton } from '../../../components/koala/core';
import { StatusBadge, type StatusTone } from '../../../components/koala/primitives/StatusBadge';
import { useFetchDomains } from '../../../services/domains';
import {
  useAddRankKeywords,
  useProcessRankRun,
  useRankAnalytics,
  useRankAnalyticsChart,
  useRankConfigs,
  useRankKeywordsList,
  useRankKeywordHistory,
  useRankResults,
  useRankRunPolling,
  useRemoveRankKeywords,
} from '../../../services/rankTracking';
import type { RankKeywordStatus } from '../../../lib/types/rankTracking';
import { slugToDomain } from '../../../utils/slugToDomain';

const FONT = 'var(--font-family-primary)';

const KeywordTrackingPage: NextPage = () => {
  const router = useRouter();
  const slug = typeof router.query.domain === 'string' ? router.query.domain : '';
  const domain = slug ? slugToDomain(slug) : '';
  const { data: domainsData } = useFetchDomains(router);
  const domains = domainsData?.domains || [];

  const configsQ = useRankConfigs(slug || undefined);
  const config = configsQ.data?.configs?.[0];
  const configId = config?.id;

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const analyticsQ = useRankAnalytics(slug || undefined, configId);
  const chartQ = useRankAnalyticsChart(slug || undefined, configId);
  const resultsQ = useRankResults(slug || undefined, configId, {
    search: debouncedSearch || undefined,
    pageSize: 50,
    sort: 'position',
    order: 'asc',
  });
  const keywordsQ = useRankKeywordsList(slug || undefined, configId);
  const runQ = useRankRunPolling(slug || undefined, configId);
  const processRun = useProcessRankRun(slug || undefined);
  const addMut = useAddRankKeywords(slug || undefined, configId);
  const removeMut = useRemoveRankKeywords(slug || undefined, configId);

  // Keep processing while run is active
  useEffect(() => {
    const s = runQ.data?.run?.status;
    if (!configId || !slug) return;
    if (s !== 'pending' && s !== 'running' && s !== 'partial') return;
    const id = setInterval(() => {
      processRun.mutate(configId);
    }, 4000);
    return () => clearInterval(id);
  }, [runQ.data?.run?.status, configId, slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const historyQ = useRankKeywordHistory(slug || undefined, configId, expandedId ?? undefined);

  const statusById = useMemo(() => {
    const m = new Map<number, RankKeywordStatus>();
    for (const k of keywordsQ.data?.keywords ?? []) {
      m.set(k.id, k.status || 'queued');
    }
    return m;
  }, [keywordsQ.data?.keywords]);

  const trendById = useMemo(() => {
    const m = new Map<number, Array<{ date: string; position: number | null }>>();
    if (!expandedId || !historyQ.data?.snapshots) return m;
    const points = [...historyQ.data.snapshots]
      .reverse()
      .map((s) => ({
        date: s.checked_at ? `${new Date(s.checked_at).getMonth() + 1}/${new Date(s.checked_at).getDate()}` : '',
        position: s.position,
      }));
    m.set(expandedId, points);
    return m;
  }, [expandedId, historyQ.data?.snapshots]);

  const costLimit = keywordsQ.data?.limit ?? 1000;
  const total = resultsQ.data?.total ?? keywordsQ.data?.keywords?.length ?? 0;
  const exportHref = slug && configId
    ? `/api/rank-tracking/${slug}/export?configId=${configId}&format=csv`
    : null;

  const run = runQ.data?.run;
  const runStatus = run?.status;
  const runCompletedNote = runStatus === 'completed' && run?.finished_at
    ? `Last update finished ${new Date(run.finished_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${run.keywords_success ?? 0} ok / ${run.keywords_failed ?? 0} failed`
    : null;
  const runActiveBadge = runStatus === 'running' || runStatus === 'pending' || runStatus === 'partial'
    ? {
        status: (runStatus === 'partial' ? 'processing' : runStatus === 'pending' ? 'pending' : 'running') as StatusTone,
        label: `Run in progress… ${run?.keywords_checked ?? 0}/${run?.keywords_total ?? 0}`,
      }
    : null;

  return (
    <AppShell domains={domains} showAddModal={() => {}} showSettings={() => {}}>
      <Head>
        <title>{domain ? `${domain} · Keyword tracking` : 'Keyword tracking'} | Ranksmile</title>
      </Head>
      <DomainSubLayout
        domain={domain}
        slug={slug || ''}
        section="Keyword tracking"
        contentMaxWidth="100%"
      >
        <PageHeader
          title="Keyword tracking"
          subtitle={domain}
        />
        <div style={{ fontFamily: FONT }}>
          {runCompletedNote ? (
            <div style={{ fontSize: 13, color: 'var(--koala-text-secondary)', marginBottom: 8 }}>{runCompletedNote}</div>
          ) : null}
          {runActiveBadge ? (
            <div style={{ marginBottom: 8 }}>
              <StatusBadge status={runActiveBadge.status} label={runActiveBadge.label} />
            </div>
          ) : null}

          {analyticsQ.isLoading && !analyticsQ.data ? (
            <Skeleton rows={2} columns={3} />
          ) : (
            <TrackingMovementCards
              summary={analyticsQ.data?.summary}
              chart={chartQ.data?.chart ?? []}
            />
          )}

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
            <AveragePositionCard
              summary={analyticsQ.data?.summary}
              chart={chartQ.data?.chart ?? []}
            />
            <VisibilityChartCard
              summary={analyticsQ.data?.summary}
              chart={chartQ.data?.chart ?? []}
            />
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
            <RankingBucketsCard summary={analyticsQ.data?.summary} />
          </div>

          <TrackedKeywordsTable
            rows={resultsQ.data?.rows ?? []}
            total={total}
            limit={costLimit}
            config={config}
            statusById={statusById}
            lastCheckedAt={config?.last_checked_at ?? run?.finished_at ?? null}
            loading={resultsQ.isLoading}
            onAdd={(keywords) => addMut.mutate(keywords)}
            adding={addMut.isLoading}
            onArchive={(ids) => {
              removeMut.mutate(ids);
            }}
            archiving={removeMut.isLoading}
            search={search}
            onSearchChange={setSearch}
            exportHref={exportHref}
            trendById={trendById}
            expandedId={expandedId}
            onToggleTrend={(id) => setExpandedId((cur) => (cur === id ? null : id))}
          />
        </div>
      </DomainSubLayout>
    </AppShell>
  );
};

export default KeywordTrackingPage;
