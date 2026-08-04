/**
 * Knowledge Coverage % — Plan Validator aggregate (≥ 95% gate).
 */
import type {
  AdaptiveOutline,
  KnowledgeCoverageReport,
  KnowledgeCoverageSlice,
  SectionBrief,
  TargetKnowledgeGraph,
} from './types';

function slice(total: number, assigned: number): KnowledgeCoverageSlice {
  const t = Math.max(0, total);
  const a = Math.max(0, Math.min(assigned, t || assigned));
  const pct = t === 0 ? 100 : Math.round((a / t) * 1000) / 10;
  return { total: t, assigned: a, pct };
}

export function computeKnowledgeCoverage(opts: {
  kg: TargetKnowledgeGraph;
  outline: AdaptiveOutline | null;
  briefs?: SectionBrief[];
}): KnowledgeCoverageReport {
  const assignedClaimIds = new Set(
    (opts.outline?.sections || []).flatMap((s) => s.assignedClaimIds),
  );
  const assignedQuestionIds = new Set(
    (opts.outline?.sections || []).flatMap((s) => s.assignedQuestionIds),
  );

  const critical = opts.kg.claims.filter(
    (c) => c.priority === 'critical' || c.importance === 'required',
  );
  const criticalAssigned = critical.filter((c) => assignedClaimIds.has(c.id)).length;

  const questions = opts.kg.questions;
  const questionsAssigned = questions.filter((q) => assignedQuestionIds.has(q.id)).length;

  const evidenceNeeds = (opts.outline?.sections || []).flatMap((s) => s.evidenceNeeds);
  const evidenceTotal = evidenceNeeds.length;
  const evidenceAssigned = (opts.briefs || []).reduce((n, b) => n + b.evidence.length, 0);
  // Evidence is per-section need; briefs should mirror outline evidenceNeeds.
  const evidenceCovered = opts.outline
    ? opts.outline.sections.filter((s) => {
      const brief = (opts.briefs || []).find((b) => b.sectionId === s.id);
      return s.evidenceNeeds.length === 0 || (brief && brief.evidence.length >= s.evidenceNeeds.length);
    }).length
    : 0;
  const evidenceSectionTotal = opts.outline?.sections.length || 0;

  const criticalClaims = slice(critical.length, criticalAssigned);
  const qSlice = slice(questions.length, questionsAssigned);
  const evidenceSlice = slice(
    evidenceSectionTotal || evidenceTotal,
    evidenceSectionTotal ? evidenceCovered : Math.min(evidenceAssigned, evidenceTotal),
  );

  const knowledgeCoveragePct = Math.min(
    criticalClaims.pct,
    qSlice.pct,
    evidenceSlice.pct,
  );

  return {
    criticalClaims,
    questions: qSlice,
    evidenceNeeds: evidenceSlice,
    knowledgeCoveragePct,
  };
}
