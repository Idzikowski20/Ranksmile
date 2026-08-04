/**
 * WIE Performance Loop — Outcome Learning.
 * Post-publish metrics → pattern effectiveness (not article memory).
 */
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { recordPatternOutcome, readPatternStore } from './patternStore';

export type OutcomeMetrics = {
  clicks?: number;
  impressions?: number;
  /** 0–1 preferred; values >1 treated as percent */
  ctr?: number;
  position?: number;
  avgTimeSec?: number;
  /** 0–1 */
  bounceRate?: number;
  conversions?: number;
  windowDays?: number;
};

export type WieLastRun = {
  at: string;
  runId?: string;
  patternIds: string[];
  dna_version?: number;
};

export type OutcomeRecord = {
  articleId: number;
  at: string;
  metrics: OutcomeMetrics;
  patternIds: string[];
  successScore: number;
  success: boolean;
};

const RUNS_FILE = path.join(process.cwd(), 'data', 'wie-article-runs.json');
const OUTCOMES_FILE = path.join(process.cwd(), 'data', 'wie-outcomes.json');

type RunsFile = Record<string, WieLastRun>;
type OutcomesFile = { records: OutcomeRecord[] };

function normCtr(ctr: number | undefined): number | undefined {
  if (ctr == null || !Number.isFinite(ctr)) return undefined;
  return ctr > 1 ? ctr / 100 : ctr;
}

/**
 * Map metrics → success score 0–1.
 * Designed for GSC-style + optional engagement/conversion fields.
 */
export function computeOutcomeSuccessScore(m: OutcomeMetrics): number {
  let score = 0.45;
  const ctr = normCtr(m.ctr);
  const impressions = m.impressions ?? 0;
  const clicks = m.clicks ?? 0;

  if (impressions >= 50 && ctr != null) {
    if (ctr >= 0.05) score += 0.2;
    else if (ctr >= 0.03) score += 0.12;
    else if (ctr >= 0.015) score += 0.05;
    else score -= 0.08;
  } else if (clicks >= 10) {
    score += 0.08;
  }

  if (m.position != null && m.position > 0) {
    if (m.position <= 5) score += 0.15;
    else if (m.position <= 10) score += 0.08;
    else if (m.position <= 20) score += 0.02;
    else score -= 0.05;
  }

  if (m.avgTimeSec != null) {
    if (m.avgTimeSec >= 90) score += 0.12;
    else if (m.avgTimeSec >= 45) score += 0.06;
    else if (m.avgTimeSec < 20) score -= 0.08;
  }

  if (m.bounceRate != null) {
    const b = m.bounceRate > 1 ? m.bounceRate / 100 : m.bounceRate;
    if (b <= 0.45) score += 0.08;
    else if (b >= 0.75) score -= 0.1;
  }

  if ((m.conversions ?? 0) > 0) score += Math.min(0.15, 0.05 * (m.conversions as number));

  // Cold start: very low impressions → inconclusive → mild neutral
  if (impressions > 0 && impressions < 30 && clicks <= 1) {
    score = 0.5;
  }

  return Math.max(0, Math.min(1, score));
}

export function outcomeIsSuccess(score: number): boolean {
  return score >= 0.55;
}

export async function saveWieLastRun(articleId: number, run: WieLastRun): Promise<void> {
  const key = String(articleId);
  let data: RunsFile = {};
  try {
    data = JSON.parse(await readFile(RUNS_FILE, 'utf-8')) as RunsFile;
  } catch {
    data = {};
  }
  data[key] = run;
  try {
    await mkdir(path.dirname(RUNS_FILE), { recursive: true });
    await writeFile(RUNS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    /* best-effort */
  }
}

export async function readWieLastRun(articleId: number): Promise<WieLastRun | null> {
  try {
    const data = JSON.parse(await readFile(RUNS_FILE, 'utf-8')) as RunsFile;
    return data[String(articleId)] || null;
  } catch {
    return null;
  }
}

async function appendOutcome(rec: OutcomeRecord): Promise<void> {
  let file: OutcomesFile = { records: [] };
  try {
    file = JSON.parse(await readFile(OUTCOMES_FILE, 'utf-8')) as OutcomesFile;
    if (!Array.isArray(file.records)) file.records = [];
  } catch {
    file = { records: [] };
  }
  file.records.push(rec);
  file.records = file.records.slice(-500);
  try {
    await mkdir(path.dirname(OUTCOMES_FILE), { recursive: true });
    await writeFile(OUTCOMES_FILE, JSON.stringify(file, null, 2), 'utf-8');
  } catch {
    /* best-effort */
  }
}

/** Extract unique pattern ids from AO trace events metadata. */
export function extractPatternIdsFromTraceEvents(
  events: Array<{ metadata?: Record<string, unknown> }>,
): string[] {
  const ids = new Set<string>();
  for (const ev of events) {
    const raw = ev.metadata?.patternIdsUsed;
    if (Array.isArray(raw)) {
      for (const id of raw) {
        if (typeof id === 'string' && id.trim()) ids.add(id.trim());
      }
    }
    const decisions = ev.metadata?.decisions;
    if (Array.isArray(decisions)) {
      for (const d of decisions) {
        if (d && typeof d === 'object' && typeof (d as { pattern_id?: unknown }).pattern_id === 'string') {
          ids.add(String((d as { pattern_id: string }).pattern_id));
        }
      }
    }
  }
  return [...ids];
}

/**
 * Apply outcome metrics to Writing DNA pattern effectiveness.
 */
export async function applyOutcomeLearning(opts: {
  articleId: number;
  metrics: OutcomeMetrics;
  patternIds?: string[];
}): Promise<{
  applied: boolean;
  success: boolean;
  successScore: number;
  patternIds: string[];
  dna_version: number;
}> {
  const run = await readWieLastRun(opts.articleId);
  const patternIds = [
    ...new Set([
      ...(opts.patternIds || []),
      ...(run?.patternIds || []),
    ]),
  ].filter(Boolean);

  const successScore = computeOutcomeSuccessScore(opts.metrics);
  const success = outcomeIsSuccess(successScore);

  const store = await readPatternStore();
  if (!patternIds.length) {
    await appendOutcome({
      articleId: opts.articleId,
      at: new Date().toISOString(),
      metrics: opts.metrics,
      patternIds: [],
      successScore,
      success,
    });
    return {
      applied: false,
      success,
      successScore,
      patternIds: [],
      dna_version: store.dna_version,
    };
  }

  // Strong outcomes count twice toward effectiveness (Performance Loop weight)
  const times = successScore >= 0.7 || successScore <= 0.35 ? 2 : 1;
  for (let i = 0; i < times; i += 1) {
    await recordPatternOutcome({ patternIds, success });
  }

  await appendOutcome({
    articleId: opts.articleId,
    at: new Date().toISOString(),
    metrics: opts.metrics,
    patternIds,
    successScore,
    success,
  });

  const after = await readPatternStore();
  return {
    applied: true,
    success,
    successScore,
    patternIds,
    dna_version: after.dna_version,
  };
}

export async function listOutcomesForArticle(articleId: number, limit = 20): Promise<OutcomeRecord[]> {
  try {
    const file = JSON.parse(await readFile(OUTCOMES_FILE, 'utf-8')) as OutcomesFile;
    return (file.records || [])
      .filter((r) => r.articleId === articleId)
      .slice(-limit)
      .reverse();
  } catch {
    return [];
  }
}
