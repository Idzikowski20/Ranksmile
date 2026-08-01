import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useMemo, useState } from 'react';
import AppShell from '../../../components/common/AppShell';
import DomainSubLayout from '../../../components/domains/DomainSubLayout';
import OrganicFilterBar from '../../../components/searchIntelligence/organic/OrganicFilterBar';
import OrganicKpiRow from '../../../components/searchIntelligence/organic/OrganicKpiRow';
import OrganicKeywordsTable from '../../../components/searchIntelligence/organic/OrganicKeywordsTable';
import { OrganicPageHeaderInfo, OrganicPageTitle } from '../../../components/searchIntelligence/organic/OrganicPageHeader';
import OrganicPositionChart from '../../../components/searchIntelligence/organic/OrganicPositionChart';
import {
  Button,
  Pagination,
  Skeleton,
  getPaginationCaption,
} from '../../../components/core';
import type { OrganicFilters } from '../../../lib/organicResearch/filter';
import { filterKeywords, paginateKeywords, sortKeywords, type OrganicSortKey } from '../../../lib/organicResearch/filter';
import { useFetchDomains } from '../../../services/domains';
import { organicExportUrl, useOrganicDataset } from '../../../services/organicResearch';
import { slugToDomain } from '../../../utils/slugToDomain';

const FONT = 'var(--font-family-primary)';

