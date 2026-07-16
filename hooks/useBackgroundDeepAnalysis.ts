import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearAnalyzeSession,
  deriveDeepAnalysisUi,
  isStaleDeepAnalysisJob,
  readAnalyzeSession,
  type DeepAnalysisUiState,
  type JobProgressSnapshot,
} from '../lib/deepAnalysisProgress';

interface Options {
  articleId: number | null;
  articleStatus?: string | null;
  metaUrl?: string | null;
  targetKeyword?: string | null;
  enabled: boolean;
  onComplete: () => void;
  onError?: (message: string) => void;
}

type RunCtx = { url: string; keywords: string[]; country: string };

type PollOutcome =
  | { kind: 'ok'; snapshot: JobProgressSnapshot }
  | { kind: 'not_found' }
  | { kind: 'auth_error' }
  | { kind: 'error' };

const MIN_RESTART_MS = 60_000;

/** One in-flight deep-analysis POST per article — prevents strict-mode / multi-hook duplicates. */
const deepAnalysisInflight = new Set<number>();

/** job IDs are `job_{articleId}_{timestamp}` — reject foreign jobs after a misrouted stream. */
export function jobArticleId(jobId: string): number | null {
  const m = /^job_(\d+)_/.exec(jobId);
  return m ? Number(m[1]) : null;
}

async function fetchLatestJob(articleId: number): Promise<{ jobId: string; snapshot: JobProgressSnapshot } | PollOutcome> {
  const res = await fetch(`/api/articles/job-progress?articleId=${articleId}`);
  if (res.status === 401) return { kind: 'auth_error' };
  if (res.status === 404) return { kind: 'not_found' };
  if (!res.ok) return { kind: 'error' };
  const data = await res.json();
  if (!data.jobId) return { kind: 'not_found' };
  return {
    jobId: data.jobId as string,
    snapshot: {
      status: data.status,
      currentStage: data.currentStage,
      stageProgress: data.stageProgress,
      progressMessage: data.progressMessage,
      updatedAt: data.updatedAt ?? null,
    },
  };
}

async function pollJob(jobId: string): Promise<PollOutcome> {
  const res = await fetch(`/api/articles/job-progress?jobId=${encodeURIComponent(jobId)}`);
  if (res.status === 401) return { kind: 'auth_error' };
  if (res.status === 404) return { kind: 'not_found' };
  if (!res.ok) return { kind: 'error' };
  const data = await res.json();
  return {
    kind: 'ok',
    snapshot: {
      status: data.status,
      currentStage: data.currentStage,
      stageProgress: data.stageProgress,
      progressMessage: data.progressMessage,
      updatedAt: data.updatedAt ?? null,
    },
  };
}

