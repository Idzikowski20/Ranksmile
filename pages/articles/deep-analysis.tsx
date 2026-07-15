import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import DashboardLayout from '../../components/common/DashboardLayout';
import { Alert, Button } from '../../components/core';
import {
  SentryPage,
  SentryPageHeader,
  SentryPanel,
  SentryPanelBody,
  SentryPanelHeader,
} from '../../components/sentry-pages';
import { WizardStepper } from '../../components/articles/NewContentWizard';
import { useFetchDomains } from '../../services/domains';

// ── Must match the API handler ────────────────────────────────────────
const STEPS = [
  { key: 'fetch', label: 'Fetching page content' },
  { key: 'metadata', label: 'Extracting title and metadata' },
  { key: 'structure', label: 'Analyzing content structure' },
  { key: 'nlp', label: 'Extracting keywords and NLP terms' },
  { key: 'serp', label: 'Analyzing SERP competitors' },
  { key: 'score', label: 'Computing content score' },
  { key: 'image', label: 'Uploading featured image' },
  { key: 'save', label: 'Saving article' },
] as const;

type StepStatus = 'pending' | 'running' | 'done' | 'error';

interface StepState {
  key: string;
  label: string;
  status: StepStatus;
  errorMessage?: string;
}

type StageName = 'fetch_page' | 'scrape_serp' | 'classify_content' | 'extract_terms' | 'score_ranking' | 'ai_search' | 'finalizing' | 'done';

const STAGE_ORDER: StageName[] = [
  'fetch_page', 'scrape_serp', 'classify_content', 'extract_terms', 'score_ranking', 'ai_search', 'finalizing',
];

const STAGE_TO_STEPS: Record<string, string[]> = {
  fetch_page: ['fetch', 'metadata', 'structure'],
  scrape_serp: ['serp'],
  classify_content: ['nlp'],
  extract_terms: ['nlp'],
  score_ranking: ['score'],
  ai_search: [],
  finalizing: ['image', 'save'],
};

const PAGE_RUN_PREFIX = 'serpbear-deep-analysis-page:';

function pageRunKey(flow: string, urlStr: string, kwStr: string, domainId: string) {
  return `${PAGE_RUN_PREFIX}${flow}:${urlStr}:${kwStr}:${domainId}`;
}

function readPageRun(key: string): { articleId: number; jobId: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { articleId?: number; jobId?: string };
    if (parsed.articleId && parsed.jobId) return { articleId: parsed.articleId, jobId: parsed.jobId };
    return null;
  } catch {
    return null;
  }
}

function writePageRun(key: string, articleId: number, jobId: string) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(key, JSON.stringify({ articleId, jobId }));
}

function clearPageRun(key: string) {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(key);
}

function applyStageToSteps(stage: string, prev: StepState[]): StepState[] {
  if (stage === 'done') return prev.map((s) => ({ ...s, status: 'done' as StepStatus }));
  const stageIdx = STAGE_ORDER.indexOf(stage as StageName);
  if (stageIdx === -1) return prev;
  return prev.map((s) => {
    for (let i = 0; i < stageIdx; i += 1) {
      const completedStepKeys = STAGE_TO_STEPS[STAGE_ORDER[i]] || [];
      if (completedStepKeys.includes(s.key)) return { ...s, status: 'done' as StepStatus };
    }
    const currentStepKeys = STAGE_TO_STEPS[stage] || [];
    if (currentStepKeys.includes(s.key) && s.status !== 'done') return { ...s, status: 'running' as StepStatus };
    return s;
  });
}

