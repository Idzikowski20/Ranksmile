import React, { useEffect, useState, useRef } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import DashboardLayout from '../../components/common/DashboardLayout';
import { useFetchDomains } from '../../services/domains';

// ── Must match the API handler ────────────────────────────────────────
const STEPS = [
  { key: 'fetch',     label: 'Fetching page content' },
  { key: 'metadata',  label: 'Extracting title and metadata' },
  { key: 'structure', label: 'Analyzing content structure' },
  { key: 'nlp',       label: 'Extracting keywords and NLP terms' },
  { key: 'serp',      label: 'Analyzing SERP competitors' },
  { key: 'score',     label: 'Computing content score' },
  { key: 'image',     label: 'Uploading featured image' },
  { key: 'save',      label: 'Saving article' },
] as const;

type StepStatus = 'pending' | 'running' | 'done' | 'error';

interface StepState {
  key: string;
  label: string;
  status: StepStatus;
  errorMessage?: string;
}

/* ── Overlapping search engine icons ────────────────────────────────── */
const SearchEngineIcons = () => (
  <div style={{ display: 'flex', flexDirection: 'row', gap: 0, marginLeft: 12 }}>
    {/* Google G */}
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 24, height: 24, borderRadius: '50%', border: '1px solid #e4e4e7',
        background: '#fff', marginRight: -6, padding: 3,
      }}
    >
      <svg width="14" height="14" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9.00005 16.1739C9.00005 15.1815 8.80875 14.2489 8.42614 13.3761C8.05548 12.5033 7.54734 11.744 6.90169 11.0984C6.25604 10.4527 5.49682 9.94457 4.62399 9.5739C3.75116 9.1913 2.81856 8.99999 1.82617 8.99999C2.81856 8.99999 3.75116 8.81466 4.62399 8.44402C5.49682 8.06142 6.25604 7.54727 6.90169 6.90162C7.54734 6.25598 8.05548 5.49673 8.42614 4.62392C8.80875 3.7511 9.00005 2.8185 9.00005 1.82611C9.00005 2.8185 9.18539 3.7511 9.55602 4.62392C9.93863 5.49673 10.4528 6.25598 11.0984 6.90162C11.7441 7.54727 12.5033 8.06142 13.3761 8.44402C14.2489 8.81466 15.1816 8.99999 16.1739 8.99999C15.1816 8.99999 14.2489 9.1913 13.3761 9.5739C12.5033 9.94457 11.7441 10.4527 11.0984 11.0984C10.4528 11.744 9.93863 12.5033 9.55602 13.3761C9.18539 14.2489 9.00005 15.1815 9.00005 16.1739Z" fill="#4285F4" />
      </svg>
    </div>
    {/* Bing */}
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 24, height: 24, borderRadius: '50%', border: '1px solid #e4e4e7',
        background: '#fff', marginRight: -6, padding: 3,
      }}
    >
      <svg width="12" height="12" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="0.5" y="0.5" width="5" height="5" rx="1" fill="#F25022" />
        <rect x="7.5" y="0.5" width="5" height="5" rx="1" fill="#7FBA00" />
        <rect x="0.5" y="7.5" width="5" height="5" rx="1" fill="#00A4EF" />
        <rect x="7.5" y="7.5" width="5" height="5" rx="1" fill="#FFB900" />
      </svg>
    </div>
    {/* Sparkle */}
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 24, height: 24, borderRadius: '50%', border: '1px solid #e4e4e7',
        background: '#fff', marginRight: -6, padding: 3,
      }}
    >
      <svg width="14" height="14" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14.1461 8.6792C13.1338 8.24322 12.2484 7.64599 11.4884 6.88676C10.7292 6.12753 10.1312 5.24138 9.696 4.22907C9.52952 3.84162 9.3944 3.44222 9.29138 3.03311C9.25778 2.89948 9.13834 2.80542 9.00023 2.80542C8.86211 2.80542 8.74267 2.89948 8.70907 3.03311C8.60605 3.44222 8.47167 3.84013 8.30445 4.22907C7.86847 5.24138 7.27124 6.12753 6.512 6.88676C5.75277 7.64525 4.86663 8.24322 3.85432 8.6792C3.46686 8.84568 3.06746 8.98081 2.65836 9.08383C2.52473 9.11742 2.43066 9.23687 2.43066 9.37498C2.43066 9.51309 2.52473 9.63254 2.65836 9.66613C3.06746 9.76915 3.46537 9.90353 3.85432 10.0708C4.86663 10.5067 5.75202 11.104 6.512 11.8632C7.27124 12.6224 7.86922 13.5086 8.30445 14.5209C8.47167 14.9091 8.60605 15.3077 8.70907 15.7168C8.72535 15.7818 8.76283 15.8394 8.81556 15.8807C8.8683 15.9219 8.93328 15.9444 9.00023 15.9445C9.13834 15.9445 9.25778 15.8505 9.29138 15.7168C9.3944 15.3077 9.52878 14.9098 9.696 14.5209C10.132 13.5086 10.7292 12.6232 11.4884 11.8632C12.2477 11.104 13.1338 10.506 14.1461 10.0708C14.5343 9.90353 14.933 9.76915 15.3421 9.66613C15.407 9.64985 15.4647 9.61238 15.5059 9.55964C15.5472 9.50691 15.5696 9.44193 15.5698 9.37498C15.5698 9.23687 15.4757 9.11742 15.3421 9.08383C14.933 8.98081 14.5351 8.84643 14.1461 8.6792Z" fill="#783afb" />
      </svg>
    </div>
    {/* Search */}
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 24, height: 24, borderRadius: '50%', border: '1px solid #e4e4e7',
        background: '#fff', marginRight: -6, padding: 3,
      }}
    >
      <svg width="12" height="12" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="9" cy="9" r="6" stroke="#9f9fa9" strokeWidth="1.5" fill="none" />
        <path d="M14 14l4 4" stroke="#9f9fa9" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  </div>
);

