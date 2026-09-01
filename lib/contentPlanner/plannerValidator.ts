/**
 * Planner Validator — plan quality (≠ Knowledge Verifier schema checks).
 */
import { MAX_CLAIMS_PER_SECTION } from '../knowledgeEngine/constants';
import type { PlannerTargets } from '../benchmarkIntelligence/types';
import type { KnowledgeGraph } from '../knowledgeEngine/types';
import type {
  AdaptiveOutline,
  SectionBrief,
  TargetKnowledgeGraph,
  ValidationIssue,
  ValidationResult,
} from './types';
import type { PlannerQualityMetrics } from '../knowledgeEngine/types';

export type PlannerValidateInput = {
  outline: AdaptiveOutline | null;
  briefs: SectionBrief[];
  kg: TargetKnowledgeGraph;
  targets?: PlannerTargets | null;
  graph?: KnowledgeGraph | null;
};

export type PlannerValidateResult = ValidationResult & {
  plannerMetrics: PlannerQualityMetrics;
};

export function validatePlannerPlan(input: PlannerValidateInput): PlannerValidateResult {
  const issues: ValidationIssue[] = [];
  const outline = input.outline;
  const briefs = input.briefs;

  if (!outline || !outline.sections.length) {
    issues.push({ code: 'empty_outline', message: 'Outline missing or empty' });
  }

  const assigned = new Set(
    (outline?.sections || []).flatMap((s) => s.assignedClaimIds),
  );
  const critical = input.kg.claims.filter((c) => c.priority === 'critical');
  for (const c of critical) {
    if (!assigned.has(c.id)) {
      issues.push({
        code: 'critical_claim_unassigned',
        message: `Critical claim ${c.id} not assigned to any section`,
      });
    }
  }

  if (input.targets && outline) {
    if (outline.sections.length < input.targets.h2) {
      issues.push({
        code: 'h2_below_benchmark',
        message: `H2 ${outline.sections.length} < target ${input.targets.h2}`,
        missing: input.targets.h2 - outline.sections.length,
      });
    }
  }

  for (const s of outline?.sections || []) {
    if (!s.heading.trim()) {
      issues.push({ code: 'empty_section', message: `Section ${s.id} has empty heading` });
    }
    if (s.assignedClaimIds.length > MAX_CLAIMS_PER_SECTION) {
      issues.push({
        code: 'section_claim_cap',
        message: `Section ${s.id} has ${s.assignedClaimIds.length} claims (max ${MAX_CLAIMS_PER_SECTION})`,
        missing: s.assignedClaimIds.length - MAX_CLAIMS_PER_SECTION,
      });
    }
  }

  for (const b of briefs) {
    if (!b.objective.trim()) {
      issues.push({ code: 'empty_brief', message: `Brief ${b.sectionId} missing objective` });
    }
    if (b.claimIds.length > MAX_CLAIMS_PER_SECTION) {
      issues.push({
        code: 'brief_claim_cap',
        message: `Brief ${b.sectionId} exceeds claim cap`,
      });
    }
  }

  const faqSections = (outline?.sections || []).filter((s) => /faq/i.test(s.role) || /faq/i.test(s.heading));
  const paaCount = input.graph?.gaps.filter((g) => g.kind === 'opportunity_gap').length
    ?? input.kg.questions.length;
  if (faqSections.length && paaCount === 0) {
    issues.push({
      code: 'faq_without_paa',
      message: 'FAQ section present but no PAA/opportunity questions in knowledge',
    });
  }

  const claimsUsed = assigned.size;
  const blocks = outline?.sections.length || 0;
  const coverage = input.kg.claims.length
    ? claimsUsed / input.kg.claims.length
    : 0;
  const plannerMetrics: PlannerQualityMetrics = {
    quality: Math.round((1 - Math.min(1, issues.length / 10)) * 100),
    coverage: Math.round(coverage * 100),
    blocks,
    claimsUsed,
  };

  // Soft-fail: faq_without_paa alone does not block
  const hard = issues.filter((i) => i.code !== 'faq_without_paa');
  return { ok: hard.length === 0, issues, plannerMetrics };
}