const SearchEngineIcons = () => (
  <div className="deep-analysis-engine-icons" aria-hidden="true">
    <div className="deep-analysis-engine-icon">
      <svg width="14" height="14" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9.00005 16.1739C9.00005 15.1815 8.80875 14.2489 8.42614 13.3761C8.05548 12.5033 7.54734 11.744 6.90169 11.0984C6.25604 10.4527 5.49682 9.94457 4.62399 9.5739C3.75116 9.1913 2.81856 8.99999 1.82617 8.99999C2.81856 8.99999 3.75116 8.81466 4.62399 8.44402C5.49682 8.06142 6.25604 7.54727 6.90169 6.90162C7.54734 6.25598 8.05548 5.49673 8.42614 4.62392C8.80875 3.7511 9.00005 2.8185 9.00005 1.82611C9.00005 2.8185 9.18539 3.7511 9.55602 4.62392C9.93863 5.49673 10.4528 6.25598 11.0984 6.90162C11.7441 7.54727 12.5033 8.06142 13.3761 8.44402C14.2489 8.81466 15.1816 8.99999 16.1739 8.99999C15.1816 8.99999 14.2489 9.1913 13.3761 9.5739C12.5033 9.94457 11.7441 10.4527 11.0984 11.0984C10.4528 11.744 9.93863 12.5033 9.55602 13.3761C9.18539 14.2489 9.00005 15.1815 9.00005 16.1739Z" fill="#4285F4" />
      </svg>
    </div>
    <div className="deep-analysis-engine-icon">
      <svg width="12" height="12" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="0.5" y="0.5" width="5" height="5" rx="1" fill="#F25022" />
        <rect x="7.5" y="0.5" width="5" height="5" rx="1" fill="#7FBA00" />
        <rect x="0.5" y="7.5" width="5" height="5" rx="1" fill="#00A4EF" />
        <rect x="7.5" y="7.5" width="5" height="5" rx="1" fill="#FFB900" />
      </svg>
    </div>
    <div className="deep-analysis-engine-icon">
      <svg width="14" height="14" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14.1461 8.6792C13.1338 8.24322 12.2484 7.64599 11.4884 6.88676C10.7292 6.12753 10.1312 5.24138 9.696 4.22907C9.52952 3.84162 9.3944 3.44222 9.29138 3.03311C9.25778 2.89948 9.13834 2.80542 9.00023 2.80542C8.86211 2.80542 8.74267 2.89948 8.70907 3.03311C8.60605 3.44222 8.47167 3.84013 8.30445 4.22907C7.86847 5.24138 7.27124 6.12753 6.512 6.88676C5.75277 7.64525 4.86663 8.24322 3.85432 8.6792C3.46686 8.84568 3.06746 8.98081 2.65836 9.08383C2.52473 9.11742 2.43066 9.23687 2.43066 9.37498C2.43066 9.51309 2.52473 9.63254 2.65836 9.66613C3.06746 9.76915 3.46537 9.90353 3.85432 10.0708C4.86663 10.5067 5.75202 11.104 6.512 11.8632C7.27124 12.6224 7.86922 13.5086 8.30445 14.5209C8.47167 14.9091 8.60605 15.3077 8.70907 15.7168C8.72535 15.7818 8.76283 15.8394 8.81556 15.8807C8.8683 15.9219 8.93328 15.9444 9.00023 15.9445C9.13834 15.9445 9.25778 15.8505 9.29138 15.7168C9.3944 15.3077 9.52878 14.9098 9.696 14.5209C10.132 13.5086 10.7292 12.6232 11.4884 11.8632C12.2477 11.104 13.1338 10.506 14.1461 10.0708C14.5343 9.90353 14.933 9.76915 15.3421 9.66613C15.407 9.64985 15.4647 9.61238 15.5059 9.55964C15.5472 9.50691 15.5696 9.44193 15.5698 9.37498C15.5698 9.23687 15.4757 9.11742 15.3421 9.08383C14.933 8.98081 14.5351 8.84643 14.1461 8.6792Z" fill="#f29964" />
      </svg>
    </div>
    <div className="deep-analysis-engine-icon">
      <svg width="12" height="12" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="9" cy="9" r="6" stroke="#9f9fa9" strokeWidth="1.5" fill="none" />
        <path d="M14 14l4 4" stroke="#9f9fa9" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  </div>
);

const StepIcon = ({ status }: { status: StepStatus }) => {
  if (status === 'done') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="#f0fdf4" stroke="#1ab25e" strokeWidth="1.5" />
        <path d="M8 12.5l2.5 2.5 5.5-5.5" stroke="#1ab25e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (status === 'error') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="#fff1f2" stroke="#ff6f77" strokeWidth="1.5" />
        <path d="M9 9l6 6M15 9l-6 6" stroke="#ff6f77" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (status === 'running') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }} aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="#e4e4e7" strokeWidth="2" />
        <path d="M12 3a9 9 0 0 1 8.5 5.5" fill="none" stroke="#f29964" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="none" stroke="#d4d4d8" strokeWidth="2" />
    </svg>
  );
};

const StepRow = ({ step }: { step: StepState }) => (
  <div className={`deep-analysis-step deep-analysis-step--${step.status}`}>
    <div className="deep-analysis-step-icon">
      <StepIcon status={step.status} />
    </div>
    <span className="deep-analysis-step-label">{step.label}</span>
    {step.errorMessage && (
      <span className="deep-analysis-step-error">— {step.errorMessage}</span>
    )}
  </div>
);