/* ── Step row ───────────────────────────────────────────────────────── */
const StepRow = ({ step }: { step: StepState }) => {
  const icon = () => {
    switch (step.status) {
      case 'done':
        return (
          <svg viewBox="0 0 20 20" width={18} height={18}>
            <circle cx="10" cy="10" r="9" fill="#f0fdf4" stroke="#16a34a" strokeWidth="1.5" />
            <path d="M6 10.5l2.5 2.5 5.5-5.5" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        );
      case 'error':
        return (
          <svg viewBox="0 0 20 20" width={18} height={18}>
            <circle cx="10" cy="10" r="9" fill="#fff1f2" stroke="#dc2626" strokeWidth="1.5" />
            <path d="M7 7l6 6M13 7l-6 6" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        );
      case 'running':
        return (
          <svg viewBox="0 0 20 20" width={18} height={18} style={{ animation: 'spin 0.8s linear infinite' }}>
            <circle cx="10" cy="10" r="8" fill="none" stroke="#e4e4e7" strokeWidth="2" />
            <path d="M10 2a8 8 0 0 1 7.5 5" fill="none" stroke="#783afb" strokeWidth="2" strokeLinecap="round" />
          </svg>
        );
      case 'pending':
      default:
        return (
          <svg viewBox="0 0 20 20" width={18} height={18}>
            <circle cx="10" cy="10" r="8" fill="none" stroke="#d4d4d8" strokeWidth="2" />
          </svg>
        );
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        opacity: step.status === 'pending' ? 0.45 : 1,
        transition: 'opacity 0.3s',
      }}
    >
      <div style={{ flexShrink: 0, width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon()}
      </div>
      <span
        style={{
          fontSize: 14,
          lineHeight: '20px',
          fontWeight: step.status === 'running' ? 600 : 400,
          color: step.status === 'error' ? '#dc2626' : step.status === 'running' ? '#09090b' : '#52525c',
          fontFamily: 'var(--font-family-primary)',
          transition: 'color 0.3s',
        }}
      >
        {step.label}
      </span>
      {step.errorMessage && (
        <span
          style={{
            fontSize: 12,
            color: '#dc2626',
            fontFamily: 'var(--font-family-primary)',
            marginLeft: 4,
          }}
        >
          — {step.errorMessage}
        </span>
      )}
    </div>
  );
};

