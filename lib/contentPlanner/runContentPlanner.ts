import { buildIntentBlueprint } from './intentBlueprint';
import { buildReaderModel } from './readerModel';
import { buildCompetitorProfiles, type CompetitorRawInput } from './competitorIntelligence';
import { buildCompetitorBenchmark, synthesizeCompetitors } from './competitorBenchmark';
import {
  applyPriorityOrder,
  buildTargetKnowledgeGraph,
  type AiSearchIntelInput,
} from './knowledgeIntelligence';
import { buildArticleBlueprint } from './budgetEngine';
import {
  assertBlueprintGate,
  runBriefPlanningLoop,
  runOutlinePlanningLoop,
  runPlannerImproveLoop,
} from './planningLoop';
import {
  assembleArticle,
  buildSectionMemory,
  stubWriteSection,
} from './sectionWriter';
import {
  requiredCoverageRate,
  validateClaims,
  validateFlow,
  validatePlanConformity,
  validateQuestions,
  validateSeoAgainstBlueprint,
} from './validators/postWriteValidators';
import { buildRewritePlan, runKnowledgeCompletion } from './knowledgeCompletion';
import { computeKnowledgeCoverage } from './knowledgeCoverage';
import { buildArticleExecutionPlan } from './executionPlan';
import { generateQuickAnswer } from './quickAnswer';
import { validatePlanForWrite } from './validators/planValidators';
import { titleizeH1 } from './sectionLabels';
import type {
  CompetitorBenchmark, ContentPlannerBundle, ValidationIssue, ValidationResult,
} from './types';
import { KNOWLEDGE_COVERAGE_MIN_PCT } from './types';
import type { KnowledgeGraph, TopicBlock } from '../knowledgeEngine/types';
import { knowledgeGraphToTargetKg } from '../knowledgeEngine/toTargetKg';
import type { PlannerTargets } from '../benchmarkIntelligence/types';

export type RunContentPlannerInput = {
  keyword: string;
  year?: number;
  allowBrandNiche?: boolean;
  brandNicheHint?: string;
  competitors: CompetitorRawInput[];
  ai?: AiSearchIntelInput;
  paaQuestions?: string[];
  /** When true, run stub writer + validators + KCE (no LLM). */
  produceArticle?: boolean;
  builtAt?: string;
  /** CIE: immutable Knowledge Graph — replaces legacy Target KG when set. */
  knowledgeGraph?: KnowledgeGraph | null;
  /** Narrative-only seeds from a below-floor Knowledge Graph; legacy KG still supplies facts. */
  topicBlocks?: readonly TopicBlock[] | null;
  /** CIE: median-first structural targets overlay on CompetitorBenchmark. */
  plannerTargets?: PlannerTargets | null;
  /** Article/domain language (pl|en) for outline labels + H1. */
  language?: string;
  /** Competitor H2 titles from outlines cache. */
  commonHeadings?: string[];
};

export type RunContentPlannerResult = {
  bundle: ContentPlannerBundle;
  blueprintValidation: ValidationResult;
  outlineValidation: ValidationResult;
  briefValidation: ValidationResult;
  planValidation?: ValidationResult;
  canWrite: boolean;
  html?: string;
  postWrite?: {
    flow: ValidationResult;
    claims: ValidationResult;
    questions: ValidationResult;
    seo: ValidationResult;
    planConformity?: ValidationResult;
    coverageBefore: number;
    coverageAfter: number;
    rewriteSteps: number;
    kceApplied: number;
  };
};

function emptyExtras(): Pick<
  ContentPlannerBundle,
  'quickAnswer' | 'knowledgeCoverage' | 'executionPlan'
> {
  return {
    quickAnswer: null,
    knowledgeCoverage: null,
    executionPlan: null,
  };
}

function applyPlannerTargets(
  benchmark: CompetitorBenchmark,
  targets?: PlannerTargets | null,
): CompetitorBenchmark {
  if (!targets) return benchmark;
  return {
    ...benchmark,
    targetWords: targets.words,
    targetH2: targets.h2,
    averageFaq: Math.max(benchmark.averageFaq, targets.faq),
    averageLists: Math.max(benchmark.averageLists, targets.lists),
    averageTables: Math.max(benchmark.averageTables, targets.tables),
    averageImages: Math.max(benchmark.averageImages, targets.images),
    averageExamples: Math.max(benchmark.averageExamples, targets.examples),
  };
}

