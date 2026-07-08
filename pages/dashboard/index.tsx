import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { CSSTransition } from 'react-transition-group';
import { useQuery, useQueryClient } from 'react-query';
import DashboardLayout from '../../components/common/DashboardLayout';
import { SentryPage } from '../../components/sentry-pages';
import { useFetchDomains } from '../../services/domains';
import { useWorkspaces } from '../../services/workspaces';
import { deriveActiveId, resolveActiveDomain, workspaceHref } from '../../lib/activeWorkspace';
import { useStaggerReveal } from '../../lib/motion/useStaggerReveal';
import TrafficAlertsSection from '../../components/dashboard/TrafficAlertsSection';
import Settings from '../../components/settings/Settings';
import AddDomain from '../../components/domains/AddDomain';
import DashboardGreeting from '../../components/dashboard/DashboardGreeting';
import GetStartedCard from '../../components/dashboard/GetStartedCard';
import BrandPerformance from '../../components/dashboard/BrandPerformance';
import RecommendationsSection, { RecommendationItem } from '../../components/dashboard/RecommendationsSection';
import RecentlyEdited, { RecentlyEditedItem } from '../../components/dashboard/RecentlyEdited';
import LearnSection from '../../components/dashboard/LearnSection';
import SetupPipeline from '../../components/dashboard/SetupPipeline';
import { useSetupStatus, useRunSetup } from '../../services/domainPipeline';
import fetchJson from '../../lib/fetchJson';
import { isActionableRecommendation } from '../../lib/recommendations';

const formatShortDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

interface DashboardArticle {
  id: number | string;
  title: string;
  content_score: number;
  target_keyword?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  source?: string;
}
interface DomainRec {
  id: number;
  title: string;
  priority: string | null;
  type: string | null;
  url: string | null;
  score: number | null;
  word_count: number | null;
}

