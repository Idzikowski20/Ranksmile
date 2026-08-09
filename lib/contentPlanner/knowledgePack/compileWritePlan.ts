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
import { validateCompiledWritePlan } from './validateCompiledWritePlan';
import { buildKnowledgePack } from './sectionPlanner';
import { planParagraphs } from './paragraphPlanner';
import { allocateTerms } from './termAllocator';
import { allocateNoBrandMentionConstraints } from './constraintAllocator';
import { planFlow } from './flowPlanner';

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

/**
 * The only domains a generated article may cite with a live link. Claim sources are
 * mostly competitor pages, and linking a competitor from our article is the one thing
 * strictly worse than no link — the reference article links statutes and public
 * institutions, never rivals.
 *
 * ponytail: a hand-kept allowlist; an authority outside it simply is not linked.
 * Upgrade path is a domain-authority score on the source records.
 */
// The academic branch is spelled out rather than `\.edu(\.[a-z]{2,})?$`: that form
// also matched `evil.edu.com` and `evil.edu.io`, which are ordinary commercial
// registrations, not universities — anyone could buy one and be cited as an authority.
const AUTHORITY_HOST = /(^|\.)(gov\.pl|gov|sejm\.gov\.pl|isap\.sejm\.gov\.pl|policja\.gov\.pl|prokuratura\.gov\.pl|lexlege\.pl|europa\.eu|cert\.pl|uodo\.gov\.pl|edu\.pl)$|\.edu$/i;

/**
 * Matched against the parsed hostname, never the raw URL: `https://evil.com/lexlege.pl`
 * and `https://evil.com?x=.gov.pl` both contain an allowlisted string but resolve to a
 * hostile host. Only https URLs qualify — a claim source we would put in front of a
 * reader must be one we would send them to.
 */
function isAuthorityUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && AUTHORITY_HOST.test(u.hostname);
  } catch {
    return false;
  }
}

/** Deterministic per-URL id, so paragraph refs and the graph agree without ordering. */
function sourceIdFor(url: string): string {
  return `src-${createHash('sha1').update(url).digest('hex').slice(0, 8)}`;
}

function buildGraph(plan: ArticleExecutionPlan, builtAt: string): KnowledgeGraphSnapshot {
  const claims: Claim[] = [];
  const facts: Fact[] = [];
  const entities: Entity[] = [];
  const questions: Question[] = [];
  const sources: KnowledgeGraphSnapshot['sources'] = [];
  const sourceIdByUrl = new Map<string, string>();

  for (const section of plan.sections) {
    for (const c of section.claims) {
      let sourceId: string | null = null;
      for (const src of c.sources ?? []) {
        if (!src.url || !isAuthorityUrl(src.url)) continue;
        let id = sourceIdByUrl.get(src.url);
        if (!id) {
          id = sourceIdFor(src.url);
          sourceIdByUrl.set(src.url, id);
          let domain = '';
          try {
            domain = new URL(src.url).hostname;
          } catch { /* keep empty — the URL is still linkable text */ }
          sources.push({
            id,
            url: src.url,
            domain,
            authority: src.confidence ?? 0.5,
            language: '',
            title: src.label || domain || src.url,
            summary: '',
            claimIds: [c.id],
            entityIds: [],
            quotes: [],
          });
        } else {
          const existing = sources.find((s) => s.id === id);
          if (existing && !existing.claimIds.includes(c.id)) existing.claimIds.push(c.id);
        }
        sourceId = sourceId ?? id;
      }
      claims.push({
        id: c.id,
        text: c.statement,
        sourceId,
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
    sources,
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
  const sourceRefs = [...new Set(section.claims
    .flatMap((c) => c.sources ?? [])
    .filter((src) => src.url && isAuthorityUrl(src.url))
    .map((src) => sourceIdFor(src.url)))]
    .map((sourceId) => ({ sourceId }));
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
    sources: [...paragraph.sources, ...sourceRefs],
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

  const flow = planFlow(knowledgePacks, paragraphPlansBySection.flat());
  const paragraphPlans = allocateTerms(flow.paragraphs, importantTerms);
  const finalPacks = allocateNoBrandMentionConstraints(flow.packs, allowBrandNiche);
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
  const validation = validateCompiledWritePlan(compiled);
  if (!validation.ok) {
    return { ok: false, issues: validation.issues, diagnostics: compiled.diagnostics };
  }
  return { ok: true, plan: compiled, diagnostics: compiled.diagnostics };
}