const KeywordListPage: NextPage = () => {
  const router = useRouter();
  const slug = typeof router.query.domain === 'string' ? router.query.domain : '';
  const domain = slug ? slugToDomain(slug) : '';
  const { data: domainsData } = useFetchDomains(router);
  const domains = domainsData?.domains || [];

  const organicQ = useOrganicDataset(slug || undefined);
  const dataset = organicQ.data?.dataset ?? null;
  const needsDfs = organicQ.data?.needsDfs === true
    || (organicQ.data?.configured === false && !dataset);
  const gscConnected = organicQ.data?.gscConnected === true
    || dataset?.meta?.gscConnected === true;

  const [filters, setFilters] = useState<OrganicFilters>({ tab: 'all', state: 'all', intents: [], serpFeatures: [] });
  const [sortKey, setSortKey] = useState<OrganicSortKey>('traffic');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [summaryMetric, setSummaryMetric] = useState<'keywords' | 'traffic' | 'trafficCost' | null>('keywords');
  const [chartRange, setChartRange] = useState<'1m' | '6m' | '1y' | '2y' | 'all'>('1m');
  const [seriesVisible, setSeriesVisible] = useState<Record<string, boolean>>({
    top3: true, pos4_10: true, pos11_20: true, pos21_50: true, pos51_100: true, serpFeatures: false,
  });
  const pageSize = 50;

  const topicMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of dataset?.topics ?? []) m.set(t.id, t.label);
    return m;
  }, [dataset?.topics]);

  const serpFeatureOptions = useMemo(() => {
    const set = new Set<string>();
    for (const k of dataset?.keywords ?? []) {
      for (const f of k.serpFeatures) set.add(f);
    }
    return [...set].sort();
  }, [dataset?.keywords]);

  const filteredSorted = useMemo(() => {
    if (!dataset) return [];
    return sortKeywords(filterKeywords(dataset.keywords, filters), sortKey, sortDir);
  }, [dataset, filters, sortKey, sortDir]);

  const table = useMemo(
    () => paginateKeywords(filteredSorted, page, pageSize),
    [filteredSorted, page],
  );

  const totalPages = Math.max(1, Math.ceil(table.total / pageSize));

  const monthlyChart = useMemo(() => {
    const chart = dataset?.chart ?? [];
    return chart.filter(
      (_, i, arr) => i === arr.length - 1 || arr[i].date.slice(0, 7) !== arr[i + 1]?.date.slice(0, 7),
    );
  }, [dataset?.chart]);
  const keywordSeries = monthlyChart.map(
    (c) => c.keywordCount ?? (c.top3 + c.pos4_10 + c.pos11_20 + c.pos21_50 + c.pos51_100),
  );
  const trafficSeries = monthlyChart.map((c) => c.traffic ?? 0);
  const trendOpen = summaryMetric === 'keywords' || summaryMetric === 'traffic';
  const trendTitle = summaryMetric === 'traffic' ? 'Traffic Trend' : 'Organic Keywords Trend';
  const gscConnectHref = `/api/gsc/connect?redirect=${encodeURIComponent(`/sites/${slug}/keyword-list`)}`;

  const onSort = (key: string) => {
    const k = key as OrganicSortKey;
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(k);
      setSortDir(k === 'keyword' ? 'asc' : 'desc');
    }
  };

  const activeCountry = (dataset?.meta?.locale?.country ?? 'US').toUpperCase().slice(0, 2);

  return (
    <AppShell domains={domains} showAddModal={() => {}} showSettings={() => {}}>
      <Head><title>{`Keyword list — ${domain} — Ranksmile`}</title></Head>
      <style>{`
        .si-organic-row:hover { background: #f3f4f0 !important; }
      `}</style>

      <DomainSubLayout
        domain={domain}
        slug={slug || ''}
        section="Keyword list"
        heading={<OrganicPageTitle domain={domain} />}
        subtitle={(
          <OrganicPageHeaderInfo
            countryCode={activeCountry}
            keywordCount={dataset?.metrics.keywordCount ?? 0}
            fetchedAt={dataset?.meta?.fetchedAt ?? null}
          />
        )}
        contentMaxWidth="100%"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {organicQ.isLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Skeleton rows={2} columns={3} />
              <Skeleton rows={4} columns={1} />
              <Skeleton rows={8} columns={6} />
            </div>
          )}

          {organicQ.isError && (
            <div style={{
              background: '#fff', border: '1px solid #dbded4', borderRadius: 8, padding: 24,
              color: '#E03E3E', fontFamily: FONT, fontSize: 14,
            }}
            >
              {(organicQ.error as Error)?.message || 'Failed to load organic dataset'}
            </div>
          )}

          {!organicQ.isLoading && !organicQ.isError && needsDfs && (
            <div style={{
              background: '#fff',
              border: '1px solid #dbded4',
              borderRadius: 8,
              padding: '48px 32px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}
            >
              <div style={{ fontSize: 18, fontWeight: 700, color: '#181225', fontFamily: FONT }}>
                DataForSEO is not configured
              </div>
              <div style={{
                fontSize: 14,
                color: '#6A6772',
                fontFamily: FONT,
                maxWidth: 440,
                lineHeight: 1.5,
              }}
              >
                Keyword list needs DataForSEO Labs for keyword positions, traffic estimates,
                and the monthly trend chart. Add credentials in your environment, then reload.
              </div>
              <Link
                href="/settings"
                style={{ textDecoration: 'none', marginTop: 8 }}
              >
                <Button type="button" variant="primary" size="md">
                  Open settings
                </Button>
              </Link>
            </div>
          )}

          {!organicQ.isLoading && !organicQ.isError && dataset && !needsDfs && (
            <>
              {!gscConnected && (
                <div style={{
                  background: '#fff',
                  border: '1px solid #dbded4',
                  borderRadius: 8,
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  flexWrap: 'wrap',
                }}
                >
                  <div style={{ fontFamily: FONT, fontSize: 13, color: '#302E36', lineHeight: 1.4 }}>
                    Connect Google Search Console to enrich Traffic with real clicks.
                    Positions and estimates still come from DataForSEO.
                  </div>
                  <a href={gscConnectHref} style={{ textDecoration: 'none', flexShrink: 0 }}>
                    <Button type="button" variant="secondary" size="sm">
                      Connect GSC
                    </Button>
                  </a>
                </div>
              )}

              <OrganicFilterBar
                mode="labs"
                filters={filters}
                serpFeatureOptions={serpFeatureOptions}
                onChange={(next) => {
                  setFilters(next);
                  setPage(1);
                }}
              />

              <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 0 }}>
                <OrganicKpiRow
                  metrics={dataset.metrics}
                  keywordSeries={keywordSeries.slice(-12)}
                  trafficSeries={trafficSeries.slice(-12)}
                  selected={summaryMetric}
                  connectedBelow={trendOpen}
                  onSelect={(m) => setSummaryMetric((prev) => (prev === m ? null : m))}
                />
                {trendOpen && (
                  <OrganicPositionChart
                    chart={dataset.chart}
                    range={chartRange}
                    onRangeChange={setChartRange}
                    visible={seriesVisible}
                    title={trendTitle}
                    connectedAbove
                    loading={organicQ.isFetching && !dataset.chart?.length}
                    onClose={() => setSummaryMetric(null)}
                    onToggle={(key) => setSeriesVisible((v) => ({ ...v, [key]: v[key] === false }))}
                  />
                )}
              </div>

              <OrganicKeywordsTable
                rows={table.rows}
                total={table.total}
                domain={domain}
                trackerCountry={dataset.meta?.locale?.country ?? 'US'}
                topicLabel={(id) => topicMap.get(id || '') || 'Uncategorized'}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                onFilterKeyword={(keyword) => {
                  setFilters((f) => ({ ...f, q: keyword }));
                  setPage(1);
                }}
                exportCsvHref={organicExportUrl(slug, 'csv', filters.q)}
                exportJsonHref={organicExportUrl(slug, 'json', filters.q)}
                updatedAtLabel={
                  dataset.meta?.fetchedAt
                    ? `Updated ${new Date(dataset.meta.fetchedAt).toLocaleString()}`
                    : null
                }
                footer={(
                  <Pagination
                    page={page}
                    pageCount={totalPages}
                    onPageChange={setPage}
                    caption={getPaginationCaption({ page, pageSize, total: table.total })}
                  />
                )}
              />
            </>
          )}
        </div>
      </DomainSubLayout>
    </AppShell>
  );
};

export default KeywordListPage;