/* ── Main page ──────────────────────────────────────────────────────── */
const DeepAnalysisPage: NextPage = () => {
  const router = useRouter();
  const { url, keywords: kwParam, country, device } = router.query;
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
  const startedRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastStageRef = useRef<string | null>(null);

  // ── Stage → step mapping for progress polling ────────────────────
  const STAGE_ORDER = ['fetch_page', 'scrape_serp', 'classify_content', 'extract_terms', 'score_ranking'] as const;
  const STAGE_TO_STEPS: Record<string, string[]> = {
    fetch_page: ['fetch', 'metadata', 'structure'],
    scrape_serp: ['serp'],
    classify_content: ['nlp'],
    extract_terms: ['nlp'],
    score_ranking: ['score'],
  };

  useEffect(() => {
    if (!router.isReady || startedRef.current) return;
    const urlStr = (url as string || '').trim();
    const kwStr = (kwParam as string || '');
    const keywords = kwStr ? kwStr.split(',').filter(Boolean) : [];

    if (!urlStr) {
      setOverallError('No URL provided.');
      return;
    }

    startedRef.current = true;
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch('/api/articles/deep-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: urlStr,
            keywords,
            country: country || 'US',
            device: device || 'Desktop',
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: 'Analysis failed' }));
          setOverallError(data.error || 'Analysis failed');
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          setOverallError('Stream not available');
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
                setArticleId(data.articleId);
                if (data.jobId) setJobId(data.jobId);
              } else if (currentEvent === 'progress') {
                setSteps((prev) =>
                  prev.map((s) =>
                    s.key === data.step ? { ...s, status: data.status as StepStatus } : s,
                  ),
                );
              } else if (currentEvent === 'error') {
                setSteps((prev) =>
                  prev.map((s) =>
                    s.key === data.step
                      ? { ...s, status: 'error', errorMessage: data.message }
                      : s,
                  ),
                );
                setOverallError(data.message || 'Analysis failed');
              } else if (currentEvent === 'done') {
                setArticleId(data.articleId);
                setSteps((prev) => prev.map((s) => ({ ...s, status: 'done' as StepStatus })));
                setAllDone(true);
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
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setOverallError(err.message || 'Connection lost');
        }
      }
    })();

    return () => {
      controller.abort();
      startedRef.current = false;
    };
  }, [router.isReady, url, kwParam, country, device, retryCount]);

  // ── Poll job progress for per-step status ────────────────────────
  useEffect(() => {
    if (!jobId || allDone || overallError) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }

    const poll = async () => {
      try {
        const res = await fetch(`/api/articles/job-progress?jobId=${encodeURIComponent(jobId)}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.status === 'failed') {
          setOverallError(data.progressMessage || 'Analysis failed');
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          return;
        }
        if (data.status === 'done') {
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          return;
        }

        const stage = data.currentStage as string | undefined;
        if (!stage || stage === lastStageRef.current) return;
        lastStageRef.current = stage;

        const stageIdx = STAGE_ORDER.indexOf(stage as any);
        if (stageIdx === -1) return;

        setSteps((prev) =>
          prev.map((s) => {
            for (let i = 0; i < stageIdx; i++) {
              const completedStepKeys = STAGE_TO_STEPS[STAGE_ORDER[i]] || [];
              if (completedStepKeys.includes(s.key) && s.status !== 'done') {
                return { ...s, status: 'done' as StepStatus };
              }
            }
            const currentStepKeys = STAGE_TO_STEPS[stage] || [];
            if (currentStepKeys.includes(s.key) && s.status !== 'done') {
              return { ...s, status: 'running' as StepStatus };
            }
            return s;
          }),
        );
      } catch { /* network errors are non-fatal for polling */ }
    };

    pollRef.current = setInterval(poll, 1000);
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [jobId, allDone, overallError]);

  // Redirect to editor once all done
  useEffect(() => {
    if (allDone && articleId) {
      const t = setTimeout(() => {
        router.replace(`/articles/${articleId}`);
      }, 600);
      return () => clearTimeout(t);
    }
  }, [allDone, articleId, router]);

  const completedCount = steps.filter((s) => s.status === 'done').length;

  return (
    <DashboardLayout domains={domains} showAddModal={() => {}} showSettings={() => {}}>
      <Head>
        <title>Deep Analysis — SerpBear</title>
      </Head>

      {/* Outer bg — matches import.tsx structure */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          background: '#f8f9ff',
        }}
      >
        <div
          style={{
            padding: 4,
            display: 'flex',
            flex: 1,
            overflow: 'hidden',
          }}
        >
          {/* White rounded card */}
          <div
            style={{
              border: '1px solid #E4E4E7',
              background: '#fff',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            {/* Scrollable content */}
            <div
              style={{
                padding: '48px 24px',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                overflow: 'auto',
                width: '100%',
              }}
              className="styled-scrollbar"
            >
              <div
                style={{
                  width: '100%',
                  maxWidth: 480,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 28,
                }}
              >
                {/* ── Title ────────────────────────────────────────── */}
                <h2
                  style={{
                    margin: 0,
                    fontSize: 17.5,
                    lineHeight: '24px',
                    fontWeight: 600,
                    color: '#09090b',
                    fontFamily: 'var(--font-family-primary)',
                  }}
                >
                  Deep analysis
                </h2>

                {/* ── AI Search row ─────────────────────────────────── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      fontSize: 15.4,
                      lineHeight: '21px',
                      fontWeight: 600,
                      color: '#09090b',
                      fontFamily: 'var(--font-family-primary)',
                    }}
                  >
                    AI Search
                  </span>
                  <SearchEngineIcons />
                </div>

                {/* ── Keyword Analysis row ─────────────────────────────────── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      fontSize: 15.4,
                      lineHeight: '21px',
                      fontWeight: 600,
                      color: '#09090b',
                      fontFamily: 'var(--font-family-primary)',
                    }}
                  >
                    Keyword Analysis
                  </span>
                  <SearchEngineIcons />
                </div>

                {/* ── Steps list ────────────────────────────────────── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {steps.map((step) => (
                    <StepRow key={step.key} step={step} />
                  ))}
                </div>

                {/* ── Progress bar ──────────────────────────────────── */}
                {!overallError && !allDone && (
                  <div style={{ width: '100%', height: 3, background: '#e4e4e7', borderRadius: 999, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        background: '#783afb',
                        borderRadius: 999,
                        transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                        width: `${Math.round((completedCount / STEPS.length) * 100)}%`,
                      }}
                    />
                  </div>
                )}

                {/* ── Status text ───────────────────────────────────── */}
                <p style={{ margin: 0, fontSize: 14, color: '#52525c', lineHeight: '20px', fontFamily: 'var(--font-family-primary)' }}>
                  {allDone
                    ? 'Analysis complete! Redirecting…'
                    : overallError
                      ? 'Analysis failed'
                      : 'Fetching and analyzing content. This may take a moment.'}
                </p>

                {/* ── URL chip ──────────────────────────────────────── */}
                {url && !overallError && (
                  <div
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: '#f8f8f9',
                      borderRadius: 8,
                      border: '1px solid #e4e4e7',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      overflow: 'hidden',
                    }}
                  >
                    <svg viewBox="0 0 20 20" width={16} height={16} fill="none" stroke="#9f9fa9" strokeWidth="1.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
                      <path d="M12.586 12.586a2 2 0 1 1 2.828 2.828l-2.828-2.828zM7.414 7.414a2 2 0 1 1-2.828-2.828l2.828 2.828z" />
                      <path d="M16 2L2 16" />
                    </svg>
                    <span
                      style={{
                        fontSize: 13,
                        color: '#52525c',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {(url as string).length > 70 ? (url as string).slice(0, 70) + '…' : url}
                    </span>
                  </div>
                )}

                {/* ── Error box ─────────────────────────────────────── */}
                {overallError && (
                  <div
                    style={{
                      width: '100%',
                      padding: '16px',
                      background: '#fff1f2',
                      border: '1px solid #fecaca',
                      borderRadius: 10,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <svg viewBox="0 0 20 20" width={18} height={18} fill="#dc2626" style={{ flexShrink: 0, marginTop: 1 }}>
                        <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0m-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5m0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2" clipRule="evenodd" />
                      </svg>
                      <span style={{ fontSize: 13, color: '#991b1b', lineHeight: '18px' }}>{overallError}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setOverallError(null);
                          setJobId(null);
                          setSteps(STEPS.map((s) => ({ key: s.key, label: s.label, status: 'pending' })));
                          startedRef.current = false;
                          setRetryCount((c) => c + 1);
                        }}
                        style={{
                          padding: '6px 16px',
                          borderRadius: 6,
                          border: 'none',
                          background: '#18181b',
                          color: '#fff',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontFamily: 'var(--font-family-primary)',
                        }}
                      >
                        Try again
                      </button>
                      {articleId && (
                        <button
                          type="button"
                          onClick={() => router.push(`/articles/${articleId}`)}
                          style={{
                            padding: '6px 16px',
                            borderRadius: 6,
                            border: '1px solid #e4e4e7',
                            background: '#fff',
                            color: '#52525c',
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontFamily: 'var(--font-family-primary)',
                          }}
                        >
                          Open article
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => router.push('/articles/import')}
                        style={{
                          padding: '6px 16px',
                          borderRadius: 6,
                          border: '1px solid #e4e4e7',
                          background: '#fff',
                          color: '#52525c',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontFamily: 'var(--font-family-primary)',
                        }}
                      >
                        Back to import
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Done state ────────────────────────────────────── */}
                {allDone && (
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 20px',
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderRadius: 999,
                      }}
                    >
                      <svg viewBox="0 0 20 20" width={16} height={16}>
                        <circle cx="10" cy="10" r="9" fill="#16a34a" />
                        <path d="M6 10.5l2.5 2.5 5.5-5.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#15803d' }}>
                        All steps completed
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DeepAnalysisPage;
