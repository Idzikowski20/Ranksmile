import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { GuidedTour, type GuidedTourStep } from '../koala/product/GuidedTour';
import {
  blue, darkBlue, darkOrange, green, orange, pink, purple, slate, softGreen, yellow,
} from '../koala/tokens/colors';
import {
  ActivityLogScene,
  AiCompetitorsScene,
  AiOverviewScene,
  AiPromptsScene,
  AiSourcesScene,
  AutomationsScene,
  ContentAuditScene,
  ContentScene,
  DashboardScene,
  FanoutScene,
  KeywordListScene,
  KeywordResearchScene,
  KeywordTrackingScene,
  PerformanceScene,
  RecommendationsScene,
  SiteAuditScene,
  TopicResearchScene,
} from './tourScenes';

const ENDPOINT = '/api/onboarding/page-tour';
const TOUR_QUERY_KEY = 'pageTourSeen';

/**
 * One card per sidebar page, in sidebar order, so the spotlight sweeps top-to-bottom.
 *
 * `selector` targets the `data-tour` attribute SidebarItem derives from each label.
 * The SEO/AI/Tools blocks only render once a site is selected — steps whose target is
 * missing fall back to a centered card rather than disappearing.
 *
 * Accents never repeat between neighbours, so two consecutive cards always read as
 * different pages.
 */
const STEPS: GuidedTourStep[] = [
  {
    id: 'dashboard',
    selector: '[data-tour="nav-dashboard"]',
    title: 'Dashboard',
    body: 'Your starting point — clicks, articles and recommendations for the selected site at a glance.',
    illustration: <DashboardScene accent={purple[400]} />,
  },
  {
    id: 'content',
    selector: '[data-tour="nav-content"]',
    title: 'Content',
    body: 'Every article you draft or optimize, with the editor and its live content score.',
    illustration: <ContentScene accent={green[400]} />,
  },
  {
    id: 'performance',
    selector: '[data-tour="nav-performance"]',
    title: 'Performance',
    body: 'Search Console data over time: clicks, impressions and positions for every tracked page.',
    illustration: <PerformanceScene accent={blue[400]} />,
  },
  {
    id: 'site-audit',
    selector: '[data-tour="nav-site-audit"]',
    title: 'Site Audit',
    body: 'A technical crawl of your site — broken links, slow pages and indexing issues, ranked by severity.',
    illustration: <SiteAuditScene accent={darkOrange[400]} />,
  },
  {
    id: 'recommendations',
    selector: '[data-tour="nav-recommendations"]',
    title: 'Recommendations',
    body: 'The next actions worth taking, ordered by impact. Work the list from the top.',
    illustration: <RecommendationsScene accent={yellow[400]} />,
  },
  {
    id: 'content-audit',
    selector: '[data-tour="nav-content-audit"]',
    title: 'Content Audit',
    body: 'Scores your published pages so you can see which ones to refresh before writing anything new.',
    illustration: <ContentAuditScene accent={pink[400]} />,
  },
  {
    id: 'keyword-list',
    selector: '[data-tour="nav-keyword-list"]',
    title: 'Keyword list',
    body: 'Every keyword your site ranks for, with volume, difficulty and the page that owns it.',
    illustration: <KeywordListScene accent={darkBlue[400]} />,
  },
  {
    id: 'keyword-tracking',
    selector: '[data-tour="nav-keyword-tracking"]',
    title: 'Keyword tracking',
    body: 'Daily positions for the keywords you monitor, so you catch a drop the week it happens.',
    illustration: <KeywordTrackingScene accent={softGreen[400]} />,
  },
  {
    id: 'activity-log',
    selector: '[data-tour="nav-activity-log"]',
    title: 'Activity Log',
    body: 'A record of every crawl, scan and generation — what ran, when, and how it finished.',
    illustration: <ActivityLogScene accent={slate[400]} />,
  },
  {
    id: 'automations',
    selector: '[data-tour="nav-automations"]',
    title: 'Automations',
    body: 'Schedule articles and recurring scans so the routine work happens without you.',
    illustration: <AutomationsScene accent={orange[400]} />,
  },
  {
    id: 'ai-overview',
    selector: '[data-tour="nav-overview"]',
    title: 'AI Visibility · Overview',
    body: 'How often AI engines mention your brand, scored across ChatGPT, Gemini, Perplexity and Google.',
    illustration: <AiOverviewScene accent={purple[400]} />,
  },
  {
    id: 'ai-sources',
    selector: '[data-tour="nav-sources"]',
    title: 'AI Visibility · Sources',
    body: 'The pages AI engines actually cite when they answer — yours and everyone else’s.',
    illustration: <AiSourcesScene accent={blue[400]} />,
  },
  {
    id: 'ai-competitors',
    selector: '[data-tour="nav-competitors"]',
    title: 'AI Visibility · Competitors',
    body: 'Share of voice against the brands you compete with for the same AI answers.',
    illustration: <AiCompetitorsScene accent={darkOrange[400]} />,
  },
  {
    id: 'ai-prompts',
    selector: '[data-tour="nav-prompts"]',
    title: 'AI Visibility · Prompts',
    body: 'The questions we put to each engine on your behalf. Add the ones your buyers actually ask.',
    illustration: <AiPromptsScene accent={green[400]} />,
  },
  {
    id: 'ai-fanout',
    selector: '[data-tour="nav-fanout-queries"]',
    title: 'AI Visibility · Fanout Queries',
    body: 'The sub-questions an engine spawns from one prompt — where the citations are really won.',
    illustration: <FanoutScene accent={pink[400]} />,
  },
  {
    id: 'keyword-research',
    selector: '[data-tour="nav-keyword-research"]',
    title: 'Keyword Research',
    body: 'Start from a seed keyword and pull volume, difficulty and related terms to plan around.',
    illustration: <KeywordResearchScene accent={darkBlue[400]} />,
  },
  {
    id: 'topic-research',
    selector: '[data-tour="nav-topic-research"]',
    title: 'Topic Research',
    body: 'Builds a topic cluster around a pillar so your articles support each other instead of competing.',
    illustration: <TopicResearchScene accent={yellow[400]} />,
  },
];

/**
 * Post-onboarding one-flight tour: shows once, then never again for that user.
 * Mount on the dashboard page.
 *
 * "Seen" lives on the user row, not in localStorage, so it follows them across
 * browsers and devices and survives clearing site data. The query fails closed —
 * if the state cannot be read we treat the tour as already seen rather than risk
 * replaying a 17-step walkthrough at someone who has finished it.
 */
const PageTour = () => {
  const [open, setOpen] = useState(false);
  const steps = useMemo(() => STEPS, []);
  const queryClient = useQueryClient();

  const { data } = useQuery(
    TOUR_QUERY_KEY,
    async () => {
      const res = await fetch(ENDPOINT);
      if (!res.ok) throw new Error('Failed to load tour state');
      return res.json() as Promise<{ seen: boolean }>;
    },
    { staleTime: Infinity, retry: false },
  );

  useEffect(() => {
    if (data?.seen === false) setOpen(true);
  }, [data]);

  const dismiss = () => {
    setOpen(false);
    // Optimistic: the tour must not flash back if the write is slow or fails.
    queryClient.setQueryData(TOUR_QUERY_KEY, { seen: true });
    fetch(ENDPOINT, { method: 'POST' }).catch(() => {
      // Swallowed deliberately: a failed write means the tour may reappear on the
      // next visit, which is a far better outcome than blocking the dashboard on it.
    });
  };

  return <GuidedTour open={open} steps={steps} onClose={dismiss} />;
};

export default PageTour;
