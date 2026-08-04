import { createHash } from 'crypto';
import type { ArticleExecutionPlan, ExecutionPlanSection } from '../types';
import {
  PIPELINE_COMPONENT_VERSIONS,
  type Claim,
  type CompileDiagnostics,
  type CompiledWritePlan,
  type CompileResult,
  type Entity,
  type Fact,
  type KnowledgeGraphSnapshot,
  type KnowledgePack,
  type ParagraphPlan,
  type Question,
  type QuestionRef,
  type ClaimRef,
  type FactRef,
  type EntityRef,
  type PipelineManifest,
} from './types';
import { buildCompileDiagnostics } from './compileDiagnostics';
import { validateStructural } from './validateStructural';
import { buildKnowledgePack } from './sectionPlanner';
import { planParagraphs } from './paragraphPlanner';
import { allocateTerms } from './termAllocator';
import { allocateNoBrandMentionConstraints } from './constraintAllocator';

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

function hashCompiledPlan(payload: Omit<CompiledWritePlan, 'planHash'>): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex').slice(0, 32);
}

function buildManifest(builtAt: string): PipelineManifest {
  return {
    plannerVersion: PIPELINE_COMPONENT_VERSIONS.planner,
    compilerVersion: PIPELINE_COMPONENT_VERSIONS.compiler,
    validatorVersion: PIPELINE_COMPONENT_VERSIONS.validator,
    writerVersion: PIPELINE_COMPONENT_VERSIONS.writer,
    judgeVersion: PIPELINE_COMPONENT_VERSIONS.judge,
    rendererVersion: PIPELINE_COMPONENT_VERSIONS.renderer,
    compiledAt: builtAt,
  };
}

function buildGraph(plan: ArticleExecutionPlan, builtAt: string): KnowledgeGraphSnapshot {
  const claims: Claim[] = [];
  const facts: Fact[] = [];
  const entities: Entity[] = [];
  const questions: Question[] = [];

  for (const section of plan.sections) {
    for (const c of section.claims) {
      claims.push({
        id: c.id,
        text: c.statement,
        sourceId: null,
        confidence: 1,
        status: 'verified',
      });
      facts.push({
        id: `fact-${c.id}`,
        claimId: c.id,
        statement: c.statement,
        confidence: 1,
      });
    }

    for (let i = 0; i < section.entities.length; i += 1) {
      const name = section.entities[i];
      entities.push({
        id: `entity-${section.id}-${i}`,
        name,
        kind: 'concept',
        aliases: [],
      });
    }

    for (let i = 0; i < section.questions.length; i += 1) {
      questions.push({
        id: `q-${section.id}-q${i}`,
        text: section.questions[i],
      });
    }

    for (let i = 0; i < section.mustAnswer.length; i += 1) {
      questions.push({
        id: `q-${section.id}-m${i}`,
        text: section.mustAnswer[i],
      });
    }
  }

  return {
    version: '1',
    createdAt: builtAt,
    plannerVersion: plan.plannerVersion,
    researchVersion: 'none',
    sources: [],
    entities,
    claims,
    facts,
    questions,
  };
}

function enrichFirstParagraph(
  paragraph: ParagraphPlan,
  section: ExecutionPlanSection,
): ParagraphPlan {
  const claimRefs: ClaimRef[] = section.claims.map((c) => ({ claimId: c.id }));
  const factRefs: FactRef[] = section.claims.map((c) => ({ factId: `fact-${c.id}` }));
  const entityRefs: EntityRef[] = section.entities.map((_, i) => ({
    entityId: `entity-${section.id}-${i}`,
  }));
  const questionRefs: QuestionRef[] = [
    ...section.questions.map((_, i) => ({ questionId: `q-${section.id}-q${i}` })),
    ...section.mustAnswer.map((_, i) => ({ questionId: `q-${section.id}-m${i}` })),
  ];

  return {
    ...paragraph,
    claims: [...paragraph.claims, ...claimRefs],
    facts: [...paragraph.facts, ...factRefs],
    entities: [...paragraph.entities, ...entityRefs],
    questions: [...paragraph.questions, ...questionRefs],
  };
}

export function compileWritePlan(
  plan: ArticleExecutionPlan,
  opts?: { importantTerms?: string[]; allowBrandNiche?: boolean; researchVersion?: string },
): CompiledWritePlan {
  const importantTerms = opts?.importantTerms ?? [];
  const allowBrandNiche = opts?.allowBrandNiche ?? true;

  const paragraphPlansBySection: ParagraphPlan[][] = [];
  const knowledgePacks: KnowledgePack[] = [];

  for (const section of plan.sections) {
    const baseParagraphs = planParagraphs(section);
    const enrichedParagraphs = baseParagraphs.map((p, index) =>
      index === 0 ? enrichFirstParagraph(p, section) : p,
    );
    paragraphPlansBySection.push(enrichedParagraphs);
    knowledgePacks.push(buildKnowledgePack(section, enrichedParagraphs));
  }

  let paragraphPlans = paragraphPlansBySection.flat();
  paragraphPlans = allocateTerms(paragraphPlans, importantTerms);

  const finalPacks = allocateNoBrandMentionConstraints(knowledgePacks, allowBrandNiche);
  const graph = buildGraph(plan, plan.builtAt);
  if (opts?.researchVersion) {
    graph.researchVersion = opts.researchVersion;
  }

  const manifest = buildManifest(plan.builtAt);

  const withoutHash: Omit<CompiledWritePlan, 'planHash'> = {
    title: plan.title,
    quickAnswer: plan.quickAnswer,
    keyword: plan.keyword,
    knowledgePacks: finalPacks,
    paragraphPlans,
    graph,
    manifest,
    diagnostics: {
      warnings: [],
      infos: [],
      metrics: {
        paragraphCount: 0,
        packCount: 0,
        wordBudget: 0,
        coveragePct: 0,
        entityCoveragePct: 0,
      },
    },
  };

  const planHash = hashCompiledPlan(withoutHash);
  const compiled: CompiledWritePlan = {
    ...withoutHash,
    planHash,
  };

  const diagnostics = buildCompileDiagnostics(compiled);
  compiled.diagnostics = diagnostics;

  return compiled;
}

export function compileAndValidateWritePlan(
  plan: ArticleExecutionPlan,
  opts?: { importantTerms?: string[]; allowBrandNiche?: boolean; researchVersion?: string },
): CompileResult {
  const compiled = compileWritePlan(plan, opts);
  const validation = validateStructural(compiled);
  if (!validation.ok) {
    return { ok: false, issues: validation.issues, diagnostics: compiled.diagnostics };
  }
  return { ok: true, plan: compiled, diagnostics: compiled.diagnostics };
}
