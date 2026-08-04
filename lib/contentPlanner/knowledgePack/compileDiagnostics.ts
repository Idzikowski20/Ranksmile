import type {
  CompileDiagnostic,
  CompileDiagnostics,
  CompiledWritePlan,
  KnowledgePack,
  ParagraphPlan,
} from './types';

const PACK_SMALL_BUDGET_THRESHOLD = 150;

function sumWordBudget(paragraphPlans: ParagraphPlan[]): number {
  return paragraphPlans.reduce((sum, p) => sum + p.expectedWords, 0);
}

function computeCoveragePct(
  paragraphPlans: ParagraphPlan[],
  questionIds: string[],
): number {
  if (questionIds.length === 0) {
    return 100;
  }

  const assigned = new Set<string>();
  for (const plan of paragraphPlans) {
    for (const ref of plan.questions) {
      assigned.add(ref.questionId);
    }
  }

  const covered = questionIds.filter((id) => assigned.has(id)).length;
  return Math.round((covered / questionIds.length) * 100);
}

function computeEntityCoveragePct(
  paragraphPlans: ParagraphPlan[],
  entityIds: string[],
): number {
  if (entityIds.length === 0) {
    return 100;
  }

  const referenced = new Set<string>();
  for (const plan of paragraphPlans) {
    for (const ref of plan.entities) {
      referenced.add(ref.entityId);
    }
  }

  const covered = entityIds.filter((id) => referenced.has(id)).length;
  return Math.round((covered / entityIds.length) * 100);
}

function isMiddlePack(index: number, packCount: number): boolean {
  return index > 0 && index < packCount - 1;
}

function hasTransition(value: string | null): boolean {
  return value !== null && value.trim().length > 0;
}

function packSmallBudgetWarnings(packs: KnowledgePack[]): CompileDiagnostic[] {
  return packs
    .filter((p) => p.expectedWords < PACK_SMALL_BUDGET_THRESHOLD)
    .map((p) => ({
      level: 'warning' as const,
      code: 'pack_small_budget',
      message: `Pack "${p.id}" has expectedWords ${p.expectedWords} (below ${PACK_SMALL_BUDGET_THRESHOLD})`,
      packId: p.id,
    }));
}

function missingTransitionWarnings(packs: KnowledgePack[]): CompileDiagnostic[] {
  const warnings: CompileDiagnostic[] = [];

  for (let i = 0; i < packs.length; i += 1) {
    if (!isMiddlePack(i, packs.length)) {
      continue;
    }

    const pack = packs[i];
    const { fromPrevious, toNext } = pack.sectionTransitions;
    if (hasTransition(fromPrevious) && hasTransition(toNext)) {
      continue;
    }

    warnings.push({
      level: 'warning',
      code: 'missing_transition',
      message: `Middle pack "${pack.id}" is missing sectionTransitions (fromPrevious/toNext)`,
      packId: pack.id,
    });
  }

  return warnings;
}

function termUnassignedWarnings(paragraphPlans: ParagraphPlan[]): CompileDiagnostic[] {
  const warnings: CompileDiagnostic[] = [];

  for (const plan of paragraphPlans) {
    for (const term of plan.keywords) {
      if (!term.required || term.preferredParagraphs.length > 0) {
        continue;
      }

      warnings.push({
        level: 'warning',
        code: 'term_unassigned',
        message: `Required term "${term.term}" has no preferredParagraphs`,
        paragraphId: plan.id,
      });
    }
  }

  return warnings;
}

function buildInfos(
  packCount: number,
  keyword: string,
): CompileDiagnostic[] {
  return [
    {
      level: 'info',
      code: 'pack_count',
      message: `Compiled ${packCount} knowledge pack(s)`,
    },
    {
      level: 'info',
      code: 'keyword',
      message: `Target keyword: ${keyword}`,
    },
  ];
}

export function buildCompileDiagnostics(
  plan: Omit<CompiledWritePlan, 'diagnostics'>,
): CompileDiagnostics {
  const { knowledgePacks, paragraphPlans, graph, keyword } = plan;
  const packCount = knowledgePacks.length;
  const paragraphCount = paragraphPlans.length;
  const questionIds = graph.questions.map((q) => q.id);
  const entityIds = graph.entities.map((e) => e.id);

  const warnings: CompileDiagnostic[] = [
    ...packSmallBudgetWarnings(knowledgePacks),
    ...missingTransitionWarnings(knowledgePacks),
    ...termUnassignedWarnings(paragraphPlans),
  ];

  return {
    warnings,
    infos: buildInfos(packCount, keyword),
    metrics: {
      paragraphCount,
      packCount,
      wordBudget: sumWordBudget(paragraphPlans),
      coveragePct: computeCoveragePct(paragraphPlans, questionIds),
      entityCoveragePct: computeEntityCoveragePct(paragraphPlans, entityIds),
    },
  };
}
