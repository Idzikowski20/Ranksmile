/**
 * Precision AO v4 / v4.1 orchestration: dual gates, snapshots, targeting, rollback.
 * All strategies (precision|enrichment|deep_optimize) use this same engine.
 */
import { splitSections } from '@/src/infrastructure/articles/articleSections';
import type { ArticleContext } from '@/src/infrastructure/articles/articleContext';
import { computeTermUsageGaps } from '@/src/infrastructure/ao/optimizeSectionEdit';
import { liveCoverageItems } from '@/src/infrastructure/coverage/liveCoverage';
import { scoreArticleHtml } from '@/src/infrastructure/articles/scoreArticleHtml';
import { computeOverallContentScore } from '@/src/core/domain/aiScore/aiSearchScore';
import type { ScoreData } from '@/src/infrastructure/articles/contentScore';
import { buildIntentProfile, type ArticleIntentProfile } from '@/src/core/domain/optimize/intentProfile';
import { filterCandidatesByIntent, filterPlanStepsByAction } from '@/src/infrastructure/ao/intentGuard';
import { buildEditCandidates } from '@/src/infrastructure/ao/buildCandidates';
import {
  buildPrecisionEditPlan,
  buildPrecisionStepPrompt,
  buildSectionBundleSteps,
  buildTrimPrompt,
  type PrecisionPlanStep,
  type SectionBundle,
} from '@/src/infrastructure/ao/editPlan';
import { countOccurrences } from '@/src/core/domain/terms/termMatch';
import { resolveLiveAiScore } from '@/src/core/domain/optimize/liveAiScore';
import { articleWordsFromScoreData, type ArticleWords } from '@/src/core/domain/optimize/lengthBudget';
import type { EditCandidate } from '@/src/core/domain/optimize/editCandidate';
import { captureAoBaseline, countWordsFromHtml, htmlMatchesNormalized, type AoBaseline } from '@/src/infrastructure/ao/aoBaseline';
import { makeSnapshot, type AoDocumentSnapshot } from '@/src/infrastructure/ao/aoSnapshot';
import type { AoScores, ScoreAvailability, ScoreGatePolicy } from '@/src/core/domain/optimize/aoScoreDelta';
import { makeScoreDeltaSet, isOverallFlat, OVERALL_FLAT_EPSILON } from '@/src/core/domain/optimize/aoScoreDelta';
import { createAoTrace, type AoTrace } from '@/src/core/domain/optimize/aoTrace';
import { buildCriticalContentMap, type CriticalContentMap } from '@/src/core/domain/optimize/criticalContentMap';
import { selectSectionTarget } from '@/src/infrastructure/ao/sectionTargeting';
import {
  hasSeoContentRegression,
  isPromisingSeoContent,
  runCandidateScoreGate,
  runFinalScoreGate,
  runInvariantGate,
  runLocalSafetyGate,
  runSemanticPreservationGate,
} from '@/src/infrastructure/ao/aoQualityGates';
import { buildArticleSectionDiffEvents } from '@/src/infrastructure/ao/optimizeSectionEvents';
import type { SectionEvent } from '@/src/infrastructure/ao/optimizeSectionEvents';
import {
  resolveOptimizationPolicy,
  resolveOptimizationStrategy,
  type OptimizationPolicy,
  type OptimizationStrategy,
} from '@/src/infrastructure/ao/optimizationPolicy';
import { TARGET_AI, TARGET_SEO } from '@/src/core/domain/optimize/optimizeMode';
import { evaluateRxQualityGate } from '@/src/infrastructure/wie/rxQualityGate';
import { parseCompetitorSynthesis, type CompetitorSynthesis } from '@/src/infrastructure/wie/competitorSynthesis';
import type { ReaderBrief } from '@/src/core/domain/wie/readerBrief';
import { buildPolicyContext, resolvePolicyBundle, type PolicyBundle } from '@/src/infrastructure/wie/policyResolver';
import { recordPatternOutcome } from '@/src/infrastructure/wie/patternStore';
import { buildNarrativePlan, type NarrativePlan } from '@/src/infrastructure/wie/narrativePlanner';
import { bundleToExplainability } from '@/src/infrastructure/wie/explainability';
import { enforceOpeningPolicy } from '@/src/infrastructure/wie/enforceOpeningPolicy';
import {
  abVariantBHint,
  pickAbWinner,
  scoreAbVariant,
  shouldAbWriteStep,
} from '@/src/infrastructure/wie/abWrite';

export type { OptimizationStrategy, OptimizationPolicy };
export { resolveOptimizationStrategy, resolveOptimizationPolicy };

export function extractHeadings(html: string): string[] {
  return [...(html || '').matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map((m) =>
    m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
  ).filter(Boolean);
}

export function buildProfileFromContext(
  ctx: ArticleContext | null,
  html: string,
  keyword?: string,
): ArticleIntentProfile {
  const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1];
  const title = h1 ? h1.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '';
  return buildIntentProfile({
    keyword: keyword || ctx?.keyword || '',
    title,
    headings: extractHeadings(html),
    plainText: plain,
    paaQuestions: ctx?.paa || [],
  });
}

export function scoreHtmlToAoScores(opts: {
  html: string;
  scoreData: ScoreData | undefined;
  keyword: string;
  ctx: ArticleContext | null;
  latestAiFallback?: number;
}): AoScores {
  const scored = opts.scoreData
    ? scoreArticleHtml({
      html: opts.html,
      scoreData: opts.scoreData,
      keyword: opts.keyword,
      coverageItems: opts.ctx?.coverage?.items,
      answersMainQuestionEarly: !!opts.ctx?.coverage?.answersMainQuestionEarly,
    })
    : { seo: 0, ai: opts.latestAiFallback ?? 0, overall: 0 };
  const { seo } = scored;
  const ai = resolveLiveAiScore({
    live: scored.ai,
    stored: opts.ctx?.scoreData?.ai_score,
    latest: opts.latestAiFallback,
  });
  const content = computeOverallContentScore(seo, ai);
  return { seo, content, ai };
}