export function runContentPlanner(input: RunContentPlannerInput): RunContentPlannerResult {
  const intent = buildIntentBlueprint({
    keyword: input.keyword,
    year: input.year,
    allowBrandNiche: input.allowBrandNiche,
    language: input.language,
  });
  const reader = buildReaderModel({
    intent,
    brandNicheHint: input.brandNicheHint,
    language: input.language,
  });
  const profiles = buildCompetitorProfiles(input.competitors);
  const competitorSynthesis = synthesizeCompetitors(profiles);
  const benchmark = applyPlannerTargets(
    {
      ...buildCompetitorBenchmark(competitorSynthesis),
      ...(input.commonHeadings?.length
        ? { commonHeadings: input.commonHeadings }
        : {}),
    },
    input.plannerTargets,
  );
  let targetKg = input.knowledgeGraph
    ? knowledgeGraphToTargetKg(input.knowledgeGraph, input.paaQuestions)
    : buildTargetKnowledgeGraph({
      profiles,
      ai: input.ai,
      paaQuestions: input.paaQuestions,
    });
  targetKg = applyPriorityOrder(targetKg);

  let blueprint = buildArticleBlueprint({ benchmark, kg: targetKg, intent, reader });
  const blueprintValidation = assertBlueprintGate(blueprint);

  if (!blueprintValidation.ok) {
    return {
      bundle: {
        schemaVersion: 2,
        keyword: intent.keyword,
        intent,
        reader,
        competitorSynthesis,
        benchmark,
        targetKg,
        blueprint,
        outline: null,
        briefs: [],
        rewritePlan: null,
        ...emptyExtras(),
        builtAt: input.builtAt || new Date().toISOString(),
      },
      blueprintValidation,
      outlineValidation: { ok: false, issues: [{ code: 'blueprint_blocked', message: 'Outline skipped — blueprint gate failed' }] },
      briefValidation: { ok: false, issues: [{ code: 'blueprint_blocked', message: 'Briefs skipped — blueprint gate failed' }] },
      canWrite: false,
    };
  }

  const topicBlocks = input.topicBlocks ?? input.knowledgeGraph?.topicBlocks;
  const outlineLoop = runOutlinePlanningLoop({
    blueprint,
    kg: targetKg,
    reader,
    intent,
    benchmark,
    synthesis: competitorSynthesis,
    topicBlocks: topicBlocks ? [...topicBlocks] : null,
    plannerTargets: input.plannerTargets,
    knowledgeGraph: input.knowledgeGraph,
  });
  blueprint = outlineLoop.blueprint;

  const briefLoop = outlineLoop.validation.ok
    ? runBriefPlanningLoop({ outline: outlineLoop.outline, kg: targetKg, reader })
    : {
      briefs: [],
      validation: {
        ok: false,
        issues: [{ code: 'outline_blocked', message: 'Briefs skipped — outline gate failed' }],
      },
      iterations: 0,
      escalated: true,
    };

  let outline = outlineLoop.outline;
  let briefs = briefLoop.briefs;
  let outlineValidation = outlineLoop.validation;
  let briefValidation = briefLoop.validation;
  let improveValidation: ValidationResult | null = null;

  if (outlineLoop.validation.ok && briefLoop.validation.ok && outline) {
    const improved = runPlannerImproveLoop({
      outline,
      briefs,
      kg: targetKg,
      blueprint,
      reader,
      plannerTargets: input.plannerTargets,
      knowledgeGraph: input.knowledgeGraph,
    });
    outline = improved.outline;
    briefs = improved.briefs;
    improveValidation = improved.validation;
    if (!improved.validation.ok) {
      outlineValidation = {
        ok: false,
        issues: [...outlineValidation.issues, ...improved.validation.issues],
      };
    }
  }

  const knowledgeCoverage = outline
    ? computeKnowledgeCoverage({
      kg: targetKg,
      outline,
      briefs,
    })
    : null;

  const structuralOk = blueprintValidation.ok && outlineValidation.ok && briefValidation.ok;
  // Sync path: canWrite requires structure + coverage ≥95%; Quick Answer / Execution Plan via finalizePlannerForWrite.
  const coverageOk = knowledgeCoverage
    ? knowledgeCoverage.knowledgeCoveragePct >= KNOWLEDGE_COVERAGE_MIN_PCT
    : false;
  const canWrite = structuralOk && coverageOk;

  const bundle: ContentPlannerBundle = {
    schemaVersion: 2,
    keyword: intent.keyword,
    intent,
    reader,
    competitorSynthesis,
    benchmark,
    targetKg,
    blueprint,
    outline,
    briefs,
    rewritePlan: null,
    quickAnswer: null,
    knowledgeCoverage,
    executionPlan: null,
    builtAt: input.builtAt || new Date().toISOString(),
  };

  if (!input.produceArticle || !canWrite || !bundle.outline) {
    return {
      bundle,
      blueprintValidation,
      outlineValidation,
      briefValidation,
      canWrite,
      ...(improveValidation ? { planValidation: improveValidation } : {}),
    };
  }
  const coveredClaims: string[] = [];
  const coveredQuestions: string[] = [];
  const usedEntities: string[] = [];
  const sectionHtmls: string[] = [];
  for (let i = 0; i < bundle.outline.sections.length; i++) {
    const brief = bundle.briefs[i];
    if (!brief) continue;
    const memory = buildSectionMemory({
      outline: bundle.outline,
      sectionIndex: i,
      reader,
      coveredClaimIds: coveredClaims,
      coveredQuestionIds: coveredQuestions,
      usedEntities,
    });
    void memory;
    const html = stubWriteSection({ brief, kg: targetKg });
    sectionHtmls.push(html);
    coveredClaims.push(...brief.claimIds);
    coveredQuestions.push(...brief.questionIds);
  }

  let html = assembleArticle({ h1: bundle.outline.h1, sectionHtmls });
  const flow = validateFlow(html, bundle.outline);
  const claimsBefore = validateClaims(html, targetKg);
  const questionsBefore = validateQuestions(html, targetKg);
  const seo = validateSeoAgainstBlueprint(html, blueprint);
  const coverageBefore = requiredCoverageRate(claimsBefore.items);

  const rewritePlan = buildRewritePlan({
    outline: bundle.outline,
    kg: targetKg,
    claimItems: claimsBefore.items,
    questionStatuses: questionsBefore.statuses,
    flow,
    seo,
  });
  bundle.rewritePlan = rewritePlan;

  const kce = runKnowledgeCompletion({
    html,
    plan: rewritePlan,
    outline: bundle.outline,
    kg: targetKg,
    briefs: bundle.briefs,
  });
  html = kce.html;

  const claimsAfter = validateClaims(html, targetKg);
  const questionsAfter = validateQuestions(html, targetKg);
  const coverageAfter = requiredCoverageRate(claimsAfter.items);
  const planConformity = validatePlanConformity(
    html,
    bundle.outline.sections.map((s) => s.heading),
  );

  return {
    bundle,
    blueprintValidation,
    outlineValidation,
    briefValidation,
    canWrite: canWrite && planConformity.ok,
    html,
    postWrite: {
      flow,
      claims: claimsAfter.result,
      questions: questionsAfter.result,
      seo: validateSeoAgainstBlueprint(html, blueprint),
      planConformity,
      coverageBefore,
      coverageAfter,
      rewriteSteps: rewritePlan.steps.length,
      kceApplied: kce.applied,
    },
  };
}

