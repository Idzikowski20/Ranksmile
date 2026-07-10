export type StepVisualStatus = 'pending' | 'running' | 'done';

export interface DeepAnalysisUiStep {
  key: string;
  label: string;
  status: StepVisualStatus;
  /** Shown under the crawling step (domain + title snippet). */
  detail?: string;
}

export interface DeepAnalysisUiState {
  aiSearch: DeepAnalysisUiStep[];
  googleSearch: DeepAnalysisUiStep[];
  error: string | null;
  isComplete: boolean;
}

export interface JobProgressSnapshot {
  status: string;
  currentStage?: string | null;
  stageProgress?: number | null;
  progressMessage?: string | null;
  updatedAt?: string | null;
}

/** Jobs stuck in running/queued with no sidecar heartbeat are orphaned (refresh, sidecar reload, dropped SSE). */
const STALE_RUNNING_MS = 90_000;
const STALE_QUEUED_MS = 45_000;
const STALE_NO_STAGE_MS = 45_000;
const STALE_STARTING_MS = 300_000;

export function isStaleDeepAnalysisJob(snap: JobProgressSnapshot): boolean {
  if (snap.status !== 'running' && snap.status !== 'queued') return false;
  const updatedMs = snap.updatedAt ? new Date(snap.updatedAt).getTime() : 0;
  const age = updatedMs > 0 ? Date.now() - updatedMs : 0;
  const msg = snap.progressMessage || '';
  // Claimed locally but sidecar never picked up the job.
  if (snap.status === 'running' && msg === 'Starting analysis...' && age > STALE_STARTING_MS) return true;
  if (snap.status === 'queued' && updatedMs > 0 && age > STALE_QUEUED_MS) return true;
  if (snap.status === 'running' && !snap.currentStage && updatedMs > 0 && age > STALE_NO_STAGE_MS) return true;
  if (snap.status === 'running' && updatedMs > 0 && age > STALE_RUNNING_MS) return true;
  return false;
}

const AI_STEPS = [
  { key: 'ai_prompts', label: 'Generated prompts', running: 'Generating prompts...' },
  { key: 'ai_scrape', label: 'Scraped answers from ChatGPT, AI Overviews, Gemini, AI Mode, Perplexity', running: 'Scraping answers from ChatGPT, AI Overviews, Gemini, AI Mode, Perplexity...' },
  { key: 'ai_guidelines', label: 'Calculated AI Search guidelines', running: 'Calculating AI Search guidelines...' },
] as const;

const GOOGLE_STEPS = [
  { key: 'serp_results', label: 'Got search results', running: 'Getting search results...' },
  { key: 'serp_crawl', label: 'Crawled results', running: 'Crawling' },
  { key: 'serp_scores', label: 'Calculated Content Scores and SEO guidelines', running: 'Calculating Content Scores and SEO guidelines...' },
] as const;

function step(
  defs: readonly { key: string; label: string; running: string }[],
  statuses: Record<string, StepVisualStatus>,
  runningLabels?: Record<string, string>,
): DeepAnalysisUiStep[] {
  return defs.map((d) => {
    const status = statuses[d.key] || 'pending';
    const label = status === 'running' ? (runningLabels?.[d.key] || d.running) : d.label;
    return { key: d.key, label, status };
  });
}

function parseSerpCount(message: string): number | null {
  const m = message.match(/Found (\d+) competitors/i) || message.match(/Got (\d+) search results/i);
  return m ? Number(m[1]) : null;
}

function parseCrawlDetail(message: string): string | undefined {
  const crawl = message.match(/crawl(?:ing)?\s+(?:result\s+)?(\d+)\/(\d+)/i);
  if (crawl) return message;
  if (message.includes('http') || /\.[a-z]{2,}/i.test(message)) {
    const trimmed = message.length > 72 ? `${message.slice(0, 72)}…` : message;
    return trimmed;
  }
  return undefined;
}

