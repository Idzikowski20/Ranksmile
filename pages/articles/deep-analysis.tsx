import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import WizardShell, { WizardNextButton } from '../../components/articles/WizardShell';
import { Alert, Button } from '../../components/koala/core';
import { Icon } from '../../components/koala/icons';
import { Spinner } from '../../components/koala/primitives';

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

interface AnalysisProgressPayload {
  articleId?: number;
  jobId?: string;
  step?: string;
  currentStage?: string;
  message?: string;
  status?: string;
  progressMessage?: string;
  error?: string | null;
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

const PAGE_RUN_PREFIX = 'ranksmile-deep-analysis-page:';

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

function markFailedStep(
  prev: StepState[],
  step: string | undefined,
  currentStage: string | undefined,
  message: string,
): StepState[] {
  const direct = step && prev.find((item) => item.key === step);
  const mappedKeys = direct
    ? []
    : [currentStage, step].flatMap((stage) => (stage ? STAGE_TO_STEPS[stage] || [] : []));
  const mapped = prev.find((item) => mappedKeys.includes(item.key) && item.status === 'running')
    || prev.find((item) => mappedKeys.includes(item.key) && item.status !== 'done');
  const failed = direct
    || mapped
    || prev.find((item) => item.status === 'running')
    || prev.find((item) => item.status === 'pending');
  if (!failed) return prev;
  return prev.map((item) => (
    item.key === failed.key ? { ...item, status: 'error', errorMessage: message } : item
  ));
}

const StepIcon = ({ status }: { status: StepStatus }) => {
  if (status === 'done') {
    return (
      <Icon
        name="CheckCircle"
        size={20}
        weight="fill"
        color="color-mix(in srgb, var(--koala-status-success) 50%, var(--koala-text-primary))"
        className="deep-analysis-step-icon__done"
      />
    );
  }
  if (status === 'error') {
    return (
      <Icon
        name="XCircle"
        size={20}
        weight="fill"
        color="color-mix(in srgb, var(--koala-status-danger) 50%, var(--koala-text-primary))"
        className="deep-analysis-step-icon__error"
      />
    );
  }
  if (status === 'running') {
    return <Spinner size={18} label="Running" />;
  }
  return (
    <Icon
      name="Circle"
      size={18}
      weight="bold"
      color="var(--koala-text-secondary)"
      className="deep-analysis-step-icon__pending"
    />
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

  const [steps, setSteps] = useState<StepState[]>(
    STEPS.map((s) => ({ key: s.key, label: s.label, status: 'pending' })),
  );
  const [articleId, setArticleId] = useState<number | null>(null);
  const [recoveryArticleId, setRecoveryArticleId] = useState<number | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [overallError, setOverallError] = useState<string | null>(null);
  const [allDone, setAllDone] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const startedRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryArticleIdRef = useRef<number | null>(null);
  const runGenerationRef = useRef(0);

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
    const runGeneration = runGenerationRef.current;
    const retryArticleId = retryArticleIdRef.current;

    (async () => {
      try {
        const res = await fetch('/api/articles/deep-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            isKeywordMode
              ? {
                keywords,
                country: country || 'PL',
                language: languageStr || undefined,
                domainId: Number(domainIdStr),
                ...(retryArticleId ? { articleId: retryArticleId } : {}),
              }
              : {
                url: urlStr,
                keywords,
                country: country || 'PL',
                language: languageStr || undefined,
                ...(retryArticleId ? { articleId: retryArticleId } : {}),
              },
          ),
        });
        if (runGeneration !== runGenerationRef.current) return;

        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: 'Analysis failed' }));
          if (runGeneration !== runGenerationRef.current) return;
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
          if (runGeneration !== runGenerationRef.current) return;
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            try {
              const data = JSON.parse(jsonStr) as AnalysisProgressPayload;
              if (currentEvent === 'created') {
                if (data.articleId) setArticleId(data.articleId);
                if (data.articleId && data.jobId) {
                  setJobId(data.jobId);
                  writePageRun(runSessionKey, data.articleId, data.jobId);
                  retryArticleIdRef.current = null;
                  setRecoveryArticleId(null);
                }
              } else if (currentEvent === 'error') {
                const message = data.message || 'Analysis failed';
                setSteps((prev) => markFailedStep(prev, data.step, data.currentStage, message));
                setOverallError(message);
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
          if (runGeneration !== runGenerationRef.current) return;
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
        if (runGeneration !== runGenerationRef.current) return;
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

    const runGeneration = runGenerationRef.current;
    const poll = async () => {
      try {
        if (runGeneration !== runGenerationRef.current) return;
        const query = jobId
          ? `jobId=${encodeURIComponent(jobId)}`
          : `articleId=${articleId}`;
        const res = await fetch(`/api/articles/job-progress?${query}`);
        if (runGeneration !== runGenerationRef.current) return;
        // The run this page is polling no longer exists — its article was deleted, or the
        // session lost access to it. Swallowing that with every other non-OK response left
        // the page polling a dead job forever: no step ever moved, no error was shown, and
        // the session pointer kept every reload resuming the same missing run.
        if (res.status === 404 || res.status === 403) {
          setOverallError('This analysis run is no longer available — its article may have been deleted.');
          clearPageRun(runSessionKey);
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          return;
        }
        if (!res.ok) return;
        const data = await res.json() as AnalysisProgressPayload;
        if (runGeneration !== runGenerationRef.current) return;

        if (data.jobId && !jobId) {
          setJobId(data.jobId);
          if (articleId) writePageRun(runSessionKey, articleId, data.jobId);
        }

        if (data.status === 'failed') {
          const message = data.error || data.progressMessage || data.message || 'Analysis failed';
          setSteps((prev) => markFailedStep(prev, data.step, data.currentStage, message));
          setOverallError(message);
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

  const subtitle = useMemo(() => {
    if (allDone) return 'Analysis complete — opening your article…';
    if (overallError) return 'Something went wrong while analyzing your content.';
    return 'We are analyzing your content. You can continue while it runs in the background.';
  }, [allDone, overallError]);

  const canContinue = articleId !== null && jobId !== null && !overallError;
  const continueToContentType = () => {
    if (!articleId) return;
    router.push(`/articles/content-type?articleId=${articleId}`);
  };

  const handleRetry = () => {
    runGenerationRef.current += 1;
    const retryArticleId = articleId ?? retryArticleIdRef.current;
    retryArticleIdRef.current = retryArticleId;
    setRecoveryArticleId(retryArticleId);
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setOverallError(null);
    setArticleId(null);
    setJobId(null);
    setAllDone(false);
    setSteps(STEPS.map((s) => ({ key: s.key, label: s.label, status: 'pending' })));
    clearPageRun(runSessionKey);
    startedRef.current = false;
    setRetryCount((c) => c + 1);
  };

  const recoveryTargetArticleId = articleId ?? recoveryArticleId;

  useEffect(() => {
    if (!router.isReady || flow !== 'import') return undefined;
    router.replace('/articles/import');
    return undefined;
  }, [router.isReady, flow, router]);

  return (
    <WizardShell
      title="Deep analysis"
      footer={(
        <WizardNextButton
          label="Content type"
          disabled={!canContinue}
          onClick={continueToContentType}
        />
      )}
    >
      <div>
        <h2 className="koala-wizard-title">Deep analysis</h2>
        <p className="koala-wizard-subtitle">{subtitle}</p>
      </div>

      <div className="deep-analysis-steps" aria-label="Deep analysis progress" aria-live="polite">
        {steps.map((step) => (
          <StepRow key={step.key} step={step} />
        ))}
      </div>

      {overallError && (
        <Alert variant="error" title="Analysis failed">
          {overallError}
          <div className="deep-analysis-actions">
            <Button variant="primary" size="sm" onClick={handleRetry}>
              Try again
            </Button>
            {recoveryTargetArticleId && (
              <Button variant="secondary" size="sm" onClick={() => router.push(`/articles/${recoveryTargetArticleId}`)}>
                Open article
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => router.push(backHref)}>
              {backLabel}
            </Button>
          </div>
        </Alert>
      )}
    </WizardShell>
  );
};

export default DeepAnalysisPage;