/**
 * Which structural gate actually blocked the write.
 *
 * `canWrite` is an AND over four independent checks, so a bare "gates failed" tells the
 * reader nothing they can act on: re-running the analysis fixes a coverage shortfall but
 * not a blueprint that is short of claims, and neither is the same as a planner that
 * produced no outline at all. Each surviving issue keeps its own code and message.
 */
function structuralBlockIssues(result: RunContentPlannerResult): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!result.blueprintValidation.ok) issues.push(...result.blueprintValidation.issues);
  if (!result.outlineValidation.ok) issues.push(...result.outlineValidation.issues);
  if (!result.briefValidation.ok) issues.push(...result.briefValidation.issues);

  if (!result.bundle.outline) {
    issues.push({ code: 'no_outline', message: 'Planner produced no outline' });
  } else if (!result.bundle.briefs.length) {
    issues.push({ code: 'no_briefs', message: 'Planner produced an outline with no section briefs' });
  }

  // No coverage means no outline, which `no_outline` above already reported.
  const coverage = result.bundle.knowledgeCoverage;
  if (coverage && coverage.knowledgeCoveragePct < KNOWLEDGE_COVERAGE_MIN_PCT) {
    issues.push({
      code: 'coverage_too_low',
      message: `Knowledge coverage ${coverage.knowledgeCoveragePct}% is below the ${KNOWLEDGE_COVERAGE_MIN_PCT}% required to write `
        + `(critical claims ${coverage.criticalClaims.assigned}/${coverage.criticalClaims.total}, `
        + `questions ${coverage.questions.assigned}/${coverage.questions.total}, `
        + `evidence ${coverage.evidenceNeeds.assigned}/${coverage.evidenceNeeds.total})`,
    });
  }

  // Reachable only when a gate says `ok: false` and hands over an empty `issues` array,
  // so name that gate — "gates failed" was the unactionable message this function exists
  // to replace, and it would be the one message left for the hardest case to diagnose.
  if (!issues.length) {
    const silent = ([
      ['blueprint', result.blueprintValidation],
      ['outline', result.outlineValidation],
      ['brief', result.briefValidation],
      ['planConformity', result.postWrite?.planConformity],
    ] as const).filter(([, v]) => v && !v.ok).map(([name]) => name);
    issues.push({
      code: 'structure_blocked',
      message: silent.length
        ? `${silent.join(', ')} validation failed but reported no issue`
        : 'canWrite is false while every planner gate reports ok',
    });
  }
  return issues;
}