/** Map sidecar job-progress fields to Surfer-style sidebar steps. */
export function deriveDeepAnalysisUi(job: JobProgressSnapshot): DeepAnalysisUiState {
  const stage = job.currentStage || '';
  const msg = job.progressMessage || '';
  const terminal = job.status === 'done' || job.status === 'failed';

  if (job.status === 'failed') {
    return {
      aiSearch: step(AI_STEPS, {}),
      googleSearch: step(GOOGLE_STEPS, {}),
      error: msg || 'Analysis failed',
      isComplete: false,
    };
  }

  if (job.status === 'done') {
    const allDone: Record<string, StepVisualStatus> = {};
    for (const s of [...AI_STEPS, ...GOOGLE_STEPS]) allDone[s.key] = 'done';
    const serpCount = parseSerpCount(msg);
    return {
      aiSearch: step(AI_STEPS, allDone),
      googleSearch: step(
        GOOGLE_STEPS,
        allDone,
        serpCount != null ? { serp_results: `Got ${serpCount} search results` } : undefined,
      ),
      error: null,
      isComplete: true,
    };
  }

  const google: Record<string, StepVisualStatus> = {
    serp_results: 'pending',
    serp_crawl: 'pending',
    serp_scores: 'pending',
  };
  const ai: Record<string, StepVisualStatus> = {
    ai_prompts: 'pending',
    ai_scrape: 'pending',
    ai_guidelines: 'pending',
  };
  const runningLabels: Record<string, string> = {};
  let crawlDetail: string | undefined;

  const googleStages = new Set(['fetch_page', 'scrape_serp', 'classify_content', 'extract_terms', 'score_ranking']);
  const serpCount = parseSerpCount(msg);

  if (!stage || stage === 'fetch_page' || stage === 'finalizing') {
    google.serp_results = 'running';
    if (stage === 'finalizing') {
      runningLabels.serp_results = msg || 'Saving analysis results...';
    }
  } else if (stage === 'scrape_serp') {
    google.serp_results = serpCount != null ? 'done' : 'running';
    if (serpCount != null) {
      runningLabels.serp_results = `Got ${serpCount} search results`;
    }
    const crawlDetailFromMsg = parseCrawlDetail(msg);
    if (crawlDetailFromMsg || /scraping serp/i.test(msg)) {
      google.serp_crawl = 'running';
      crawlDetail = crawlDetailFromMsg;
      if (serpCount != null) google.serp_results = 'done';
    } else if (serpCount != null) {
      google.serp_crawl = 'done';
      runningLabels.serp_crawl = `Crawled ${serpCount} results`;
    }
  } else if (googleStages.has(stage)) {
    google.serp_results = 'done';
    google.serp_crawl = 'done';
    if (serpCount != null) {
      runningLabels.serp_results = `Got ${serpCount} search results`;
      runningLabels.serp_crawl = `Crawled ${serpCount} results`;
    }
    google.serp_scores = 'running';
  }

  if (stage === 'ai_search') {
    google.serp_results = 'done';
    google.serp_crawl = 'done';
    google.serp_scores = 'done';
    if (serpCount != null) {
      runningLabels.serp_results = `Got ${serpCount} search results`;
      runningLabels.serp_crawl = `Crawled ${serpCount} results`;
    }
    ai.ai_prompts = 'done';
    if (/guideline/i.test(msg) || (job.stageProgress ?? 0) >= 85) {
      ai.ai_scrape = 'done';
      ai.ai_guidelines = 'running';
    } else {
      ai.ai_scrape = 'running';
      ai.ai_guidelines = 'pending';
    }
  }

  const googleSteps = step(GOOGLE_STEPS, google, runningLabels);
  if (crawlDetail) {
    const crawlIdx = googleSteps.findIndex((s) => s.key === 'serp_crawl');
    if (crawlIdx >= 0) googleSteps[crawlIdx] = { ...googleSteps[crawlIdx], detail: crawlDetail };
  }

  return {
    aiSearch: step(AI_STEPS, ai),
    googleSearch: googleSteps,
    error: null,
    isComplete: terminal && job.status === 'done',
  };
}

export const ANALYZE_SESSION_PREFIX = 'serpbear-analyze:';

export interface AnalyzeSessionPayload {
  url: string;
  keywords: string[];
  country: string;
}

export function readAnalyzeSession(articleId: number): AnalyzeSessionPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(`${ANALYZE_SESSION_PREFIX}${articleId}`);
    if (!raw) return null;
    return JSON.parse(raw) as AnalyzeSessionPayload;
  } catch {
    return null;
  }
}

export function writeAnalyzeSession(articleId: number, payload: AnalyzeSessionPayload) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(`${ANALYZE_SESSION_PREFIX}${articleId}`, JSON.stringify(payload));
}

export function clearAnalyzeSession(articleId: number) {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(`${ANALYZE_SESSION_PREFIX}${articleId}`);
}