export function collectPrecisionCandidates(opts: {
  ctx: ArticleContext | null;
  html: string;
  profile: ArticleIntentProfile;
  /** Term targets; falls back to the context's score_data. */
  scoreData?: ScoreData;
  competitorHeadings?: string[];
  visibilityPrompts?: Array<{ id: string; label: string }>;
  defaultSectionId?: string;
  strategy?: OptimizationStrategy;
  seoStrong?: boolean;
  aiWeak?: boolean;
  rebuild?: boolean;
  plannedHeadings?: string[];
  /** Preloaded CCM → EditCandidate (from ActionGraph). */
  extraCandidates?: readonly EditCandidate[];
}): EditCandidate[] {
  const plain = opts.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const liveItems = opts.ctx?.coverage?.items?.length
    ? liveCoverageItems(opts.ctx.coverage.items, plain, opts.html)
    : [];
  const scoreData = opts.scoreData ?? opts.ctx?.scoreData ?? undefined;
  const termGaps = computeTermUsageGaps(scoreData, opts.html);
  const sections = splitSections(opts.html);
  // Terms the SERP puts in H2/H3 that none of ours carry — Surfer enriches a heading
  // with these on every run.
  const headingsText = extractHeadings(opts.html).join(' ');
  const headingTerms = (scoreData?.terms ?? [])
    .filter((t) => t.in_headings && countOccurrences(headingsText, t.term, t.term_words_regexps) === 0)
    .map((t) => t.term);
  const base = buildEditCandidates({
    profile: opts.profile,
    competitorHeadings: opts.competitorHeadings,
    termGaps,
    headingTerms,
    coverageItems: liveItems,
    paaQuestions: opts.ctx?.paa,
    visibilityPrompts: opts.visibilityPrompts,
    defaultSectionId: opts.defaultSectionId,
    sections,
    strategy: opts.strategy,
    seoStrong: opts.seoStrong,
    aiWeak: opts.aiWeak,
    rebuild: opts.rebuild,
    plannedHeadings: opts.plannedHeadings,
  });
  if (!opts.extraCandidates?.length) return base;
  const seen = new Set(base.map((c) => c.gapId));
  const merged = [...base];
  for (const c of opts.extraCandidates) {
    if (!seen.has(c.gapId)) {
      seen.add(c.gapId);
      merged.push(c);
    }
  }
  return merged;
}

/**
 * Build plan with intent-aware targeting. Uncertain targets → skip.
 */
export type PlanPrecisionResult = {
  steps: PrecisionPlanStep[];
  targeting: { skippedNoTarget: number; usedFallback: number; assigned: number };
};

export function planPrecisionStepsV4(opts: {
  candidates: EditCandidate[];
  profile: ArticleIntentProfile;
  critical: CriticalContentMap;
  html: string;
  maxSteps?: number;
  baseBudget?: import('@/src/core/domain/optimize/editBudget').EditBudget;
  articleWords?: ArticleWords;
}): PlanPrecisionResult {
  const sections = splitSections(opts.html);
  const guarded = filterCandidatesByIntent(opts.candidates, opts.profile);
  const assigned: EditCandidate[] = [];
  let skippedNoTarget = 0;
  let usedFallback = 0;
  // Terms with no section of their own rotate over the body sections instead of all
  // landing on the one best-scored fallback: 22 of them on a single section blew its
  // word and paragraph budgets and the whole bundle was thrown away.
  const bodySections = sections.filter(
    (s) => s.index > 0 && !opts.critical.commercialSections.some((c) => c.sectionId === s.id),
  );
  let rotation = 0;

  for (const c of guarded) {
    if (c.suggestedAction === 'add_missing_section' && c.targetSectionId) {
      assigned.push(c);
    } else {
      const isSeoEntity = c.source === 'seo_term' || c.source === 'entity';
      const target = selectSectionTarget({
        sections,
        candidate: c,
        critical: opts.critical,
        allowSeoEntityFallback: isSeoEntity,
      });
      if (!target) {
        skippedNoTarget += 1;
      } else {
        let { sectionId } = target;
        if (target.usedFallback) {
          usedFallback += 1;
          if (bodySections.length) {
            sectionId = bodySections[rotation % bodySections.length].id;
            rotation += 1;
          }
        }
        assigned.push({ ...c, targetSectionId: sectionId });
      }
    }
  }

  const targeting = { skippedNoTarget, usedFallback, assigned: assigned.length };
  if (!assigned.length) return { steps: [], targeting };

  // Appending steps (new sections) stay one per candidate and honour maxSteps. Every
  // other gap folds into its section's bundle: one edit per section, sections without
  // gaps untouched, never throttled by maxSteps — a 13-section article is visited
  // section by section, the way Surfer's Auto-Optimize works.
  const appending = assigned.filter((c) => c.suggestedAction === 'add_missing_section');
  const defaultSectionId = assigned[0].targetSectionId || sections[0]?.id || 'none';
  const byId = new Map(assigned.map((c) => [c.id, c]));
  const plan = buildPrecisionEditPlan({
    candidates: appending,
    profile: opts.profile,
    defaultSectionId,
    maxSteps: opts.maxSteps ?? 6,
    baseBudget: opts.baseBudget,
  });
  const bundles = buildSectionBundleSteps({
    candidates: assigned,
    sections,
    baseBudget: opts.baseBudget,
    articleWords: opts.articleWords,
  });
  const headingOf = new Map(sections.map((s) => [s.id, s.headingText]));
  const appendingSteps = filterPlanStepsByAction(plan.steps, byId, opts.profile)
    .map((s) => ({ ...s, sectionHeading: headingOf.get(s.sectionId) }));
  return {
    steps: [...appendingSteps, ...bundles],
    targeting,
  };
}

