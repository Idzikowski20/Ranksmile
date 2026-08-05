/**
 * AO patches Execution Plan only — never mutates Knowledge Graph.
 */
import { createHash } from 'crypto';
import type { ArticleExecutionPlan, ExecutionPlanSection } from '../contentPlanner/types';
import { hashExecutionPlanPayload } from '../contentPlanner/executionPlan';
import { MAX_CLAIMS_PER_SECTION } from './constants';
import type { KnowledgeCoverageReport, KnowledgeGraph } from './types';

export type AoPlanPatchResult = {
  previousPlanHash: string;
  newPlan: ArticleExecutionPlan;
  patchedClaimIds: string[];
};

function stableClonePlan(plan: ArticleExecutionPlan): ArticleExecutionPlan {
  return JSON.parse(JSON.stringify(plan)) as ArticleExecutionPlan;
}

/**
 * Missing/partial claims from coverage report → redistribute into sections
 * that still have claim capacity. Returns a **new** plan object.
 */
export function patchExecutionPlanFromCoverage(opts: {
  plan: ArticleExecutionPlan;
  report: KnowledgeCoverageReport;
  graph: KnowledgeGraph;
}): AoPlanPatchResult {
  const previousPlanHash = opts.plan.planHash;
  const missingIds = opts.report.items
    .filter((i) => i.coverage === 'missing' || i.coverage === 'partial')
    .map((i) => i.claimId);

  const claimById = new Map(opts.graph.claims.map((c) => [c.id, c]));
  const newPlan = stableClonePlan(opts.plan);
  const patchedClaimIds: string[] = [];

  for (const claimId of missingIds) {
    const claim = claimById.get(claimId);
    if (!claim) continue;
    const already = newPlan.sections.some((s) => s.claims.some((c) => c.id === claimId));
    // Already assigned — no insertion; do not trigger a revision write.
    if (already) continue;
    const target = pickSection(newPlan.sections, claim.cluster);
    if (!target || target.claims.length >= MAX_CLAIMS_PER_SECTION) continue;
    target.claims.push({
      id: claim.id,
      statement: claim.statement,
      sources: claim.evidence.map((e) => ({
        url: e.url,
        label: e.title || e.domain,
        confidence: e.weight,
      })),
    });
    target.budget = {
      ...target.budget,
      claims: target.claims.length,
    };
    target.reason = {
      summary: `AO patch: ensure claim ${claim.id}`,
      signals: [
        ...(target.reason?.signals || []),
        `coverage:${opts.report.items.find((i) => i.claimId === claimId)?.coverage || 'missing'}`,
      ],
    };
    patchedClaimIds.push(claimId);
  }

  const { planHash: _drop, builtAt: _oldBuiltAt, ...rest } = newPlan;
  void _drop;
  void _oldBuiltAt;
  const withoutHash: Omit<ArticleExecutionPlan, 'planHash'> = {
    ...rest,
    builtAt: new Date().toISOString(),
  };
  const rebuilt: ArticleExecutionPlan = {
    ...withoutHash,
    planHash: hashExecutionPlanPayload(withoutHash),
  };

  return {
    previousPlanHash,
    newPlan: rebuilt,
    patchedClaimIds,
  };
}

function pickSection(
  sections: ExecutionPlanSection[],
  cluster: string,
): ExecutionPlanSection | null {
  if (!sections.length) return null;
  const byCluster = sections.find((s) =>
    s.heading.toLowerCase().includes(cluster.toLowerCase().slice(0, 12))
    || cluster.toLowerCase().includes(s.heading.toLowerCase().slice(0, 12)),
  );
  if (byCluster && byCluster.claims.length < MAX_CLAIMS_PER_SECTION) return byCluster;
  return [...sections].sort((a, b) => a.claims.length - b.claims.length)[0] || null;
}

/** Self-check helper — hashes should diverge after a real patch. */
export function plansDiffer(a: ArticleExecutionPlan, b: ArticleExecutionPlan): boolean {
  return a.planHash !== b.planHash
    || createHash('sha1').update(JSON.stringify(a.sections)).digest('hex')
      !== createHash('sha1').update(JSON.stringify(b.sections)).digest('hex');
}
