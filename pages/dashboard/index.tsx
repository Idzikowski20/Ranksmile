import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import { CSSTransition } from 'react-transition-group';
import { useQuery, useQueryClient } from 'react-query';
import DashboardLayout from '../../components/common/DashboardLayout';
import { useFetchDomains } from '../../services/domains';
import Settings from '../../components/settings/Settings';
import AddDomain from '../../components/domains/AddDomain';
import DashboardGreeting from '../../components/dashboard/DashboardGreeting';
import GetStartedCard from '../../components/dashboard/GetStartedCard';
import BrandPerformance from '../../components/dashboard/BrandPerformance';
import RecommendationsSection, { RecommendationItem } from '../../components/dashboard/RecommendationsSection';
import LearnSection from '../../components/dashboard/LearnSection';
import SetupPipeline from '../../components/dashboard/SetupPipeline';
import { useSetupStatus, useRunSetup } from '../../services/domainPipeline';

const formatShortDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const DashboardPage: NextPage = () => {
  const { data: domainsData } = useFetchDomains({} as any);
  const queryClient = useQueryClient();
  const [showSettings, setShowSettings] = useState(false);
  const [showAddDomain, setShowAddDomain] = useState(false);

  const { data: sitesData, isLoading: sitesLoading } = useQuery('dashboardSites', async () => {
    const res = await fetch('/api/sites');
    if (!res.ok) return { domainStats: {} };
    return res.json();
  }, { retry: false });

  const { data: articlesData, isLoading: articlesLoading } = useQuery('dashboardArticles', async () => {
    const res = await fetch('/api/articles');
    if (!res.ok) return { articles: [] };
    return res.json();
  });

  // ── Clicks: aggregate GSC daily clicks across all domains ──
  const clickSeries = useMemo(() => {
    const stats = sitesData?.domainStats || {};
    const byDate = new Map<string, number>();
    Object.values(stats).forEach((s: unknown) => {
      type StatEntry = { chart?: Array<{ date: string; clicks?: number }> };
      ((s as StatEntry)?.chart || []).forEach((p) => {
        byDate.set(p.date, (byDate.get(p.date) || 0) + (p.clicks || 0));
      });
    });
    return [...byDate.keys()].sort().map((date) => ({ date, clicks: byDate.get(date) || 0 }));
  }, [sitesData]);

  const points = clickSeries.map((p) => p.clicks);
  const clicksTotal = points.reduce((a, b) => a + b, 0);
  const half = Math.floor(clickSeries.length / 2);
  const prevSum = points.slice(0, half).reduce((a, b) => a + b, 0);
  const currSum = points.slice(half).reduce((a, b) => a + b, 0);
  const deltaPct = prevSum > 0 ? Math.round(((currSum - prevSum) / prevSum) * 100) : (currSum > 0 ? 100 : 0);
  const hasData = clickSeries.length > 0;

  const domains: DomainType[] = domainsData?.domains || [];
  const primaryDomain = domains[0];
  const activeDomainId: number | null = primaryDomain?.ID ?? null;
  const clicksHref = primaryDomain ? `/sites/${primaryDomain.slug}` : '/sites';
  const recommendationsHref = primaryDomain ? `/sites/${primaryDomain.slug}/recommendations` : '/sites';

  // ── Pipeline polling ──
  const { data: setup } = useSetupStatus(activeDomainId);
  const runSetup = useRunSetup();

  // Fallback kick: if no job exists yet for this domain, trigger one — but ONCE per
  // domain. The ref latch + isLoading guard stop a refetch (window focus, the done
  // invalidation, an enqueue race) from re-reading 'none' and spamming run-setup.
  const kickedRef = useRef<number | null>(null);
  useEffect(() => {
    if (setup && setup.status === 'none' && activeDomainId
        && kickedRef.current !== activeDomainId && !runSetup.isLoading) {
      kickedRef.current = activeDomainId;
      runSetup.mutate(activeDomainId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup?.status, activeDomainId]);

  // On transition to done, refresh the dashboard data queries
  useEffect(() => {
    if (setup?.status === 'done') {
      queryClient.invalidateQueries('dashboardArticles');
      queryClient.invalidateQueries('dashboardSites');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup?.status]);

  const pipelineActive = setup && (setup.status === 'queued' || setup.status === 'running' || setup.status === 'failed');

  // ── Recommendations: analyzed articles (pulls from the recommendations data) ──
  const recommendations: RecommendationItem[] = useMemo(() => {
    type ArticleRow = { id: number; title: string; content_score: number; source: string };
    const arts: ArticleRow[] = (articlesData?.articles ?? []).filter(
      (a: ArticleRow) => a.source !== 'site_context' && a.title && (a.content_score ?? 0) > 0,
    );
    return arts
      .sort((a, b) => (b.content_score || 0) - (a.content_score || 0))
      .map((a) => ({ id: a.id, title: a.title, score: a.content_score || 0, href: recommendationsHref }));
  }, [articlesData, recommendationsHref]);

  const startLabel = formatShortDate(clickSeries[0]?.date || '');
  const endLabel = formatShortDate(clickSeries[clickSeries.length - 1]?.date || '');

  return (
    <DashboardLayout
      domains={domains}
      showAddModal={() => setShowAddDomain(true)}
      showSettings={() => setShowSettings(true)}
    >
      <>
        <Head>
          <title>Dashboard — SerpBear</title>
          <meta name="description" content="SerpBear Dashboard" />
          <link rel="icon" href="/favicon.ico" />
        </Head>

        {pipelineActive ? (
          <SetupPipeline
            stages={setup.stages}
            stagePercent={setup.stagePercent}
            status={setup.status}
            error={setup.error}
            onRetry={() => { if (activeDomainId) runSetup.mutate(activeDomainId); }}
          />
        ) : (
          <div style={{ flex: 1, overflow: 'auto', padding: '48px 16px' }} className="styled-scrollbar">
            <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 48 }}>
              <DashboardGreeting clicksTotal={clicksTotal} deltaPct={deltaPct} hasData={hasData} loading={sitesLoading} clicksHref={clicksHref} />
              <GetStartedCard />
              <BrandPerformance
                total={clicksTotal}
                deltaPct={deltaPct}
                points={points}
                startLabel={startLabel}
                endLabel={endLabel}
                clicksHref={clicksHref}
                loading={sitesLoading}
              />
              <RecommendationsSection
                items={recommendations.slice(0, 3)}
                total={recommendations.length}
                faviconDomain={primaryDomain?.domain || ''}
                viewHref={recommendationsHref}
                loading={articlesLoading}
              />
              <LearnSection />
            </div>
          </div>
        )}

        {showAddDomain && (
          <AddDomain domains={domains} closeModal={() => setShowAddDomain(false)} />
        )}

        <CSSTransition in={showSettings} timeout={300} classNames="settings_anim" unmountOnExit mountOnEnter>
          <Settings closeSettings={() => setShowSettings(false)} />
        </CSSTransition>
      </>
    </DashboardLayout>
  );
};

export default DashboardPage;