const DashboardPage: NextPage = () => {
  const router = useRouter();
  const { data: domainsData } = useFetchDomains(router);
  const queryClient = useQueryClient();
  const { data: wsData } = useWorkspaces();
  // SSR-safe active workspace id so links carry the /workspace/<id> prefix the rest of
  // the app uses (parsed from the URL after mount; falls back to the workspaces activeId).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const activeWsId = deriveActiveId(mounted, router.asPath, wsData?.activeId);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddDomain, setShowAddDomain] = useState(false);

  const { data: sitesData, isLoading: sitesLoading } = useQuery(
    'dashboardSites', () => fetchJson('/api/sites', { domainStats: {} as Record<string, unknown> }), { retry: false },
  );

  const { data: articlesData, isLoading: articlesLoading } = useQuery(
    'dashboardArticles', () => fetchJson('/api/articles', { articles: [] as DashboardArticle[] }),
  );

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

  // Period-over-period like SurferSEO: the last 30 days vs the previous 30 days —
  // NOT the two halves of one window. The chart + total reflect the last 30 days.
  const recent30 = clickSeries.slice(-30);
  const prev30 = clickSeries.slice(-60, -30);
  const points = recent30.map((p) => p.clicks);
  const clicksTotal = points.reduce((a, b) => a + b, 0);
  const prevSum = prev30.reduce((a, b) => a + b.clicks, 0);
  const currSum = clicksTotal;
  const deltaPct = prevSum > 0 ? Math.round(((currSum - prevSum) / prevSum) * 100) : (currSum > 0 ? 100 : 0);
  const hasData = recent30.length > 0;

  const domains: DomainType[] = domainsData?.domains || [];
  // `domains` spans every workspace the user can access (GET /api/domains isn't
  // workspace-scoped), so `domains[0]` picked whichever domain happened to sort first
  // overall — NOT the currently active workspace's domain. That's why a freshly
  // created workspace's dashboard/pipeline silently tracked a different, unrelated
  // (already-"done") domain and the "Analyzing your domain…" card never progressed:
  // the auto-kick effect below never fired for the new domain at all.
  const activeWorkspace = wsData?.workspaces.find((w) => w.id === activeWsId) ?? null;
  const primaryDomain = resolveActiveDomain(domains, activeWsId, activeWorkspace?.domain) ?? domains[0];
  const activeDomainSlug: string | null = primaryDomain?.slug ?? null;
  const clicksHref = workspaceHref(activeWsId, primaryDomain ? `/sites/${primaryDomain.slug}` : '/dashboard');
  const recommendationsHref = workspaceHref(activeWsId, primaryDomain ? `/sites/${primaryDomain.slug}/recommendations` : '/dashboard');
  const settingsHref = workspaceHref(activeWsId, primaryDomain ? `/sites/${primaryDomain.slug}` : '/dashboard');

  // Domain-level recommendations produced by the setup pipeline (the scan output).
  const { data: domainRecsData, isLoading: domainRecsLoading } = useQuery(
    ['domainRecs', activeDomainSlug],
    () => fetchJson(`/api/domains/${activeDomainSlug}/recommendations`, { recommendations: [] as DomainRec[] }),
    { enabled: !!activeDomainSlug, retry: false },
  );

  // Whether the domain has a blog path configured — drives the empty-state message.
  const { data: blogPathsData, isLoading: blogPathsLoading } = useQuery(
    ['blogPaths', activeDomainSlug],
    () => fetchJson(`/api/domains/blog-paths?slug=${activeDomainSlug}`, { blogPaths: [] as string[] }),
    { enabled: !!activeDomainSlug, retry: false },
  );
  const hasBlogPath = (blogPathsData?.blogPaths?.length ?? 0) > 0;

  // ── Pipeline polling ──
  const { data: setup, isLoading: setupLoading } = useSetupStatus(activeDomainSlug);
  const runSetup = useRunSetup();

  // Fallback kick: if no job exists yet for this domain, trigger one — but ONCE per
  // domain. The ref latch + isLoading guard stop a refetch (window focus, the done
  // invalidation, an enqueue race) from re-reading 'none' and spamming run-setup.
  const kickedRef = useRef<string | null>(null);
  // Stagger-reveal the dashboard cards (direct children of the column) on scroll into view.
  const revealRef = useStaggerReveal<HTMLDivElement>(':scope > *');
  useEffect(() => {
    if (setup && setup.status === 'none' && activeDomainSlug
        && kickedRef.current !== activeDomainSlug && !runSetup.isLoading) {
      kickedRef.current = activeDomainSlug;
      runSetup.mutate(activeDomainSlug);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup?.status, activeDomainSlug]);

  // On transition to done, refresh the dashboard data queries
  useEffect(() => {
    if (setup?.status === 'done') {
      queryClient.invalidateQueries('dashboardArticles');
      queryClient.invalidateQueries('dashboardSites');
      queryClient.invalidateQueries(['domainRecs', activeDomainSlug]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup?.status]);

  const pipelineActive = setup && (setup.status === 'queued' || setup.status === 'running' || setup.status === 'failed');

  // Until the pipeline's state is KNOWN, don't flash the empty "set blog path" prompt.
  // Pending = the status query is still loading, or a job is about to be kicked ('none').
  const pipelinePending = !!activeDomainSlug && (setupLoading || setup?.status === 'none');
  // The Recommendations card stays in its skeleton until everything that feeds it has
  // settled: articles, the domain recs/blog-path queries, and the pipeline status. This
  // also covers the brief refetch right after the pipeline flips to 'done'.
  const recommendationsLoading = articlesLoading
    || pipelinePending
    || (!!activeDomainSlug && (domainRecsLoading || blogPathsLoading));

  // ── Recommendations: the domain pipeline's scan output (pages requiring optimization).
  //    Falls back to analyzed articles with a content score when the scan produced none. ──
  const recommendations: RecommendationItem[] = useMemo(() => {
    const domainRecs = domainRecsData?.recommendations ?? [];
    // optimize recs carry a snapshot score (+ word count) → score-gauge row;
    // create recs carry a priority → priority-pill row. Drop optimize recs with a
    // 0 (or missing) score — an unscored page is noise, not a useful recommendation.
    const mapped: RecommendationItem[] = domainRecs
      .filter(isActionableRecommendation)
      .map((r) => (
        r.type === 'optimize' || r.score != null
          ? { id: r.id, title: r.title, type: 'optimize', score: r.score ?? 0, wordCount: r.word_count ?? undefined, href: recommendationsHref }
          : { id: r.id, title: r.title, type: 'create', priority: r.priority || 'low', href: recommendationsHref }
      ));
    // Most urgent first: optimize rows (lowest content score = highest priority) ahead of
    // create rows. `urgency` is the content score for optimize, +∞ for create (sorted last).
    const urgency = (it: RecommendationItem) => ('priority' in it ? Number.POSITIVE_INFINITY : it.score);
    if (mapped.length > 0) return mapped.sort((a, b) => urgency(a) - urgency(b));
    return (articlesData?.articles ?? [])
      .filter((a) => a.source !== 'site_context' && a.title && (a.content_score ?? 0) > 0)
      .sort((a, b) => (a.content_score || 0) - (b.content_score || 0))
      .map((a) => ({ id: a.id, title: a.title, score: a.content_score || 0, href: recommendationsHref }));
  }, [domainRecsData, articlesData, recommendationsHref]);

  const recentlyEdited: RecentlyEditedItem[] = useMemo(() => {
    // Only real articles — exclude site_context rows AND skeleton drafts whose title is
    // still the raw page URL (configure seeds those before analysis fills a real title).
    const arts = (articlesData?.articles ?? []).filter(
      (a) => a.source !== 'site_context' && a.title && !/^https?:\/\//i.test(a.title),
    );
    return arts
      .slice()
      .sort((a, b) => {
        const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
        const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 8)
      .map((a) => ({
        id: a.id,
        title: a.title,
        keywords: a.target_keyword || '',
        score: a.content_score || 0,
        updatedAt: a.updated_at || a.created_at || '',
        href: `/articles/${a.id}`,
      }));
  }, [articlesData]);

  const startLabel = formatShortDate(recent30[0]?.date || '');
  const endLabel = formatShortDate(recent30[recent30.length - 1]?.date || '');

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

        <SentryPage maxWidth={880}>
          <div ref={revealRef} style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
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
            <RecentlyEdited items={recentlyEdited} loading={articlesLoading} />
            {/* The domain pipeline renders INSIDE the Recommendations section (its output
                IS the recommendations) — never a takeover of the whole dashboard. */}
            <RecommendationsSection
              items={recommendations.slice(0, 3)}
              total={recommendations.length}
              faviconDomain={primaryDomain?.domain || ''}
              viewHref={recommendationsHref}
              loading={recommendationsLoading}
              coverage={setup?.auditCounts}
              hasBlogPath={hasBlogPath}
              settingsHref={settingsHref}
              pipeline={pipelineActive && setup ? (
                <SetupPipeline
                  stages={setup.stages}
                  status={setup.status}
                  error={setup.error}
                  onRetry={() => { if (activeDomainSlug) runSetup.mutate(activeDomainSlug); }}
                />
              ) : undefined}
            />
            <TrafficAlertsSection />
            <LearnSection />
          </div>
        </SentryPage>

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
