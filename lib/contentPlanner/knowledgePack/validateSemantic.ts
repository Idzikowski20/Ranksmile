import type {
  CompiledWritePlan,
  KnowledgePack,
  PackValidationIssue,
  PackValidationResult,
  ParagraphPlan,
} from './types';

function issue(
  code: string,
  message: string,
  packId?: string,
  paragraphId?: string,
): PackValidationIssue {
  return {
    stage: 'semantic',
    code,
    message,
    packId,
    paragraphId,
  };
}

function isNonEmptyString(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateSemantic(plan: CompiledWritePlan): PackValidationResult {
  const issues: PackValidationIssue[] = [];

  const paragraphsById = new Map<string, ParagraphPlan>();
  for (const paragraph of plan.paragraphPlans) {
    paragraphsById.set(paragraph.id, paragraph);
  }

  // Global paragraph order: pack order, then paragraphPlanIds order within a pack.
  // Orphans (not in any pack) trail packed paragraphs in plan.paragraphPlans order.
  const orderById = new Map<string, number>();
  let order = 0;
  for (const pack of plan.knowledgePacks) {
    for (const paragraphId of pack.paragraphPlanIds) {
      if (!orderById.has(paragraphId)) {
        orderById.set(paragraphId, order);
        order += 1;
      }
    }
  }
  for (const paragraph of plan.paragraphPlans) {
    if (!orderById.has(paragraph.id)) {
      orderById.set(paragraph.id, order);
      order += 1;
    }
  }

  validateParagraphBudgets(plan.paragraphPlans, issues);

  for (const pack of plan.knowledgePacks) {
    validatePackBudget(pack, paragraphsById, issues);
    validatePackGoals(pack, paragraphsById, issues);
    validatePackTransitions(pack, plan.knowledgePacks, issues);
    validateParagraphTransitions(pack, paragraphsById, issues);
  }

  validateDependencies(plan.paragraphPlans, paragraphsById, orderById, issues);

  return {
    ok: issues.length === 0,
    issues,
  };
}

function validateParagraphBudgets(paragraphs: ParagraphPlan[], issues: PackValidationIssue[]): void {
  for (const paragraph of paragraphs) {
    if (paragraph.expectedWords <= 0) {
      issues.push(
        issue(
          'invalid_expected_words',
          `Paragraph "${paragraph.id}" expectedWords must be > 0`,
          paragraph.sectionId,
          paragraph.id,
        ),
      );
    }
  }
}

function validatePackBudget(
  pack: KnowledgePack,
  paragraphsById: Map<string, ParagraphPlan>,
  issues: PackValidationIssue[],
): void {
  if (pack.expectedWords <= 0) {
    issues.push(issue('invalid_expected_words', `Pack "${pack.id}" expectedWords must be > 0`, pack.id));
  }

  const paragraphs = pack.paragraphPlanIds
    .map((id) => paragraphsById.get(id))
    .filter((p): p is ParagraphPlan => p !== undefined);

  if (pack.expectedWords > 0 && paragraphs.length > 0) {
    const sum = paragraphs.reduce((total, paragraph) => total + paragraph.expectedWords, 0);
    const ratio = sum / pack.expectedWords;
    if (ratio < 0.85 || ratio > 1.15) {
      issues.push(
        issue(
          'word_budget_mismatch',
          `Pack "${pack.id}" paragraphs sum to ${sum} words, expected ${pack.expectedWords} (±15%)`,
          pack.id,
        ),
      );
    }
  }
}

function validatePackGoals(
  pack: KnowledgePack,
  paragraphsById: Map<string, ParagraphPlan>,
  issues: PackValidationIssue[],
): void {
  let previousGoal: string | null = null;

  for (const paragraphId of pack.paragraphPlanIds) {
    const paragraph = paragraphsById.get(paragraphId);
    if (!paragraph) {
      continue;
    }

    if (previousGoal === paragraph.goal) {
      issues.push(
        issue(
          'duplicate_consecutive_goal',
          `Pack "${pack.id}" has consecutive paragraphs with identical goal "${paragraph.goal}"`,
          pack.id,
          paragraph.id,
        ),
      );
    }

    previousGoal = paragraph.goal;
  }
}

function validatePackTransitions(
  pack: KnowledgePack,
  packs: KnowledgePack[],
  issues: PackValidationIssue[],
): void {
  const index = packs.indexOf(pack);
  if (index < 0) {
    return;
  }

  const hasPrevious = index > 0;
  const hasNext = index < packs.length - 1;

  if (hasPrevious && !isNonEmptyString(pack.sectionTransitions.fromPrevious)) {
    issues.push(
      issue(
        'missing_section_transition',
        `Pack "${pack.id}" has a previous section but sectionTransitions.fromPrevious is empty`,
        pack.id,
      ),
    );
  }

  if (hasNext && !isNonEmptyString(pack.sectionTransitions.toNext)) {
    issues.push(
      issue(
        'missing_section_transition',
        `Pack "${pack.id}" has a next section but sectionTransitions.toNext is empty`,
        pack.id,
      ),
    );
  }
}

function validateParagraphTransitions(
  pack: KnowledgePack,
  paragraphsById: Map<string, ParagraphPlan>,
  issues: PackValidationIssue[],
): void {
  if (pack.paragraphPlanIds.length === 0) {
    return;
  }

  const firstId = pack.paragraphPlanIds[0];
  const lastId = pack.paragraphPlanIds[pack.paragraphPlanIds.length - 1];

  for (const paragraphId of pack.paragraphPlanIds) {
    const paragraph = paragraphsById.get(paragraphId);
    if (!paragraph) {
      continue;
    }

    if (paragraphId !== firstId && !isNonEmptyString(paragraph.transitionFrom)) {
      issues.push(
        issue(
          'missing_paragraph_transition_from',
          `Paragraph "${paragraph.id}" is not the first in its pack but transitionFrom is empty`,
          pack.id,
          paragraph.id,
        ),
      );
    }

    if (paragraphId !== lastId && !isNonEmptyString(paragraph.transitionTo)) {
      issues.push(
        issue(
          'missing_paragraph_transition_to',
          `Paragraph "${paragraph.id}" is not the last in its pack but transitionTo is empty`,
          pack.id,
          paragraph.id,
        ),
      );
    }
  }
}

function validateDependencies(
  paragraphs: ParagraphPlan[],
  paragraphsById: Map<string, ParagraphPlan>,
  orderById: Map<string, number>,
  issues: PackValidationIssue[],
): void {
  for (const paragraph of paragraphs) {
    const currentOrder = orderById.get(paragraph.id);
    if (currentOrder === undefined) {
      // Structural validator reports paragraphs missing from the plan registry.
      continue;
    }

    for (const depId of paragraph.dependsOnParagraphs) {
      const depParagraph = paragraphsById.get(depId);
      if (!depParagraph) {
        // Structural validator reports missing dependencies.
        continue;
      }

      const depOrder = orderById.get(depId);
      if (depOrder === undefined || depOrder >= currentOrder) {
        issues.push(
          issue(
            'cyclic_dependency',
            `Paragraph "${paragraph.id}" depends on "${depId}" which is not earlier in the plan`,
            paragraph.sectionId,
            paragraph.id,
          ),
        );
      }
    }
  }
}