export function useBackgroundDeepAnalysis({
  articleId,
  articleStatus,
  metaUrl,
  targetKeyword,
  enabled,
  onComplete,
  onError,
}: Options) {
  const [ui, setUi] = useState<DeepAnalysisUiState | null>(null);
  const [isActive, setIsActive] = useState(false);
  const runGenRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restartCtxRef = useRef<RunCtx | null>(null);
  const streamInFlightRef = useRef(false);
  const lastRestartAtRef = useRef(0);
  const completedRef = useRef(false);
  const authFailedRef = useRef(false);
  const articleIdRef = useRef(articleId);
  articleIdRef.current = articleId;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const failAuth = useCallback((message = 'Session expired — sign in again') => {
    if (authFailedRef.current) return;
    authFailedRef.current = true;
    stopPolling();
    streamInFlightRef.current = false;
    setIsActive(false);
    setUi(deriveDeepAnalysisUi({ status: 'failed', progressMessage: message }));
    onErrorRef.current?.(message);
  }, [stopPolling]);

  const finishOnce = useCallback((aid: number | null) => {
    if (completedRef.current) return;
    completedRef.current = true;
    stopPolling();
    streamInFlightRef.current = false;
    setIsActive(false);
    if (aid) clearAnalyzeSession(aid);
    onCompleteRef.current();
  }, [stopPolling]);

  const beginPollingRef = useRef<(jobId: string, restartCtx?: RunCtx) => void>(() => {});

  const startAnalysisStreamRef = useRef(async (_id: number, _body: RunCtx) => {});

  beginPollingRef.current = (jobId: string, restartCtx?: RunCtx) => {
    const aid = articleIdRef.current;
    const jobAid = jobArticleId(jobId);
    if (aid && jobAid !== null && jobAid !== aid) {
      console.warn('[deep-analysis] ignoring foreign job', jobId, 'for article', aid);
      return;
    }

    if (restartCtx) restartCtxRef.current = restartCtx;
    setIsActive(true);
    stopPolling();

    const tick = async () => {
      if (authFailedRef.current) return;

      const outcome = await pollJob(jobId);
      if (outcome.kind === 'auth_error') {
        failAuth();
        return;
      }
      if (outcome.kind !== 'ok') return;

      const snap = outcome.snapshot;
      const currentAid = articleIdRef.current;

      if (isStaleDeepAnalysisJob(snap) && restartCtxRef.current && currentAid && !streamInFlightRef.current) {
        const sinceRestart = Date.now() - lastRestartAtRef.current;
        if (sinceRestart < MIN_RESTART_MS) return;

        console.warn('[deep-analysis] job stalled — restarting pipeline', jobId);
        lastRestartAtRef.current = Date.now();
        deepAnalysisInflight.delete(currentAid);
        stopPolling();
        try {
          await startAnalysisStreamRef.current(currentAid, restartCtxRef.current);
        } catch (err) {
          if (authFailedRef.current) return;
          const message = err instanceof Error ? err.message : 'Analysis failed';
          setUi(deriveDeepAnalysisUi({ status: 'failed', progressMessage: message }));
          setIsActive(false);
          streamInFlightRef.current = false;
          onErrorRef.current?.(message);
        }
        return;
      }

      setUi(deriveDeepAnalysisUi(snap));
      if (snap.status === 'failed') {
        stopPolling();
        setIsActive(false);
        streamInFlightRef.current = false;
        onErrorRef.current?.(deriveDeepAnalysisUi(snap).error || 'Analysis failed');
        return;
      }
      if (snap.status === 'done') {
        finishOnce(currentAid);
      }
    };

    void tick();
    pollRef.current = setInterval(tick, 2000);
  };

  startAnalysisStreamRef.current = async (id: number, body: RunCtx) => {
    if (authFailedRef.current) return;
    if (streamInFlightRef.current || deepAnalysisInflight.has(id)) return;

    streamInFlightRef.current = true;
    deepAnalysisInflight.add(id);
    try {
      const res = await fetch('/api/articles/deep-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(body.url ? { url: body.url } : {}),
          keywords: body.keywords,
          country: body.country,
          articleId: id,
        }),
      });

      if (res.status === 401) {
        failAuth();
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Analysis failed' }));
        throw new Error(data.error || 'Analysis failed');
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('Stream not available');

      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = '';
      let streamJobId: string | null = null;

      const processLine = (line: string) => {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (currentEvent === 'created' && data.jobId) {
              const jobAid = jobArticleId(data.jobId);
              if (jobAid !== null && jobAid !== id) {
                console.warn('[deep-analysis] stream created foreign job', data.jobId, 'expected article', id);
                return;
              }
              streamJobId = data.jobId;
              beginPollingRef.current(data.jobId, body);
            } else if (currentEvent === 'error') {
              throw new Error(data.message || 'Analysis failed');
            } else if (currentEvent === 'done') {
              if (streamJobId) {
                setUi(deriveDeepAnalysisUi({ status: 'done' }));
                finishOnce(id);
              }
            }
          } catch (e) {
            if (e instanceof Error && currentEvent === 'error') throw e;
          }
          currentEvent = '';
        }
      };

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
    } finally {
      streamInFlightRef.current = false;
      deepAnalysisInflight.delete(id);
    }
  };

  useEffect(() => {
    if (!enabled || !articleId || articleStatus !== 'analyzing') return undefined;

    const runGen = ++runGenRef.current;
    completedRef.current = false;
    authFailedRef.current = false;
    let cancelled = false;

    (async () => {
      try {
        setIsActive(true);
        setUi(deriveDeepAnalysisUi({ status: 'running', currentStage: 'fetch_page', progressMessage: 'Starting analysis...' }));

        const existingResult = await fetchLatestJob(articleId);
        if (cancelled || runGen !== runGenRef.current) return;

        if ('kind' in existingResult) {
          if (existingResult.kind === 'auth_error') {
            failAuth();
            return;
          }
        }

        const session = readAnalyzeSession(articleId);
        const url = session?.url || metaUrl || '';
        const keywords = session?.keywords?.length
          ? session.keywords
          : (targetKeyword ? [targetKeyword] : []);
        const country = session?.country || 'PL';
        const runCtx: RunCtx = { url, keywords, country };

        if (!url && !keywords.length) {
          setIsActive(false);
          return;
        }

        const existing = 'jobId' in existingResult ? existingResult : null;

        if (existing && (existing.snapshot.status === 'running' || existing.snapshot.status === 'queued')) {
          const jobAid = jobArticleId(existing.jobId);
          if (jobAid === articleId && !isStaleDeepAnalysisJob(existing.snapshot)) {
            setUi(deriveDeepAnalysisUi(existing.snapshot));
            beginPollingRef.current(existing.jobId, runCtx);
            return;
          }
          if (jobAid === articleId) {
            console.warn('[deep-analysis] stale job detected — restarting pipeline', existing.jobId);
          }
        }

        if (existing?.snapshot.status === 'done' && jobArticleId(existing.jobId) === articleId) {
          setUi(deriveDeepAnalysisUi({ status: 'done' }));
          finishOnce(articleId);
          return;
        }

        await startAnalysisStreamRef.current(articleId, runCtx);
      } catch (err) {
        if (cancelled || runGen !== runGenRef.current || authFailedRef.current) return;
        const message = err instanceof Error ? err.message : 'Analysis failed';
        setUi(deriveDeepAnalysisUi({ status: 'failed', progressMessage: message }));
        setIsActive(false);
        streamInFlightRef.current = false;
        onErrorRef.current?.(message);
      }
    })();

    return () => {
      cancelled = true;
      stopPolling();
      streamInFlightRef.current = false;
    };
  }, [articleId, articleStatus, enabled, failAuth, finishOnce, metaUrl, stopPolling, targetKeyword]);

  const analysisFailed = Boolean(ui?.error);
  return {
    ui,
    isActive,
    // Don't keep the editor locked after a failed run — article.status may still be 'analyzing' until refetch.
    isAnalyzing: isActive || (articleStatus === 'analyzing' && !analysisFailed),
  };
}
