import {
  buildAdaptiveOutline,
  buildSectionBriefs,
  improveBrief,
  improveOutline,
} from './outlineBuilder';
import {
  validateAgainstBenchmark,
  validateBriefs,
  validateBlueprint,
  validateOutline,
} from './validators/planValidators';
import { validatePlannerPlan } from './plannerValidator';
import { optimizeNarrative } from './narrativeOptimizer';
import {
  MAX_BRIEF_IMPROVE_ITERS,
  MAX_OUTLINE_IMPROVE_ITERS,
  type AdaptiveOutline,
  type ArticleBlueprint,
  type CompetitorBenchmark,
  type CompetitorSynthesisMetrics,
  type IntentBlueprint,
  type ReaderModel,
  type SectionBrief,
  type TargetKnowledgeGraph,
  type ValidationResult,
} from './types';
import type { TopicBlock } from '../knowledgeEngine/types';
import type { PlannerTargets } from '../benchmarkIntelligence/types';
import type { KnowledgeGraph } from '../knowledgeEngine/types';
import type { PlannerQualityMetrics } from '../knowledgeEngine/types';
import { MAX_CLAIMS_PER_SECTION } from '../knowledgeEngine/constants';

export type OutlineLoopResult = {
  outline: AdaptiveOutline;
  blueprint: ArticleBlueprint;
  validation: ValidationResult;
  iterations: number;
  escalated: boolean;
};

export type BriefLoopResult = {
  briefs: SectionBrief[];
  validation: ValidationResult;
  iterations: number;
  escalated: boolean;
};

function bumpBlueprintToBenchmark(
  blueprint: ArticleBlueprint,
  benchmark: CompetitorBenchmark,
): ArticleBlueprint {
  const words = Math.max(blueprint.targetWords, benchmark.targetWords);
  const h2 = Math.max(blueprint.targetH2, benchmark.targetH2);
  const paragraphs = Math.max(blueprint.targetParagraphs, benchmark.averageParagraphs);
  const lists = Math.max(blueprint.targetLists, benchmark.averageLists);
  const tables = Math.max(blueprint.targetTables, benchmark.averageTables);
  const faqs = Math.max(blueprint.targetFaqs, benchmark.averageFaq);
  const examples = Math.max(blueprint.targetExamples, Math.round(benchmark.averageExamples));
  const claims = Math.max(blueprint.targetClaims, Math.round(benchmark.averageClaims * 0.7));
  const questions = Math.max(blueprint.targetQuestions, Math.round(benchmark.averageQuestions * 0.7));
  return {
    ...blueprint,
    targetWords: words,
    targetH2: h2,
    targetParagraphs: paragraphs,
    targetLists: lists,
    targetTables: tables,
    targetFaqs: faqs,
    targetExamples: examples,
    targetClaims: claims,
    targetQuestions: questions,
    budget: {
      ...blueprint.budget,
      words,
      h2,
      paragraphs,
      lists,
      tables,
      faq: faqs,
      examples,
      claims,
      questions,
    },
  };
}

function rebalanceOverloadedSections(
  outline: AdaptiveOutline,
  kg: TargetKnowledgeGraph,
): AdaptiveOutline {
  const next: AdaptiveOutline = {
    ...outline,
    sections: outline.sections.map((s) => ({
      ...s,
      assignedClaimIds: [...s.assignedClaimIds],
      assignedQuestionIds: [...s.assignedQuestionIds],
      sectionBudget: { ...s.sectionBudget },
    })),
  };
  const overflow: string[] = [];
  for (const s of next.sections) {
    while (s.assignedClaimIds.length > MAX_CLAIMS_PER_SECTION) {
      overflow.push(s.assignedClaimIds.pop()!);
    }
    s.sectionBudget.claims = s.assignedClaimIds.length;
  }
  const under = [...next.sections]
    .filter((s) => s.assignedClaimIds.length < MAX_CLAIMS_PER_SECTION)
    .sort((a, b) => a.assignedClaimIds.length - b.assignedClaimIds.length);
  for (const id of overflow) {
    const target = under.find((s) => s.assignedClaimIds.length < MAX_CLAIMS_PER_SECTION);
    if (!target) break;
    if (!kg.claims.some((c) => c.id === id)) continue;
    target.assignedClaimIds.push(id);
    target.sectionBudget.claims = target.assignedClaimIds.length;
  }
  return next;
}