const DeepAnalysisPage: NextPage = () => {
  const router = useRouter();
  const { url, keywords: kwParam, country, domainId: domainIdParam, flow: flowParam, language: languageParam } = router.query;
  const { data: domainsData } = useFetchDomains(router);
  const domains: DomainType[] = domainsData?.domains || [];

  const [steps, setSteps] = useState<StepState[]>(
    STEPS.map((s) => ({ key: s.key, label: s.label, status: 'pending' })),
  );
  const [articleId, setArticleId] = useState<number | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [overallError, setOverallError] = useState<string | null>(null);
  const [allDone, setAllDone] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [apiProgressPct, setApiProgressPct] = useState<number | null>(null);
  const startedRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const urlStr = (url as string || '').trim();
  const kwStr = (kwParam as string || '');
  const keywords = kwStr ? kwStr.split(',').filter(Boolean) : [];
  const flow = (flowParam as string) || 'new';
  const languageStr = (languageParam as string) || '';
  const domainIdStr = (domainIdParam as string || '').trim();
  const runSessionKey = useMemo(
    () => pageRunKey(flow, urlStr, kwStr, domainIdStr),
    [flow, urlStr, kwStr, domainIdStr],
  );
  const backHref = '/articles/new';
  const backLabel = 'Back to new content';

  useEffect(() => {
    if (!router.isReady || startedRef.current) return undefined;
    const isKeywordMode = !urlStr && keywords.length > 0 && !!domainIdStr;
    if (!urlStr && !isKeywordMode) {
      setOverallError('No URL or keyword provided.');
      return undefined;
    }

    const resumed = readPageRun(runSessionKey);
    if (resumed) {
      startedRef.current = true;
      setArticleId(resumed.articleId);
      setJobId(resumed.jobId);
      return undefined;
    }

    startedRef.current = true;

    (async () => {
      try {
        const res = await fetch('/api/articles/deep-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            isKeywordMode
              ? { keywords, country: country || 'PL', language: languageStr || undefined, domainId: Number(domainIdStr) }
              : { url: urlStr, keywords, country: country || 'PL', language: languageStr || undefined },
          ),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: 'Analysis failed' }));
          setOverallError(data.error || 'Analysis failed');
          startedRef.current = false;
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          setOverallError('Stream not available');
          startedRef.current = false;
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let currentEvent = '';

        function processLine(line: string) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            try {
              const data = JSON.parse(jsonStr);
              if (currentEvent === 'created') {
                if (data.articleId) setArticleId(data.articleId);
                if (data.articleId && data.jobId) {
                  setJobId(data.jobId);
                  writePageRun(runSessionKey, data.articleId, data.jobId);
                }
              } else if (currentEvent === 'error') {
                setSteps((prev) =>
                  prev.map((s) =>
                    s.key === data.step
                      ? { ...s, status: 'error', errorMessage: data.message }
                      : s,
                  ),
                );
                setOverallError(data.message || 'Analysis failed');
                clearPageRun(runSessionKey);
              } else if (currentEvent === 'done') {
                if (data.articleId) setArticleId(data.articleId);
                setSteps((prev) => prev.map((s) => ({ ...s, status: 'done' as StepStatus })));
                setAllDone(true);
                clearPageRun(runSessionKey);
              }
            } catch { /* skip parse errors from partial chunks */ }
            currentEvent = '';
          }
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (line.trim()) processLine(line);
          }
        }
        if (buffer.trim()) processLine(buffer.trim());
      } catch (err) {
        const e = err as { message?: string };
        setOverallError(e.message || 'Connection lost');
        startedRef.current = false;
      }
    })();

    return undefined;
  }, [router.isReady, url, kwParam, country, domainIdParam, languageParam, retryCount, urlStr, keywords, domainIdStr, runSessionKey]);

  useEffect(() => {
    if ((!jobId && !articleId) || allDone || overallError) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return undefined;
    }

    const poll = async () => {
      try {
        const query = jobId
          ? `jobId=${encodeURIComponent(jobId)}`
          : `articleId=${articleId}`;
        const res = await fetch(`/api/articles/job-progress?${query}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.jobId && !jobId) setJobId(data.jobId);

        if (data.status === 'failed') {
          setOverallError(data.progressMessage || 'Analysis failed');
          clearPageRun(runSessionKey);
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          return;
        }
        if (data.status === 'done') {
          setSteps((prev) => prev.map((s) => ({ ...s, status: 'done' as StepStatus })));
          setAllDone(true);
          clearPageRun(runSessionKey);
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          return;
        }

        if (typeof data.totalProgress === 'number') {
          setApiProgressPct(Math.max(0, Math.min(100, data.totalProgress)));
        }

        const stage = data.currentStage as string | undefined;
        if (stage) {
          setSteps((prev) => applyStageToSteps(stage, prev));
        }
      } catch { /* network errors are non-fatal for polling */ }
    };

    void poll();
    pollRef.current = setInterval(poll, 1000);
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [jobId, articleId, allDone, overallError, runSessionKey]);

  useEffect(() => {
    if (!allDone || !articleId) return undefined;
    const t = setTimeout(() => {
      router.replace(`/articles/content-type?articleId=${articleId}`);
    }, 600);
    return () => clearTimeout(t);
  }, [allDone, articleId, router]);

  const completedCount = steps.filter((s) => s.status === 'done').length;
  const progressPct = apiProgressPct ?? Math.round((completedCount / STEPS.length) * 100);

  const subtitle = useMemo(() => {
    if (allDone) return 'Analysis complete — opening your article…';
    if (overallError) return 'Something went wrong while analyzing your content.';
    return 'Fetching and analyzing content. This may take a moment.';
  }, [allDone, overallError]);

  const sourceLabel = useMemo(() => {
    if (urlStr) {
      return urlStr.length > 72 ? `${urlStr.slice(0, 72)}…` : urlStr;
    }
    if (keywords.length > 0) {
      return keywords.join(', ');
    }
    return null;
  }, [urlStr, keywords]);

  const handleRetry = () => {
    setOverallError(null);
    setJobId(null);
    setApiProgressPct(null);
    setSteps(STEPS.map((s) => ({ key: s.key, label: s.label, status: 'pending' })));
    clearPageRun(runSessionKey);
    startedRef.current = false;
    setRetryCount((c) => c + 1);
  };

  const statusBadge = overallError ? (
    <span className="deep-analysis-meta-badge deep-analysis-meta-badge--error">Failed</span>
  ) : allDone ? (
    <span className="deep-analysis-meta-badge deep-analysis-meta-badge--success">Complete</span>
  ) : (
    <span className="deep-analysis-meta-badge">{completedCount}/{STEPS.length} steps</span>
  );

  useEffect(() => {
    if (!router.isReady || flow !== 'import') return undefined;
    router.replace('/articles/import');
    return undefined;
  }, [router.isReady, flow, router]);

  return (
    <DashboardLayout domains={domains} showAddModal={() => {}} showSettings={() => {}}>
      <Head>
        <title>Deep Analysis — SerpBear</title>
      </Head>

      <SentryPage maxWidth={560} className="nc-wizard-page">
        <SentryPageHeader
          borderless
          title="Deep analysis"
          subtitle={subtitle}
          meta={statusBadge}
        />
        <WizardStepper current="research" />

        <div className="sentry-page-content">
          {sourceLabel && !overallError && (
            <div className="deep-analysis-source">
              <svg viewBox="0 0 20 20" width={16} height={16} fill="none" stroke="#9f9fa9" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                {urlStr ? (
                  <path d="M12.586 12.586a2 2 0 1 1 2.828 2.828l-2.828-2.828zM7.414 7.414a2 2 0 1 1-2.828-2.828l2.828 2.828zM16 2L2 16" />
                ) : (
                  <>
                    <circle cx="10" cy="10" r="6" />
                    <path d="M10 6v4l2.5 2.5" />
                  </>
                )}
              </svg>
              <span className="deep-analysis-source-text" title={sourceLabel}>{sourceLabel}</span>
            </div>
          )}

          <SentryPanel>
            <SentryPanelHeader title="Analysis engines" />
            <SentryPanelBody>
              <div className="deep-analysis-engines">
                <div className="deep-analysis-engine-row">
                  <p className="deep-analysis-engine-label">AI Search</p>
                  <SearchEngineIcons />
                </div>
                <div className="deep-analysis-engine-row">
                  <p className="deep-analysis-engine-label">Keyword analysis</p>
                  <SearchEngineIcons />
                </div>
              </div>
            </SentryPanelBody>
          </SentryPanel>

          <SentryPanel>
            <SentryPanelHeader
              title="Pipeline progress"
              actions={!overallError && !allDone ? (
                <span style={{ fontSize: 13, color: '#6a6772', fontFamily: 'var(--font-family-primary)' }}>
                  {progressPct}%
                </span>
              ) : undefined}
            />
            <SentryPanelBody>
              <div className="deep-analysis-steps">
                {steps.map((step) => (
                  <StepRow key={step.key} step={step} />
                ))}
              </div>
              {!overallError && !allDone && (
                <div className="deep-analysis-progress" aria-hidden="true">
                  <div className="deep-analysis-progress-fill" style={{ width: `${progressPct}%` }} />
                </div>
              )}
            </SentryPanelBody>
          </SentryPanel>

          {overallError && (
            <Alert variant="error" title="Analysis failed">
              {overallError}
              <div className="deep-analysis-actions">
                <Button variant="primary" size="sm" onClick={handleRetry}>
                  Try again
                </Button>
                {articleId && (
                  <Button variant="secondary" size="sm" onClick={() => router.push(`/articles/${articleId}`)}>
                    Open article
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={() => router.push(backHref)}>
                  {backLabel}
                </Button>
              </div>
            </Alert>
          )}

          {allDone && (
            <Alert variant="success" title="All steps completed">
              Redirecting to content setup…
            </Alert>
          )}
        </div>
      </SentryPage>
    </DashboardLayout>
  );
};

export default DeepAnalysisPage;
