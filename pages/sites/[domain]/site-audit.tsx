/* eslint-disable max-len */
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import AppShell from '../../../components/common/AppShell';
import DomainSubLayout from '../../../components/domains/DomainSubLayout';
import SiteAuditOverview from '../../../components/siteAudit/SiteAuditOverview';
import SiteAuditIssues from '../../../components/siteAudit/SiteAuditIssues';
import SiteAuditIssueDetail from '../../../components/siteAudit/SiteAuditIssueDetail';
import SiteAuditCrawledPages from '../../../components/siteAudit/SiteAuditCrawledPages';
import SiteAuditCompareCrawls from '../../../components/siteAudit/SiteAuditCompareCrawls';
import { CrawlLimitIndicator } from '../../../components/siteAudit/CrawlLimitPopover';
import CrawlLimitUpgradeBanner from '../../../components/siteAudit/CrawlLimitUpgradeBanner';
import { Button, Tabs } from '../../../components/core';
import { AUDIT_URL_PATH, sitePath } from '../../../lib/navigation';
import { useFetchDomains } from '../../../services/domains';
import { slugToDomain } from '../../../utils/slugToDomain';
import { useSiteAuditCompareCrawls, useSiteAuditCrawledPages, useSiteAuditIssueDetail, useSiteAuditOverview } from '../../../services/siteAudit';
import type { SiteAuditTab } from '../../../lib/siteAudit/types';

const FONT = 'var(--font-family-primary)';

const TAB_ITEMS: { value: SiteAuditTab; label: string; ready: boolean }[] = [
  { value: 'overview', label: 'Overview', ready: true },
  { value: 'issues', label: 'Issues', ready: true },
  { value: 'pagereport', label: 'Crawled Pages', ready: true },
  { value: 'compare', label: 'Compare Crawls', ready: true },
  { value: 'history', label: 'Progress', ready: false },
  { value: 'js-impact', label: 'JS Impact', ready: false },
];

function ReloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M13.95 1a1 1 0 0 0-1 1v1.11-.06a7 7 0 1 0 0 9.9 1 1 0 0 0-1.41-1.41 5 5 0 1 1 0-7.08c.16.172.31.352.45.54h-2a1 1 0 0 0 0 2h4a1 1 0 0 0 1-1V2a.999.999 0 0 0-1.04-1Z" />
    </svg>
  );
}

