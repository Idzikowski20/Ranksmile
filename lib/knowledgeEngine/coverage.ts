/**
 * Claim coverage overlay — never mutates frozen KnowledgeGraph claims.
 * Results live in knowledge_coverage_report / plan annotations.
 */
import type { ArticleExecutionPlan } from '../contentPlanner/types';
import { getEmbeddingProvider, type EmbeddingProvider } from './embeddingProvider';
import { semanticMatchScore } from './semanticMatch';
import { patchExecutionPlanFromCoverage } from './aoPlanPatch';
import type {
  CanonicalClaim,
  ClaimCoverageItem,
  ClaimCoverageStatus,
  KnowledgeCoverageReport,
  KnowledgeGraph,
  WriterQualityMetrics,
} from './types';

const COVERED_MIN = 0.82;
const PARTIAL_MIN = 0.55;
const WINDOW_CHARS = 600;
const WINDOW_STEP = 400;
const MAX_WINDOWS = 48;

function statusFromScore(score: number): ClaimCoverageStatus {
  if (score >= COVERED_MIN) return 'covered';
  if (score >= PARTIAL_MIN) return 'partial';
  return 'missing';
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Sliding windows + sentence slices for max-similarity coverage. */
function articleCoverageWindows(articleText: string): string[] {
  const text = articleText.trim();
  if (!text) return [];
  if (text.length <= WINDOW_CHARS) return [text];

  const seen = new Set<string>();
  const windows: string[] = [];
  const pushUnique = (chunk: string) => {
    const t = chunk.trim();
    if (t.length < 20 || seen.has(t) || windows.length >= MAX_WINDOWS) return;
    seen.add(t);
    windows.push(t);
  };

  for (let i = 0; i < text.length && windows.length < MAX_WINDOWS; i += WINDOW_STEP) {
    pushUnique(text.slice(i, i + WINDOW_CHARS));
    if (i + WINDOW_CHARS >= text.length) break;
  }

  for (const part of text.split(/(?<=[.!?])\s+/)) {
    if (windows.length >= MAX_WINDOWS) break;
    pushUnique(part);
  }

  return windows.length ? windows : [text.slice(0, WINDOW_CHARS)];
}

async function maxClaimSimilarity(
  claimStatement: string,
  articleText: string,
  provider: EmbeddingProvider,
): Promise<number> {
  if (articleText.length < 20) return 0;
  const windows = articleCoverageWindows(articleText);
  let best = 0;
  for (const w of windows) {
    const score = await semanticMatchScore(claimStatement, w, provider);
    if (score > best) best = score;
    if (best >= COVERED_MIN) break;
  }
  return best;
}

export async function computeClaimCoverage(opts: {
  graph: KnowledgeGraph;
  articleHtml: string;
  provider?: EmbeddingProvider;
  sectionCount?: number;
}): Promise<KnowledgeCoverageReport> {
  const provider = opts.provider ?? getEmbeddingProvider();
  const articleText = stripHtml(opts.articleHtml);
  const items: ClaimCoverageItem[] = [];

  for (const claim of opts.graph.claims) {
    const score = await maxClaimSimilarity(claim.statement, articleText, provider);
    const coverage = statusFromScore(score);
    const coverageGaps: string[] = [];
    if (coverage !== 'covered') {
      coverageGaps.push(claim.statement.slice(0, 120));
    }
    items.push({
      claimId: claim.id,
      coverage,
      coverageScore: Math.round(score * 1000) / 1000,
      coverageGaps,
    });
  }

  const covered = items.filter((i) => i.coverage === 'covered').length;
  const writerMetrics: WriterQualityMetrics = {
    claimsUsed: covered,
    claimsTotal: items.length,
    coveragePct: items.length ? Math.round((covered / items.length) * 100) : 0,
    words: articleText.split(/\s+/).filter(Boolean).length,
    sections: opts.sectionCount ?? 0,
  };

  return { items, writerMetrics };
}

/** Convenience for tests — score one claim vs text. */
export async function coverageStatusForClaim(
  claim: CanonicalClaim,
  articleText: string,
  provider?: EmbeddingProvider,
): Promise<ClaimCoverageStatus> {
  const score = await maxClaimSimilarity(
    claim.statement,
    articleText,
    provider ?? getEmbeddingProvider(),
  );
  return statusFromScore(score);
}

export type CoverageOverlayResult = {
  scoreData: Record<string, unknown>;
  report: KnowledgeCoverageReport | null;
  patchedPlan: ArticleExecutionPlan | null;
};

function asGraph(value: unknown): KnowledgeGraph | null {
  if (!value || typeof value !== 'object') return null;
  const g = value as KnowledgeGraph;
  if (!Array.isArray(g.claims)) return null;
  return g;
}

function readExecutionPlan(scoreData: Record<string, unknown>): ArticleExecutionPlan | null {
  const planner = scoreData.content_planner_v2;
  if (!planner || typeof planner !== 'object') return null;
  const bundle = (planner as { bundle?: unknown }).bundle;
  if (!bundle || typeof bundle !== 'object') return null;
  const plan = (bundle as { executionPlan?: unknown }).executionPlan;
  if (!plan || typeof plan !== 'object') return null;
  const p = plan as ArticleExecutionPlan;
  if (!Array.isArray(p.sections) || typeof p.planHash !== 'string') return null;
  return p;
}

function writeExecutionPlan(
  scoreData: Record<string, unknown>,
  plan: ArticleExecutionPlan,
  previousPlanHash: string,
): void {
  const planner = scoreData.content_planner_v2;
  if (!planner || typeof planner !== 'object') return;
  const p = planner as Record<string, unknown>;
  const bundle = p.bundle;
  if (!bundle || typeof bundle !== 'object') return;
  const b = bundle as Record<string, unknown>;
  b.executionPlan = plan;
  p.ao_previous_plan_hash = previousPlanHash;
  p.ao_plan_patched_at = new Date().toISOString();
}

/** HTML save: coverage report + optional AO execution-plan patch. */
export async function applyKnowledgeCoverageOverlay(
  scoreData: Record<string, unknown>,
  articleHtml: string,
): Promise<CoverageOverlayResult> {
  const graph = asGraph(scoreData.knowledge_graph);
  if (!graph || articleHtml.trim().length < 40) {
    return { scoreData, report: null, patchedPlan: null };
  }

  const report = await computeClaimCoverage({ graph, articleHtml });
  const next: Record<string, unknown> = {
    ...scoreData,
    knowledge_coverage_report: report,
  };

  const needsPatch = report.items.some(
    (i) => i.coverage === 'missing' || i.coverage === 'partial',
  );
  let patchedPlan: ArticleExecutionPlan | null = null;
  if (needsPatch) {
    const plan = readExecutionPlan(next);
    if (plan) {
      const { previousPlanHash, newPlan, patchedClaimIds } = patchExecutionPlanFromCoverage({
        plan,
        report,
        graph,
      });
      if (patchedClaimIds.length) {
        writeExecutionPlan(next, newPlan, previousPlanHash);
        patchedPlan = newPlan;
      }
    }
  }

  return { scoreData: next, report, patchedPlan };
}
