import type {
  CompiledWritePlan,
  PackValidationIssue,
  PackValidationResult,
  ParagraphPlan,
} from './types';

const VALID_CLAIM_STATUSES: string[] = ['raw', 'normalized', 'verified'];

function issue(
  code: string,
  message: string,
  packId?: string,
  paragraphId?: string,
): PackValidationIssue {
  return {
    stage: 'structural',
    code,
    message,
    packId,
    paragraphId,
  };
}

export function validateStructural(plan: CompiledWritePlan): PackValidationResult {
  const issues: PackValidationIssue[] = [];
  const paragraphIds = new Set(plan.paragraphPlans.map((p) => p.id));

  for (const pack of plan.knowledgePacks) {
    if (!pack.id || pack.id.trim().length === 0) {
      issues.push(issue('empty_pack_id', 'Knowledge pack has an empty id'));
      continue;
    }

    if (pack.paragraphPlanIds.length === 0) {
      issues.push(issue('empty_pack', `Pack "${pack.id}" has no paragraphPlanIds`, pack.id));
    }

    for (const paragraphPlanId of pack.paragraphPlanIds) {
      if (!paragraphPlanId || paragraphPlanId.trim().length === 0) {
        issues.push(issue('empty_paragraph', `Pack "${pack.id}" contains an empty paragraphPlanId`, pack.id));
      } else if (!paragraphIds.has(paragraphPlanId)) {
        issues.push(
          issue(
            'missing_paragraph',
            `Pack "${pack.id}" references missing paragraph plan "${paragraphPlanId}"`,
            pack.id,
          ),
        );
      }
    }
  }

  const claimIds = new Set(plan.graph.claims.map((c) => c.id));
  const factIds = new Set(plan.graph.facts.map((f) => f.id));
  const entityIds = new Set(plan.graph.entities.map((e) => e.id));
  const sourceIds = new Set(plan.graph.sources.map((s) => s.id));
  const questionIds = new Set(plan.graph.questions.map((q) => q.id));

  for (const claim of plan.graph.claims) {
    if (!VALID_CLAIM_STATUSES.includes(claim.status)) {
      issues.push(
        issue(
          'invalid_claim_status',
          `Claim "${claim.id}" has invalid status "${claim.status}"`,
        ),
      );
    }
  }

  for (const fact of plan.graph.facts) {
    if (!claimIds.has(fact.claimId)) {
      issues.push(
        issue(
          'fact_claim_missing',
          `Fact "${fact.id}" references missing claim "${fact.claimId}"`,
        ),
      );
    }
  }

  for (const paragraph of plan.paragraphPlans) {
    if (!paragraph.id || paragraph.id.trim().length === 0) {
      issues.push(issue('empty_paragraph_id', 'Paragraph plan has an empty id'));
      continue;
    }

    for (const depId of paragraph.dependsOnParagraphs) {
      if (!paragraphIds.has(depId)) {
        issues.push(
          issue(
            'missing_dependency',
            `Paragraph "${paragraph.id}" depends on missing paragraph "${depId}"`,
            paragraph.sectionId,
            paragraph.id,
          ),
        );
      }
    }

    for (const ref of paragraph.claims) {
      if (!claimIds.has(ref.claimId)) {
        issues.push(
          issue(
            'unresolved_claim',
            `Paragraph "${paragraph.id}" references missing claim "${ref.claimId}"`,
            paragraph.sectionId,
            paragraph.id,
          ),
        );
      }
    }

    for (const ref of paragraph.facts) {
      if (!factIds.has(ref.factId)) {
        issues.push(
          issue(
            'unresolved_fact',
            `Paragraph "${paragraph.id}" references missing fact "${ref.factId}"`,
            paragraph.sectionId,
            paragraph.id,
          ),
        );
      }
    }

    for (const ref of paragraph.entities) {
      if (!entityIds.has(ref.entityId)) {
        issues.push(
          issue(
            'unresolved_entity',
            `Paragraph "${paragraph.id}" references missing entity "${ref.entityId}"`,
            paragraph.sectionId,
            paragraph.id,
          ),
        );
      }
    }

    for (const ref of paragraph.sources) {
      if (!sourceIds.has(ref.sourceId)) {
        issues.push(
          issue(
            'unresolved_source',
            `Paragraph "${paragraph.id}" references missing source "${ref.sourceId}"`,
            paragraph.sectionId,
            paragraph.id,
          ),
        );
      }
    }

    for (const ref of paragraph.questions) {
      if (!questionIds.has(ref.questionId)) {
        issues.push(
          issue(
            'unresolved_question',
            `Paragraph "${paragraph.id}" references missing question "${ref.questionId}"`,
            paragraph.sectionId,
            paragraph.id,
          ),
        );
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}