/**
 * Planner First write gate: Quick Answer LLM → Plan Validator → immutable Execution Plan.
 * Writer must not run when canWrite is false.
 */
export async function finalizePlannerForWrite(
  result: RunContentPlannerResult,
  opts?: {
    signal?: AbortSignal;
    llmEdit?: (userPrompt: string, systemPrompt: string) => Promise<{ html: string; tokens: number }>;
    /** Injected Quick Answer (tests) — skips LLM. */
    quickAnswerOverride?: string;
  },
): Promise<RunContentPlannerResult> {
  const bundle = { ...result.bundle };
  if (!result.canWrite || !bundle.outline || !bundle.briefs.length) {
    return {
      ...result,
      bundle,
      // Forward the gate that actually tripped. Collapsing blueprint, outline, brief and
      // knowledge-coverage failures into one "Structural planner gates failed" left the
      // only user-visible signal unactionable — and undebuggable, since the response is
      // all a caller ever sees of this run.
      planValidation: { ok: false, issues: structuralBlockIssues(result) },
      canWrite: false,
    };
  }

  let quickAnswer = opts?.quickAnswerOverride?.trim() || '';
  if (!quickAnswer) {
    try {
      quickAnswer = await generateQuickAnswer({
        keyword: bundle.keyword,
        intent: bundle.intent,
        reader: bundle.reader,
        signal: opts?.signal,
        llmEdit: opts?.llmEdit,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'quick_answer_failed';
      return {
        ...result,
        bundle: { ...bundle, quickAnswer: null, executionPlan: null },
        planValidation: {
          ok: false,
          issues: [{ code: 'quick_answer_failed', message }],
        },
        canWrite: false,
      };
    }
  }

  bundle.quickAnswer = quickAnswer;
  if (bundle.outline) {
    const lang = bundle.reader.language === 'en' ? 'en' : 'pl';
    bundle.outline = {
      ...bundle.outline,
      h1: titleizeH1({
        keyword: bundle.keyword,
        lang,
        year: bundle.intent.yearHint,
        quickAnswer,
      }),
    };
  }
  bundle.knowledgeCoverage = computeKnowledgeCoverage({
    kg: bundle.targetKg,
    outline: bundle.outline!,
    briefs: bundle.briefs,
  });

  const planValidation = validatePlanForWrite({
    blueprint: bundle.blueprint,
    outline: bundle.outline,
    briefs: bundle.briefs,
    kg: bundle.targetKg,
    benchmark: bundle.benchmark,
    synthesis: bundle.competitorSynthesis,
    quickAnswer: bundle.quickAnswer,
    knowledgeCoverage: bundle.knowledgeCoverage,
  });

  if (!planValidation.ok) {
    return {
      ...result,
      bundle: { ...bundle, executionPlan: null },
      planValidation,
      canWrite: false,
    };
  }

  const executionPlan = buildArticleExecutionPlan(bundle);
  if (!executionPlan) {
    return {
      ...result,
      bundle: { ...bundle, executionPlan: null },
      planValidation: {
        ok: false,
        issues: [{ code: 'execution_plan_build_failed', message: 'Could not build ArticleExecutionPlan' }],
      },
      canWrite: false,
    };
  }

  bundle.executionPlan = executionPlan;
  return {
    ...result,
    bundle,
    planValidation,
    canWrite: true,
  };
}