/** Model calls in flight for bundle edits. */
const PARALLEL_EDITS = 4;

function concurrencyLimiter(n: number): <T>(fn: () => Promise<T>) => Promise<T> {
  let active = 0;
  const queue: Array<() => void> = [];
  return <T>(fn: () => Promise<T>) => new Promise<T>((resolve, reject) => {
    const run = () => {
      active += 1;
      fn().then(resolve, reject).finally(() => {
        active -= 1;
        queue.shift()?.();
      });
    };
    if (active < n) run();
    else queue.push(run);
  });
}

/**
 * The step's section in the current document. Ids hash (index, heading): once a section
 * is inserted earlier, every later id changes and the heading is what still matches —
 * the second restored section of a run used to be dropped here without a trace.
 */
function findStepSection(
  sections: ReturnType<typeof splitSections>,
  step: PrecisionPlanStep,
): ReturnType<typeof splitSections>[number] | undefined {
  const byId = sections.find((s) => s.id === step.sectionId);
  if (byId) return byId;
  const heading = (step.sectionHeading ?? '').trim();
  if (!heading) return undefined;
  return sections.find((s) => s.headingText.trim() === heading);
}

/** @deprecated use planPrecisionStepsV4 */
export function planPrecisionSteps(opts: {
  candidates: EditCandidate[];
  profile: ArticleIntentProfile;
  defaultSectionId: string;
  maxSteps?: number;
}): PrecisionPlanStep[] {
  const guarded = filterCandidatesByIntent(opts.candidates, opts.profile);
  const byId = new Map(guarded.map((c) => [c.id, c]));
  const plan = buildPrecisionEditPlan({
    candidates: guarded,
    profile: opts.profile,
    defaultSectionId: opts.defaultSectionId,
    maxSteps: opts.maxSteps ?? 6,
  });
  return filterPlanStepsByAction(plan.steps, byId, opts.profile);
}

export type LlmEditFn = (prompt: string) => Promise<{ html: string; tokens: number }>;

export type ScoreHtmlFn = (html: string) => { scores: AoScores; aiAvailability: ScoreAvailability };

export type PrecisionV4Result = {
  html: string;
  changed: number;
  /** Body section edits that passed candidate gates (before final). */
  bodyAccepted: number;
  rejected: number;
  tokens: number;
  rolledBack: boolean;
  baseline: AoBaseline;
  finalScores: AoScores;
  deltas: ReturnType<typeof makeScoreDeltaSet>;
  sectionEvents: SectionEvent[];
  trace: AoTrace;
  outcome: 'improved' | 'already_optimal' | 'no_change' | 'rolled_back';
  targeting: { skippedNoTarget: number; usedFallback: number; assigned: number };
};

/**
 * Splice a step's output into the article.
 *
 * `add_missing_section` APPENDS after the anchor instead of replacing it: the model is
 * given the anchor section as context and returns only the new section, so replacing
 * would delete the anchor. This is also why the action used to be a silent no-op —
 * the model, asked to "create a new section" while holding the anchor's HTML, expanded
 * that section and the H2 count never moved.
 */
function applyStepHtml(
  working: string,
  sectionHtml: string,
  afterHtml: string,
  sectionId: string,
  action: string,
): string {
  if (action === 'add_missing_section') {
    const idx = working.indexOf(sectionHtml);
    if (idx >= 0) {
      const end = idx + sectionHtml.length;
      return `${working.slice(0, end)}
${afterHtml}${working.slice(end)}`;
    }
    return `${working}
${afterHtml}`;
  }
  return replaceSectionHtml(working, sectionHtml, afterHtml, sectionId);
}

function replaceSectionHtml(working: string, sectionHtml: string, afterHtml: string, sectionId: string): string {
  const idx = working.indexOf(sectionHtml);
  if (idx >= 0) {
    return working.slice(0, idx) + afterHtml + working.slice(idx + sectionHtml.length);
  }
  const sections = splitSections(working);
  return sections
    .map((s) => (s.id === sectionId ? afterHtml : s.html))
    .join('\n');
}

/** Deterministic objective check — never trust LLM claim alone. */
export function verifyExpectedOutcome(opts: {
  expectedOutcomeId?: string;
  gapClaim?: string;
  bundle?: SectionBundle;
  afterHtml: string;
}): boolean {
  const plain = opts.afterHtml.replace(/<[^>]+>/g, ' ').toLowerCase();
  const claimLanded = (claim: string): boolean => {
    const tokens = claim.toLowerCase().split(/\s+/).filter((w) => w.length > 4).slice(0, 4);
    if (!tokens.length) return false;
    const hits = tokens.filter((t) => plain.includes(t)).length;
    return hits >= Math.ceil(tokens.length * 0.6);
  };
  if (opts.bundle) {
    // A bundle earned its edit when at least one of its items is now in the section.
    return opts.bundle.terms.some((t) => countOccurrences(plain, t) > 0)
      || (opts.bundle.headingTerm != null && countOccurrences(plain, opts.bundle.headingTerm) > 0)
      || opts.bundle.facts.some(claimLanded);
  }
  if (opts.expectedOutcomeId?.startsWith('coverage:') || opts.expectedOutcomeId?.startsWith('section:')) {
    return claimLanded(opts.gapClaim || '');
  }
  return false;
}