const SiteAuditPage: NextPage = () => {
  const router = useRouter();
  const slug = router.query.domain as string | undefined;
  const domain = slug ? slugToDomain(slug) : '';
  const [tab, setTab] = useState<SiteAuditTab>('overview');
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [compareOlderId, setCompareOlderId] = useState<string | undefined>();
  const [compareNewerId, setCompareNewerId] = useState<string | undefined>();
  const [rerunning, setRerunning] = useState(false);

  const { data: domainsData } = useFetchDomains(router, true);
  const domains = domainsData?.domains ?? [];

  const auditQ = useSiteAuditOverview(slug);
  const data = auditQ.data;
  const issueDetailQ = useSiteAuditIssueDetail(slug, selectedIssueId ?? undefined);
  const crawledPagesQ = useSiteAuditCrawledPages(slug);
  const compareQ = useSiteAuditCompareCrawls(slug, compareOlderId, compareNewerId);

  // Deep-link from Priority Apply: /site-audit?issue=<issueId>
  useEffect(() => {
    if (!router.isReady) return;
    const raw = router.query.issue;
    const issueId = typeof raw === 'string' ? raw.trim() : Array.isArray(raw) ? raw[0]?.trim() : '';
    if (!issueId) return;
    setTab('issues');
    setSelectedIssueId(issueId);
  }, [router.isReady, router.query.issue]);

  const tabItems = useMemo(
    () => TAB_ITEMS.map((t) => ({ value: t.value, label: t.label })),
    [],
  );

  const onTabChange = (value: string) => {
    const item = TAB_ITEMS.find((t) => t.value === value);
    if (!item?.ready) {
      toast('This report is coming in the next step.', { icon: 'ℹ️' });
      return;
    }
    setTab(value as SiteAuditTab);
    if (value !== 'issues') setSelectedIssueId(null);
  };

  const rerunCampaign = async () => {
    if (!slug || rerunning) return;
    setRerunning(true);
    try {
      const res = await fetch(`/api/domains/${encodeURIComponent(slug)}/run-setup`, { method: 'POST' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'Rerun failed');
      }
      toast.success('Site audit crawl queued');
      await auditQ.refetch();
      if (tab === 'pagereport') await crawledPagesQ.refetch();
      if (tab === 'compare') await compareQ.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rerun failed');
    } finally {
      setRerunning(false);
    }
  };

  const filters = (
    <div className="sentry-page-filters" style={{ marginBottom: 16 }}>
      <Tabs items={tabItems} value={tab} onChange={onTabChange} />
    </div>
  );

  const headerMeta = data ? (
    <div className="sentry-site-audit-meta">
      <span className="sentry-site-audit-meta-item">Desktop</span>
      <span className="sentry-site-audit-meta-divider" aria-hidden="true" />
      <span className="sentry-site-audit-meta-item">
        {data.jsRendering ? 'JS rendering' : 'No JS rendering'}
      </span>
      <span className="sentry-site-audit-meta-divider" aria-hidden="true" />
      <CrawlLimitIndicator
        pagesCrawled={data.pagesCrawled}
        pagesLimit={data.pagesLimit}
        atCrawlLimit={data.atCrawlLimit}
        canUpgradeCrawlLimit={data.canUpgradeCrawlLimit}
        upgradePlanName={data.upgradePlanName}
        upgradePlanSlug={data.upgradePlanSlug}
        upgradePagesLimit={data.upgradePagesLimit}
      />
    </div>
  ) : null;

  return (
    <AppShell domains={domains} showAddModal={() => {}} showSettings={() => {}}>
      <Head>
        <title>{domain ? `Site Audit — ${domain}` : 'Site Audit'}</title>
      </Head>
      <DomainSubLayout
        domain={domain}
        slug={slug ?? ''}
        section="Site Audit"
        contentMaxWidth={1280}
        heading={slug ? `Site Audit: ${domain}` : 'Site Audit'}
        subtitle="Analyze your entire website"
        meta={headerMeta}
        filters={filters}
        actions={(
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {slug && (
              <Link href={sitePath(slug, AUDIT_URL_PATH)} style={{ textDecoration: 'none' }}>
                <Button type="button" variant="secondary" size="sm">
                  Audit URL
                </Button>
              </Link>
            )}
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={rerunCampaign}
              disabled={!slug || rerunning}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <ReloadIcon />
                {rerunning ? 'Queuing…' : 'Rerun campaign'}
              </span>
            </Button>
            <Button type="button" variant="secondary" size="sm" disabled>Export</Button>
            <Button type="button" variant="secondary" size="sm" disabled>Share</Button>
          </div>
        )}
      >
        {auditQ.isLoading && (
          <div style={{ padding: 40, textAlign: 'center', color: '#52525C', fontFamily: FONT }}>Loading site audit…</div>
        )}
        {auditQ.isError && (
          <div style={{ padding: 40, textAlign: 'center', color: '#FF6F77', fontFamily: FONT }}>
            {auditQ.error instanceof Error ? auditQ.error.message : 'Failed to load site audit'}
          </div>
        )}
        {data && !data.hasData && (
          <div
            className="perf-3d-card"
            style={{
              borderRadius: 12,
              background: '#FFFFFF',
              padding: 40,
              textAlign: 'center',
              fontFamily: FONT,
            }}
          >
            <h2 style={{ margin: '0 0 12px', fontSize: 18, color: '#18181B' }}>No crawl data yet</h2>
            <p style={{ margin: '0 0 20px', color: '#52525C', fontSize: 14 }}>
              Run domain setup to crawl up to
              {' '}
              {data.pagesLimit}
              {' '}
              pages and generate your Site Audit overview.
            </p>
            <Button type="button" variant="primary" size="sm" onClick={rerunCampaign} disabled={rerunning}>
              {rerunning ? 'Queuing…' : 'Start crawl'}
            </Button>
          </div>
        )}
        {data && data.hasData && data.atCrawlLimit && (
          <div style={{ marginBottom: 16 }}>
            <CrawlLimitUpgradeBanner
              pagesCrawled={data.pagesCrawled}
              pagesLimit={data.pagesLimit}
              upgradePlanName={data.upgradePlanName}
              upgradePlanSlug={data.upgradePlanSlug}
              upgradePagesLimit={data.upgradePagesLimit}
            />
          </div>
        )}
        {data && data.hasData && tab === 'overview' && (
          <SiteAuditOverview
            data={data}
            onViewAllIssues={() => {
              setTab('issues');
              setSelectedIssueId(null);
            }}
          />
        )}
        {data && data.hasData && tab === 'issues' && !selectedIssueId && (
          <SiteAuditIssues
            report={data.issuesReport}
            onSelectIssue={(issueId) => setSelectedIssueId(issueId)}
          />
        )}
        {data && data.hasData && tab === 'issues' && selectedIssueId && (
          <>
            {issueDetailQ.isLoading && (
              <div style={{ padding: 40, textAlign: 'center', color: '#52525C', fontFamily: FONT }}>
                Loading issue details…
              </div>
            )}
            {issueDetailQ.isError && (
              <div style={{ padding: 40, textAlign: 'center', color: '#FF6F77', fontFamily: FONT }}>
                {issueDetailQ.error instanceof Error ? issueDetailQ.error.message : 'Failed to load issue'}
              </div>
            )}
            {issueDetailQ.data && (
              <SiteAuditIssueDetail
                data={issueDetailQ.data}
                onBack={() => setSelectedIssueId(null)}
              />
            )}
          </>
        )}
        {data && data.hasData && tab === 'pagereport' && (
          <>
            {crawledPagesQ.isLoading && (
              <div style={{ padding: 40, textAlign: 'center', color: '#52525C', fontFamily: FONT }}>
                Loading crawled pages…
              </div>
            )}
            {crawledPagesQ.isError && (
              <div style={{ padding: 40, textAlign: 'center', color: '#FF6F77', fontFamily: FONT }}>
                {crawledPagesQ.error instanceof Error ? crawledPagesQ.error.message : 'Failed to load crawled pages'}
              </div>
            )}
            {crawledPagesQ.data && <SiteAuditCrawledPages report={crawledPagesQ.data} />}
          </>
        )}
        {data && data.hasData && tab === 'compare' && (
          <>
            {compareQ.isLoading && (
              <div style={{ padding: 40, textAlign: 'center', color: '#52525C', fontFamily: FONT }}>
                Loading compare crawls…
              </div>
            )}
            {compareQ.isError && (
              <div style={{ padding: 40, textAlign: 'center', color: '#FF6F77', fontFamily: FONT }}>
                {compareQ.error instanceof Error ? compareQ.error.message : 'Failed to load compare crawls'}
              </div>
            )}
            {compareQ.data && (
              <SiteAuditCompareCrawls
                report={compareQ.data}
                onOlderChange={(id) => setCompareOlderId(id)}
                onNewerChange={(id) => setCompareNewerId(id)}
                onOpenOverview={() => setTab('overview')}
                onOpenCrawledPages={() => setTab('pagereport')}
                onOpenIssues={() => {
                  setTab('issues');
                  setSelectedIssueId(null);
                }}
                onOpenIssue={(issueId) => {
                  setTab('issues');
                  setSelectedIssueId(issueId);
                }}
              />
            )}
          </>
        )}
      </DomainSubLayout>
    </AppShell>
  );
};

export default SiteAuditPage;
