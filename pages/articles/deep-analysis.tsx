import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import { articleOutlineReviewHref } from '@/src/core/domain/articles/articleFlow';
import WizardShell, { WizardNextButton } from '../../components/articles/WizardShell';
import { Button } from '../../components/koala/core';
import { useAppBanner } from '../../components/koala/shell';
import { Icon } from '../../components/koala/icons';
import ProgressCard, { type ProgressState } from '../../components/articles/ProgressCard';

/** Transient failures dominate here; three tries five seconds apart, then stop. */
const AUTO_RETRY_MAX = 3;
const AUTO_RETRY_SECONDS = 5;

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

const STEP_STATE: Record<StepStatus, ProgressState> = {
  pending: 'pending',
  running: 'active',
  done: 'done',
  error: 'error',
};

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

const DeepAnalysisPage: NextPage = () => {
  const router = useRouter();
  const { url, keywords: kwParam, country, domainId: domainIdParam, flow: flowParam, language: languageParam, mode: modeParam } = router.query;

  const [steps, setSteps] = useState<StepState[]>(
    STEPS.map((s) => ({ key: s.key, label: s.label, status: 'pending' })),
  );
  const [articleId, setArticleId] = useState<number | null>(null);
  const [recoveryArticleId, setRecoveryArticleId] = useState<number | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [overallError, setOverallError] = useState<string | null>(null);
  const [allDone, setAllDone] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [autoAttempts, setAutoAttempts] = useState(0);
  const [retryIn, setRetryIn] = useState<number | null>(null);
  const startedRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryArticleIdRef = useRef<number | null>(null);
  const runGenerationRef = useRef(0);

  const urlStr = (url as string || '').trim();
  const kwStr = (kwParam as string || '');
  const keywords = kwStr ? kwStr.split(',').filter(Boolean) : [];
  const flow = (flowParam as string) || 'new';
  // Express skips the content-type / context / writing-mode steps and hands the article
  // straight to the editor's outline review, which is where generation runs.
  const express = modeParam === 'express';
  const nextHref = useCallback((id: number | string) => (express
    ? articleOutlineReviewHref(id, {
      contentType: 'article', internalLinks: true, externalLinks: true, express: true,
    })
    : `/articles/content-type?articleId=${id}`), [express]);
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
          const message = 'This analysis run is no longer available — its article may have been deleted.';
          // Mark the in-flight step too, exactly as the `failed` branch below does.
          // Stopping the poll alone left the step list spinning behind the banner, so the
          // page said both "gone" and "still working" at once.
          setSteps((prev) => markFailedStep(prev, undefined, undefined, message));
          setOverallError(message);
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
      router.replace(nextHref(articleId));
    }, 600);
    return () => clearTimeout(t);
  }, [allDone, articleId, router, nextHref]);

  const subtitle = useMemo(() => {
    if (allDone) return 'Analysis complete — opening your article…';
    if (overallError) return 'Something went wrong while analyzing your content.';
    return 'We are analyzing your content. You can continue while it runs in the background.';
  }, [allDone, overallError]);

  const canContinue = articleId !== null && jobId !== null && !overallError;
  const continueToContentType = () => {
    if (!articleId) return;
    router.push(nextHref(articleId));
  };

  const runRetry = () => {
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

  /** Clicking Try again is a fresh intent — it gets the full three automatic attempts. */
  const handleRetry = () => {
    setAutoAttempts(0);
    setRetryIn(null);
    runRetry();
  };

  /**
   * Most failures here are transient — the auth server blinking, a cold sidecar — and the
   * user's own fix was to press Try again once. So the page does it: three attempts, five
   * seconds apart, then it stops and leaves the decision to them.
   *
   * The countdown lives here rather than in the banner because `useAppBanner` round-trips
   * its state through JSON, which no timer or callback survives.
   */
  useEffect(() => {
    if (!overallError || autoAttempts >= AUTO_RETRY_MAX) return undefined;
    if (retryIn === null) {
      setRetryIn(AUTO_RETRY_SECONDS);
      return undefined;
    }
    if (retryIn <= 0) {
      setAutoAttempts((n) => n + 1);
      setRetryIn(null);
      runRetry();
      return undefined;
    }
    const t = setTimeout(() => setRetryIn((s) => (s ?? 1) - 1), 1000);
    return () => clearTimeout(t);
    // runRetry is recreated every render; including it would restart the countdown on
    // each tick and the timer would never reach zero.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overallError, autoAttempts, retryIn]);

  const retriesLeft = AUTO_RETRY_MAX - autoAttempts;
  useAppBanner(overallError
    ? {
      variant: 'error',
      message: retryIn !== null && retriesLeft > 0
        ? `${overallError} — retrying in ${retryIn}s (attempt ${autoAttempts + 1} of ${AUTO_RETRY_MAX})`
        : `${overallError} — failed after ${AUTO_RETRY_MAX} attempts.`,
      busy: retryIn !== null && retriesLeft > 0,
      // Stable across the countdown ticks, fresh for each run. Keyed on the message it
      // would rotate every second; keyed on the error alone, dismissing once suppressed
      // the banner for every later run that failed the same way, and AppBanner never
      // clears its dismissed key while the page stays mounted.
      dismissKey: `deep-analysis:${runGenerationRef.current}:${overallError}`,
      dismissible: true,
    }
    : null);

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
          label={express ? 'Open editor' : 'Content type'}
          disabled={!canContinue}
          onClick={continueToContentType}
        />
      )}
    >
      <div>
        <h2 className="koala-wizard-title">Deep analysis</h2>
        <p className="koala-wizard-subtitle">{subtitle}</p>
      </div>

      <div aria-label="Deep analysis progress" aria-live="polite">
        <ProgressCard
          rows={steps.map((step) => ({
            id: step.key,
            label: step.label,
            detail: step.errorMessage,
            state: STEP_STATE[step.status],
          }))}
        />
      </div>

      {/* The message itself is the banner above the topbar; only the choices stay here.
          They stay available during the countdown too — someone who does not want to wait
          out three attempts should be able to retry, open the article or leave now. */}
      {overallError && (
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
      )}
    </WizardShell>
  );
};

export default DeepAnalysisPage;