/**
 * v4.1 atomic loop: same engine for precision|enrichment|deep_optimize.
 * Candidate vs WORKING; Final vs ORIGINAL BASELINE on complete HTML.
 */
export async function runPrecisionOptimizeV4(opts: {
  runId: string;
  html: string;
  ctx: ArticleContext | null;
  scoreData: ScoreData | undefined;
  keyword: string;
  latestAiFallback?: number;
  visibilityPrompts?: Array<{ id: string; label: string }>;
  /** CCM ActionGraph → candidates (backend CIA wire). */
  extraCandidates?: readonly EditCandidate[];
  /** Mode 'full': weak article — rebuild missing planned sections, generator-style. */
  rebuild?: boolean;
  /** H2 titles from the article's own content plan (score_data.content_planner_v2). */
  plannedHeadings?: string[];
  maxSteps?: number;
  policy?: OptimizationPolicy;
  /** Requested stop targets (express asks for 100); default v4.1 constants. */
  targetSeo?: number;
  targetAi?: number;
  /** Passes over the article: a second pass re-plans on the edited text and closes what
   *  the first left open, the way a second Surfer run does. Default 2. */
  maxPasses?: number;
  llmEdit: LlmEditFn;
  scoreHtml?: ScoreHtmlFn;
  signal?: AbortSignal;
}): Promise<PrecisionV4Result> {
  const trace = createAoTrace(opts.runId);
  const profile = buildProfileFromContext(opts.ctx, opts.html, opts.keyword);
  const sections0 = splitSections(opts.html);
  const critical = buildCriticalContentMap({
    html: opts.html,
    profile,
    sectionIds: sections0.map((s) => s.id),
  });

  const defaultScore: ScoreHtmlFn = (html) => ({
    scores: scoreHtmlToAoScores({
      html,
      scoreData: opts.scoreData ?? opts.ctx?.scoreData ?? undefined,
      keyword: opts.keyword,
      ctx: opts.ctx,
      latestAiFallback: opts.latestAiFallback,
    }),
    aiAvailability: 'available',
  });
  const scoreHtml = opts.scoreHtml ?? defaultScore;

  const synthesis: CompetitorSynthesis | null = opts.ctx?.competitorSynthesis
    ?? parseCompetitorSynthesis(opts.scoreData?.competitor_synthesis ?? null);
  const readerBrief: ReaderBrief | null = opts.ctx?.readerBrief ?? null;

  let policyBundle: PolicyBundle | null = null;
  let narrativePlan: NarrativePlan | null = null;
  try {
    const pctx = buildPolicyContext({
      keyword: opts.keyword || opts.ctx?.keyword || '',
      readerBrief,
      synthesis,
    });
    policyBundle = await resolvePolicyBundle({ ctx: pctx, synthesis });
    narrativePlan = buildNarrativePlan({ readerBrief, policy: policyBundle, synthesis });
    const explainability = bundleToExplainability(
      policyBundle,
      pctx,
      policyBundle.dna_ab_variant,
    );
    trace.push({
      step: 'intent_analysis',
      metadata: {
        wie_policy: true,
        dna_version: policyBundle.dna_version,
        dna_ab_variant: policyBundle.dna_ab_variant,
        dna_ab_reason: policyBundle.dna_ab_reason,
        narrative: {
          openingMove: narrativePlan.openingMove,
          beats: narrativePlan.beats.map((b) => b.role),
          ctaPlacement: narrativePlan.ctaPlacement,
        },
        explainability,
        decisions: policyBundle.decisions.map((d) => ({
          id: d.id,
          value: d.value,
          confidence: d.confidence,
          effectiveness: d.effectiveness,
          source_layer: d.source_layer,
          principle_id: d.principle_id,
          pattern_id: d.pattern_id,
          reason: d.reason,
        })),
        patternIdsUsed: policyBundle.patternIdsUsed,
      },
    });
  } catch {
    policyBundle = null;
    narrativePlan = null;
  }

  // Missing/underused NLP terms fed into every section rewrite so one edit closes several
  // term gaps (Surfer's AO injects ~28 in a run; our per-step candidates alone cap far lower).
  // Ordered by biggest shortfall; the prompt weaves only those that fit each section.
  const missingTerms = computeTermUsageGaps(opts.scoreData, opts.html)
    .filter((g) => g.status === 'missing' || g.status === 'low')
    .sort((a, b) => (b.target - b.current) - (a.target - a.current))
    .map((g) => g.term);

  const promptOpts = { synthesis, readerBrief, policy: policyBundle, narrative: narrativePlan, missingTerms };

  const originalScored = scoreHtml(opts.html);
  const original = makeSnapshot(opts.html, originalScored.scores);
  const baseline = captureAoBaseline({
    runId: opts.runId,
    html: opts.html,
    scores: original.scores,
    sectionCount: sections0.length,
  });

  const plain0 = opts.html.replace(/<[^>]+>/g, ' ');
  const live0 = opts.ctx?.coverage?.items?.length
    ? liveCoverageItems(opts.ctx.coverage.items, plain0, opts.html)
    : [];
  const uncovered0 = live0.filter((i) => !i.covered || (i.quality ?? 0) < 3).length;

  const policy = opts.policy ?? resolveOptimizationPolicy({
    scores: original.scores,
    html: opts.html,
    sectionCount: sections0.length,
    uncoveredCoverage: uncovered0,
    keyword: opts.keyword,
    plainText: plain0,
  });
  const gatePolicy: ScoreGatePolicy = policy.gate;
  const maxSteps = opts.maxSteps ?? policy.maxSteps;

  trace.push({
    step: 'baseline',
    beforeHash: original.hash,
    beforeScores: original.scores,
    afterScores: original.scores,
    metadata: { strategy: policy.strategy, maxSteps },
  });
  trace.push({ step: 'critical_content', metadata: { defs: critical.definitions.length } });

  const scoreDataForPlan = opts.scoreData ?? opts.ctx?.scoreData ?? undefined;
  // The plan is rebuilt from the document as it stands, so a later pass sees what the
  // earlier one closed and what it left open.
  const buildPlan = (docHtml: string) => {
    const candidates = collectPrecisionCandidates({
      ctx: opts.ctx,
      html: docHtml,
      profile,
      scoreData: scoreDataForPlan,
      // H2s the ranking pages share — same list the ArticleContext already loads.
      competitorHeadings: (opts.ctx?.competitors ?? [])
        .flatMap((c) => c.headings ?? [])
        .filter((h, i, all) => all.indexOf(h) === i),
      visibilityPrompts: opts.visibilityPrompts,
      strategy: policy.strategy,
      seoStrong: policy.seoStrong,
      aiWeak: policy.aiWeak,
      rebuild: opts.rebuild,
      plannedHeadings: opts.plannedHeadings,
      extraCandidates: opts.extraCandidates,
    });
    const planned = planPrecisionStepsV4({
      candidates,
      profile,
      critical,
      html: docHtml,
      maxSteps,
      baseBudget: policy.editBudget,
      articleWords: articleWordsFromScoreData(scoreDataForPlan, countWordsFromHtml(docHtml)) ?? undefined,
    });
    return { candidates, planned };
  };
  const first = buildPlan(opts.html);
  // Summed over every pass — the run's numbers, not the first plan's.
  const targetingStats = { ...first.planned.targeting };
  let { steps } = first.planned;
  trace.push({
    step: 'edit_plan',
    metadata: {
      pass: 1,
      steps: steps.length,
      candidates: first.candidates.length,
      strategy: policy.strategy,
      targeting: first.planned.targeting,
    },
  });

  let working: AoDocumentSnapshot = { ...original };
  let tokens = 0;
  let rejected = 0;
  let accepted = 0;
  let stagnation = 0;
  // A/B writing doubles the model calls on the first steps. Off unless asked for:
  // Surfer finishes a run in under a minute on one pass per section.
  let abBudgetLeft = process.env.AO_AB_WRITE === '1' ? 2 : 0;
  const STAGNATION_WINDOW = 3;
  const resolvedGapIds = new Set<string>();
  const maxPasses = Math.max(1, opts.maxPasses ?? 2);
  const targetsReached = () => (
    Math.round(working.scores.seo) >= (opts.targetSeo ?? TARGET_SEO)
    && Math.round(working.scores.ai) >= (opts.targetAi ?? TARGET_AI)
  );
  // Prefetched calls settle outside the loop body; a const holder keeps the closure honest.
  const spent = { tokens: 0 };

  type Prefetched = Map<string, Promise<{ html: string; tokens: number }>>;
  // One step: model call, gates, accept. A function, not a loop body, so its closures
  // are declared once and every early exit is a plain return.
  const runStep = async (step: PrecisionPlanStep, i: number, prefetched: Prefetched): Promise<void> => {
    if (step.gapId && resolvedGapIds.has(step.gapId)) {
      return;
    }
    if (step.gapIds?.length && step.gapIds.every((g) => resolvedGapIds.has(g))) {
      return;
    }

    const sections = splitSections(working.html);
    const section = findStepSection(sections, step);
    if (!section) {
      rejected += 1;
      trace.push({
        step: 'candidate_apply',
        candidateId: step.candidateId,
        sectionId: step.sectionId,
        reason: 'SECTION_NOT_FOUND',
        metadata: { action: step.action, detail: step.sectionHeading || step.sectionId },
      });
      return;
    }

    const runAb = shouldAbWriteStep({
      action: step.action,
      stepIndex: i,
      abBudgetLeft,
    });

    const promptA = buildPrecisionStepPrompt(step, section.html, promptOpts);
    let afterA = section.html;
    try {
      const pre = prefetched.get(step.id);
      const result = pre ? await pre : await opts.llmEdit(promptA);
      if (!pre) tokens += result.tokens;
      afterA = result.html || section.html;
    } catch (err) {
      rejected += 1;
      // On the record: nine of eleven steps once vanished here with no trace at all.
      trace.push({
        step: 'candidate_apply',
        candidateId: step.candidateId,
        sectionId: step.sectionId,
        reason: 'LLM_ERROR',
        metadata: { action: step.action, detail: err instanceof Error ? err.message : String(err) },
      });
      return;
    }

    let afterSection = afterA;
    let abMeta: Record<string, unknown> | undefined;

    if (runAb) {
      abBudgetLeft -= 1;
      const opening = policyBundle?.decisions.find((d) => d.id === 'opening')?.value;
      const promptB = buildPrecisionStepPrompt(step, section.html, {
        ...promptOpts,
        variantHint: abVariantBHint(opening),
      });
      let afterB = section.html;
      try {
        const resultB = await opts.llmEdit(promptB);
        tokens += resultB.tokens;
        afterB = resultB.html || section.html;
      } catch {
        afterB = afterA;
      }

      const scoreSection = (sectionHtml: string): AoScores => {
        const fullHtml = applyStepHtml(working.html, section.html, sectionHtml, section.id, step.action);
        return scoreHtml(fullHtml).scores;
      };

      const scoredA = scoreAbVariant({
        label: 'A',
        sectionHtml: afterA,
        scores: scoreSection(afterA),
        working: working.scores,
        action: step.action,
        synthesis,
      });
      const scoredB = scoreAbVariant({
        label: 'B',
        sectionHtml: afterB,
        scores: scoreSection(afterB),
        working: working.scores,
        action: step.action,
        synthesis,
      });
      const { winner, loser, margin } = pickAbWinner(scoredA, scoredB);
      afterSection = winner.html;
      abMeta = {
        ab_write: true,
        winner: winner.label,
        loser: loser.label,
        margin,
        winner_quality: winner.quality,
        loser_quality: loser.quality,
        winner_rxOk: winner.rxOk,
        loser_rxOk: loser.rxOk,
      };
      trace.push({
        step: 'candidate_apply',
        candidateId: step.candidateId,
        sectionId: step.sectionId,
        metadata: abMeta,
      });
    }

    let tempHtml = applyStepHtml(working.html, section.html, afterSection, section.id, step.action);
    if (tempHtml.trim() === working.html.trim()) {
      trace.push({
        step: 'candidate_apply',
        candidateId: step.candidateId,
        sectionId: step.sectionId,
        reason: 'NO_CHANGE',
        metadata: { action: step.action, detail: 'model returned the section unchanged' },
      });
      return;
    }

    const gateEdit = (html: string) => runLocalSafetyGate({
      // An appended section is measured against the empty string, not the anchor: the
      // anchor is untouched, so comparing "anchor" to "new section" reported the whole
      // anchor as deleted and the whole new section as added.
      beforeHtml: step.action === 'add_missing_section' ? '' : section.html,
      afterHtml: html,
      budget: step.budget,
      profile,
      stepId: step.id,
    });
    let safety = gateEdit(afterSection);
    if (!safety.ok && step.bundle && safety.reason === 'WORD_BUDGET') {
      // One trim pass instead of a reject — see buildTrimPrompt.
      try {
        const addedWords = Math.max(0, countWordsFromHtml(afterSection) - countWordsFromHtml(section.html));
        const trimmed = await opts.llmEdit(buildTrimPrompt({ step, addedWords, editedHtml: afterSection }));
        tokens += trimmed.tokens;
        if (trimmed.html) {
          afterSection = trimmed.html;
          tempHtml = applyStepHtml(working.html, section.html, afterSection, section.id, step.action);
          safety = gateEdit(afterSection);
          trace.push({
            step: 'candidate_apply',
            candidateId: step.candidateId,
            sectionId: step.sectionId,
            metadata: { action: step.action, trimmed: true, ok: safety.ok, addedWords },
          });
        }
      } catch {
        /* keep the first verdict */
      }
    }
    if (!safety.ok) {
      rejected += 1;
      trace.push({
        step: 'candidate_score_gate',
        candidateId: step.candidateId,
        sectionId: step.sectionId,
        reason: `SAFETY_${safety.reason}`,
        metadata: { action: step.action, detail: safety.detail },
      });
      return;
    }

    const inv = runInvariantGate({
      beforeHtml: working.html,
      afterHtml: tempHtml,
      baselineWordCount: baseline.wordCount,
    });
    if (!inv.ok) {
      rejected += 1;
      trace.push({
        step: 'invariant_gate',
        candidateId: step.candidateId,
        sectionId: step.sectionId,
        reason: 'INVARIANT',
        metadata: { action: step.action },
      });
      return;
    }

    const sem = runSemanticPreservationGate({
      beforeHtml: original.html,
      afterHtml: tempHtml,
      critical,
    });
    if (!sem.ok) {
      rejected += 1;
      trace.push({
        step: 'semantic_gate',
        candidateId: step.candidateId,
        sectionId: step.sectionId,
        reason: 'SEMANTIC',
        metadata: { action: step.action },
      });
      return;
    }

    const partial = scoreHtml(tempHtml);
    const tempSeoContent: AoScores = {
      seo: partial.scores.seo,
      content: partial.scores.content,
      ai: working.scores.ai,
    };

    // Skip AI spend on clear SEO/overall regression vs working (strict early)
    if (gatePolicy.mode === 'strict_non_regression' && hasSeoContentRegression(working.scores, tempSeoContent)) {
      rejected += 1;
      trace.push({
        step: 'candidate_score_gate',
        candidateId: step.candidateId,
        sectionId: step.sectionId,
        reason: 'SEO_REGRESSION',
        metadata: { action: step.action },
      });
      return;
    }

    let aiAvailability: ScoreAvailability = 'unavailable';
    let tempScores = tempSeoContent;
    if (isPromisingSeoContent(working.scores, tempSeoContent) || gatePolicy.mode === 'aggressive') {
      const full = scoreHtml(tempHtml);
      tempScores = full.scores;
      aiAvailability = full.aiAvailability;
    } else {
      tempScores = { ...tempSeoContent, ai: working.scores.ai };
      aiAvailability = 'available';
    }

    const verifiedObjective = verifyExpectedOutcome({
      expectedOutcomeId: step.expectedOutcomeId,
      gapClaim: step.targetGap.claimOrQuestion,
      bundle: step.bundle,
      // The edited section, not the whole article: a term already present elsewhere
      // must not vouch for a section that did not gain it.
      afterHtml: afterSection,
    });

    const cGate = runCandidateScoreGate({
      working: working.scores,
      temp: tempScores,
      aiAvailability,
      policy: gatePolicy,
      verifiedObjective,
    });
    if (!cGate.ok) {
      rejected += 1;
      trace.push({
        step: 'candidate_score_gate',
        candidateId: step.candidateId,
        reason: cGate.reason,
        beforeScores: working.scores,
        afterScores: tempScores,
        delta: makeScoreDeltaSet(working.scores, tempScores, aiAvailability),
      });
      return;
    }

    const rx = evaluateRxQualityGate({
      // The whole article after the edit, not the fragment. An appended section is a
      // fresh 100+ word block that carries no expert marker of its own, so judging it
      // in isolation vetoed every rebuilt section on "no_expert_voice" — while the
      // article it joins may carry that voice throughout. Replacing steps see the same
      // document they always did, since the fragment is spliced in either way.
      afterHtml: tempHtml,
      beforeHtml: working.html,
      action: step.action,
      synthesis,
    });
    if (!rx.ok) {
      rejected += 1;
      trace.push({
        step: 'rx_quality_gate',
        candidateId: step.candidateId,
        reason: 'RX_QUALITY_VETO',
        metadata: {
          decision: 'veto',
          rxReason: rx.reason,
          detail: rx.detail,
          source_layer: 'wie_rx_gate',
          patternIdsUsed: policyBundle?.patternIdsUsed,
          ...abMeta,
        },
        beforeScores: working.scores,
        afterScores: tempScores,
        delta: makeScoreDeltaSet(working.scores, tempScores, aiAvailability),
      });
      if (policyBundle?.patternIdsUsed.length) {
        recordPatternOutcome({ patternIds: policyBundle.patternIdsUsed, success: false }).catch(() => undefined);
      }
      return;
    }

    const next = makeSnapshot(tempHtml, tempScores);
    const flat = isOverallFlat(working.scores, next.scores, OVERALL_FLAT_EPSILON);
    if (flat && !verifiedObjective) {
      // Should have been rejected; belt-and-suspenders
      rejected += 1;
      return;
    }
    if (flat) stagnation += 1;
    else stagnation = 0;

    trace.push({
      step: 'accepted',
      candidateId: step.candidateId,
      sectionId: step.sectionId,
      beforeHash: working.hash,
      afterHash: next.hash,
      beforeScores: working.scores,
      afterScores: next.scores,
      delta: makeScoreDeltaSet(working.scores, next.scores, aiAvailability),
      metadata: {
        patternIdsUsed: policyBundle?.patternIdsUsed,
        wie_policy_opening: policyBundle?.decisions.find((d) => d.id === 'opening')?.value,
        ...abMeta,
      },
    });
    working = next;
    accepted += 1;
    if (step.gapId) resolvedGapIds.add(step.gapId);
    for (const g of step.gapIds ?? []) resolvedGapIds.add(g);
    if (policyBundle?.patternIdsUsed.length) {
      recordPatternOutcome({ patternIds: policyBundle.patternIdsUsed, success: true }).catch(() => undefined);
    }

    // Invalidate remaining steps with same gapId
    steps = steps.filter((s, idx) => idx <= i || !s.gapId || s.gapId !== step.gapId);
  };

  for (let pass = 1; pass <= maxPasses; pass += 1) {
    if (pass > 1) {
      if (opts.signal?.aborted || targetsReached() || stagnation >= STAGNATION_WINDOW) break;
      const again = buildPlan(working.html);
      steps = again.planned.steps.filter((s) => !(s.gapIds?.length && s.gapIds.every((g) => resolvedGapIds.has(g))));
      targetingStats.skippedNoTarget += again.planned.targeting.skippedNoTarget;
      targetingStats.usedFallback += again.planned.targeting.usedFallback;
      targetingStats.assigned += again.planned.targeting.assigned;
      trace.push({
        step: 'edit_plan',
        metadata: { pass, steps: steps.length, candidates: again.candidates.length, targeting: again.planned.targeting },
      });
      if (!steps.length) break;
    }
    const acceptedBeforePass = accepted;

    // Bundle edits touch disjoint sections, so their model calls run concurrently; only the
    // gates stay sequential. Sequential calls made a 6-section run take 150 s.
    const prefetched: Prefetched = new Map();
    {
      const limit = concurrencyLimiter(PARALLEL_EDITS);
      const passSections = splitSections(working.html);
      for (const s of steps.filter((x) => x.bundle)) {
        const target = findStepSection(passSections, s);
        if (target) {
          const prompt = buildPrecisionStepPrompt(s, target.html, promptOpts);
          const p = limit(() => opts.llmEdit(prompt)).then((r) => {
            spent.tokens += r.tokens;
            return r;
          });
          // Awaited in the loop; the noop catch only keeps an early break from surfacing as an
          // unhandled rejection.
          p.catch(() => undefined);
          prefetched.set(s.id, p);
        }
      }
    }

    for (let i = 0; i < steps.length; i += 1) {
      if (opts.signal?.aborted) break;

      const step = steps[i];
      // Early stop: targets reached. The caller's targets, not the constants — express
      // requests 100 and used to be silently stopped at the default 90/85. Structural
      // repair is exempt: a missing planned section is missing whatever the score says
      // (its terms live on in the neighbours), and those steps are ordered first.
      if (
        step.action !== 'add_missing_section'
      && Math.round(working.scores.seo) >= (opts.targetSeo ?? TARGET_SEO)
      && Math.round(working.scores.ai) >= (opts.targetAi ?? TARGET_AI)
      ) {
        trace.push({ step: 'edit_plan', metadata: { stop: 'targets_reached' } });
        break;
      }
      if (stagnation >= STAGNATION_WINDOW) {
        trace.push({ step: 'edit_plan', metadata: { stop: 'stagnation' } });
        break;
      }

      await runStep(step, i, prefetched);
    }

    // A pass that accepted nothing has nothing left to build on.
    if (accepted === acceptedBeforePass) break;
  }
  tokens += spent.tokens;

  // ── Opening policy enforcement (WIE Expected → Observed) ────────
  const expectedOpening = policyBundle?.decisions.find((d) => d.id === 'opening')?.value;
  if (expectedOpening === 'problem_first') {
    const beforeEnfScores = working.scores;
    const enf = await enforceOpeningPolicy({
      html: working.html,
      expectedOpening,
      keyword: opts.keyword,
      llmEdit: async (prompt) => {
        const r = await opts.llmEdit(prompt);
        return { html: r.html || '', tokens: r.tokens };
      },
    });
    tokens += enf.tokens;
    if (enf.attempted) {
      const enfScored = scoreHtml(enf.html);
      const enfSnap = makeSnapshot(enf.html, enfScored.scores);
      const okScores = !hasSeoContentRegression(beforeEnfScores, enfSnap.scores)
        || enfSnap.scores.seo >= beforeEnfScores.seo - 2;
      if (okScores) {
        working = enfSnap;
        if (enf.method !== 'none') accepted += 1;
      }
      trace.push({
        step: 'opening_policy_enforce',
        reason: enf.violated ? 'OPENING_POLICY_STILL_VIOLATED' : 'OPENING_POLICY_FIXED',
        metadata: {
          before: enf.before,
          after: enf.after,
          method: enf.method,
          violated: enf.violated,
          expected: expectedOpening,
          accepted: okScores,
        },
        beforeScores: beforeEnfScores,
        afterScores: enfSnap.scores,
        delta: makeScoreDeltaSet(beforeEnfScores, enfSnap.scores, enfScored.aiAvailability),
      });
      if (enf.violated && policyBundle?.patternIdsUsed.length) {
        recordPatternOutcome({ patternIds: policyBundle.patternIdsUsed, success: false }).catch(() => undefined);
      }
    }
  }

  // FINAL: re-score complete working.html vs ORIGINAL baseline
  const finalScored = scoreHtml(working.html);
  const finalSnap = makeSnapshot(working.html, finalScored.scores);
  const finalGate = runFinalScoreGate({
    baseline: baseline.scores,
    final: finalSnap.scores,
    aiAvailability: finalScored.aiAvailability,
    policy: gatePolicy,
  });

  if (!finalGate.ok) {
    trace.push({
      step: 'rollback',
      reason: finalGate.reason,
      beforeScores: finalSnap.scores,
      afterScores: baseline.scores,
      delta: makeScoreDeltaSet(baseline.scores, finalSnap.scores, finalScored.aiAvailability),
      metadata: { detail: finalGate.detail },
    });

    return {
      html: original.html,
      changed: 0,
      bodyAccepted: 0,
      rejected: rejected + accepted,
      tokens,
      rolledBack: true,
      baseline,
      finalScores: baseline.scores,
      deltas: makeScoreDeltaSet(baseline.scores, baseline.scores),
      sectionEvents: [],
      trace,
      outcome: 'rolled_back',
      targeting: targetingStats,
    };
  }

  const changed = accepted > 0 && !htmlMatchesNormalized(original.html, finalSnap.html);
  const sectionEvents = changed
    ? buildArticleSectionDiffEvents(original.html, finalSnap.html)
    : [];

  const deltas = makeScoreDeltaSet(baseline.scores, finalSnap.scores, finalScored.aiAvailability);
  let outcome: PrecisionV4Result['outcome'] = 'no_change';
  if (changed) outcome = 'improved';
  else if (steps.length === 0) outcome = 'already_optimal';
  trace.push({
    step: 'final_gate',
    beforeScores: baseline.scores,
    afterScores: finalSnap.scores,
    delta: deltas,
  });

  return {
    html: finalSnap.html,
    changed: changed ? sectionEvents.filter((e) => e.changed).length || 1 : 0,
    bodyAccepted: accepted,
    rejected,
    tokens,
    rolledBack: false,
    baseline,
    finalScores: finalSnap.scores,
    deltas,
    sectionEvents,
    trace,
    outcome,
    targeting: targetingStats,
  };
}