export function runOutlinePlanningLoop(opts: {
  blueprint: ArticleBlueprint;
  kg: TargetKnowledgeGraph;
  reader: ReaderModel;
  intent: IntentBlueprint;
  benchmark?: CompetitorBenchmark;
  synthesis?: CompetitorSynthesisMetrics | null;
  topicBlocks?: TopicBlock[] | null;
  plannerTargets?: PlannerTargets | null;
  knowledgeGraph?: KnowledgeGraph | null;
}): OutlineLoopResult {
  let blueprint = opts.blueprint;
  const narrativeSeeds = opts.topicBlocks?.length
    ? optimizeNarrative({
      topicBlocks: opts.topicBlocks,
      intent: opts.intent,
      targetH2: blueprint.targetH2,
      requiredSections: blueprint.requiredSections,
    })
    : null;
  let outline = buildAdaptiveOutline({ ...opts, blueprint, narrativeSeeds });
  let validation = validateOutline(outline, blueprint);
  if (opts.benchmark) {
    const bench = validateAgainstBenchmark({
      blueprint,
      outline,
      benchmark: opts.benchmark,
      synthesis: opts.synthesis,
      kg: opts.kg,
    });
    if (!bench.ok) {
      validation = { ok: false, issues: [...validation.issues, ...bench.issues] };
    }
  }
  let iterations = 0;
  while (!validation.ok && iterations < MAX_OUTLINE_IMPROVE_ITERS) {
    if (opts.benchmark && validation.issues.some((i) => i.code === 'below_competitor_benchmark')) {
      blueprint = bumpBlueprintToBenchmark(blueprint, opts.benchmark);
      blueprint = {
        ...blueprint,
        targetClaims: Math.min(blueprint.targetClaims, Math.max(opts.kg.claims.length, 1)),
        targetQuestions: Math.min(blueprint.targetQuestions, Math.max(opts.kg.questions.length, 1)),
        budget: {
          ...blueprint.budget,
          claims: Math.min(blueprint.budget.claims, Math.max(opts.kg.claims.length, 1)),
          questions: Math.min(blueprint.budget.questions, Math.max(opts.kg.questions.length, 1)),
        },
      };
      const seeds = opts.topicBlocks?.length
        ? optimizeNarrative({
          topicBlocks: opts.topicBlocks,
          intent: opts.intent,
          targetH2: blueprint.targetH2,
          requiredSections: blueprint.requiredSections,
        })
        : null;
      outline = buildAdaptiveOutline({ ...opts, blueprint, narrativeSeeds: seeds });
    } else {
      outline = improveOutline(outline, blueprint, opts.kg);
      outline = rebalanceOverloadedSections(outline, opts.kg);
    }
    validation = validateOutline(outline, blueprint);
    if (opts.benchmark) {
      const bench = validateAgainstBenchmark({
        blueprint,
        outline,
        benchmark: opts.benchmark,
        synthesis: opts.synthesis,
        kg: opts.kg,
      });
      if (!bench.ok) {
        validation = { ok: false, issues: [...validation.issues, ...bench.issues] };
      }
    }
    iterations++;
  }
  return {
    outline,
    blueprint,
    validation,
    iterations,
    escalated: !validation.ok,
  };
}

export function runBriefPlanningLoop(opts: {
  outline: AdaptiveOutline;
  kg: TargetKnowledgeGraph;
  reader?: ReaderModel;
}): BriefLoopResult {
  let briefs = buildSectionBriefs(opts.outline, opts.kg, opts.reader);
  let validation = validateBriefs(briefs);
  let iterations = 0;
  while (!validation.ok && iterations < MAX_BRIEF_IMPROVE_ITERS) {
    briefs = briefs.map((b) => {
      const one = validateBriefs([b]);
      return one.ok ? b : improveBrief(b);
    });
    validation = validateBriefs(briefs);
    iterations++;
  }
  return { briefs, validation, iterations, escalated: !validation.ok };
}

/** Improve loop using Planner Validator (distinct from Knowledge Verifier). */
export function runPlannerImproveLoop(opts: {
  outline: AdaptiveOutline;
  briefs: SectionBrief[];
  kg: TargetKnowledgeGraph;
  blueprint: ArticleBlueprint;
  reader?: ReaderModel;
  plannerTargets?: PlannerTargets | null;
  knowledgeGraph?: KnowledgeGraph | null;
  maxIters?: number;
}): {
  outline: AdaptiveOutline;
  briefs: SectionBrief[];
  validation: ValidationResult;
  plannerMetrics: PlannerQualityMetrics;
  iterations: number;
} {
  const max = opts.maxIters ?? MAX_OUTLINE_IMPROVE_ITERS;
  let outline = opts.outline;
  let briefs = opts.briefs;
  let result = validatePlannerPlan({
    outline,
    briefs,
    kg: opts.kg,
    targets: opts.plannerTargets,
    graph: opts.knowledgeGraph,
  });
  let iterations = 0;
  while (!result.ok && iterations < max) {
    if (result.issues.some((i) => i.code === 'section_claim_cap' || i.code === 'brief_claim_cap')) {
      outline = rebalanceOverloadedSections(outline, opts.kg);
      briefs = buildSectionBriefs(outline, opts.kg, opts.reader);
    } else if (result.issues.some((i) => i.code === 'critical_claim_unassigned')) {
      outline = improveOutline(outline, opts.blueprint, opts.kg);
      outline = rebalanceOverloadedSections(outline, opts.kg);
      briefs = buildSectionBriefs(outline, opts.kg, opts.reader);
    } else {
      briefs = briefs.map((b) => improveBrief(b));
    }
    result = validatePlannerPlan({
      outline,
      briefs,
      kg: opts.kg,
      targets: opts.plannerTargets,
      graph: opts.knowledgeGraph,
    });
    iterations++;
  }
  return {
    outline,
    briefs,
    validation: { ok: result.ok, issues: result.issues },
    plannerMetrics: result.plannerMetrics,
    iterations,
  };
}

export function assertBlueprintGate(blueprint: ArticleBlueprint): ValidationResult {
  return validateBlueprint(blueprint);
}