/**
 * Legacy v3 apply — kept for tests; prefer runPrecisionOptimizeV4.
 * No sections[0] fallback: missing section → skip.
 */
export async function applyPrecisionPlan(opts: {
  html: string;
  steps: PrecisionPlanStep[];
  profile: ArticleIntentProfile;
  llmEdit: LlmEditFn;
  signal?: AbortSignal;
}): Promise<{ html: string; changed: number; rejected: number; tokens: number }> {
  let working = opts.html;
  let changed = 0;
  let rejected = 0;
  let tokens = 0;

  const applyStep = async (step: PrecisionPlanStep): Promise<void> => {
    const sections = splitSections(working);
    const section = sections.find((s) => s.id === step.sectionId);
    if (!section) {
      rejected += 1;
      return;
    }

    const prompt = buildPrecisionStepPrompt(step, section.html);
    let afterHtml = section.html;
    try {
      const result = await opts.llmEdit(prompt);
      tokens += result.tokens;
      afterHtml = result.html || section.html;
    } catch {
      rejected += 1;
      return;
    }

    const gate = runLocalSafetyGate({
      beforeHtml: section.html,
      afterHtml,
      budget: step.budget,
      profile: opts.profile,
      stepId: step.id,
    });
    if (!gate.ok) {
      rejected += 1;
      return;
    }
    if (afterHtml.trim() === section.html.trim()) return;

    working = replaceSectionHtml(working, section.html, afterHtml, section.id);
    changed += 1;
  };

  for (const step of opts.steps) {
    if (opts.signal?.aborted) break;
    await applyStep(step);
  }

  return { html: working, changed, rejected, tokens };
}
