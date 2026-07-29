/**
 * Precision AO v4 / v4.1 orchestration: dual gates, snapshots, targeting, rollback.
 * All strategies (precision|enrichment|deep_optimize) use this same engine.
 */
import { splitSections } from '../articleSections';
import type { ArticleContext } from '../articleContext';
import { computeTermUsageGaps } from '../optimizeSectionEdit';
import { liveCoverageItems } from '../liveCoverage';
import { scoreArticleHtml } from '../scoreArticleHtml';
import { computeOverallContentScore } from '../aiSearchScore';
import type { ScoreData } from '../contentScore';
import { buildIntentProfile, type ArticleIntentProfile } from './intentProfile';
import { filterCandidatesByIntent, filterPlanStepsByAction } from './intentGuard';
import { buildEditCandidates } from './buildCandidates';
import { buildPrecisionEditPlan, buildPrecisionStepPrompt, type PrecisionPlanStep } from './editPlan';
import type { EditCandidate } from './editCandidate';
import { captureAoBaseline, htmlMatchesNormalized, type AoBaseline } from './aoBaseline';
import { makeSnapshot, type AoDocumentSnapshot } from './aoSnapshot';
import type { AoScores, ScoreAvailability, ScoreGatePolicy } from './aoScoreDelta';
import { makeScoreDeltaSet, isOverallFlat, OVERALL_FLAT_EPSILON } from './aoScoreDelta';
import { createAoTrace, type AoTrace } from './aoTrace';
import { buildCriticalContentMap, type CriticalContentMap } from './criticalContentMap';
import { selectSectionTarget } from './sectionTargeting';
import {
  hasSeoContentRegression,
  isPromisingSeoContent,
  runCandidateScoreGate,
  runFinalScoreGate,
  runInvariantGate,
  runLocalSafetyGate,
  runSemanticPreservationGate,
} from './aoQualityGates';
import { buildArticleSectionDiffEvents } from '../optimizeSectionEvents';
import type { SectionEvent } from '../optimizeSectionEvents';
import {
  resolveOptimizationPolicy,
  resolveOptimizationStrategy,
  type OptimizationPolicy,
  type OptimizationStrategy,
} from './optimizationPolicy';
import { TARGET_AI, TARGET_SEO } from '../optimizeMode';

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
): ArticleIntentProfile {
  const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1];
  const title = h1 ? h1.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '';
  return buildIntentProfile({
    keyword: ctx?.keyword || '',
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
  const seo = scored.seo;
  const ai = Math.max(scored.ai, opts.latestAiFallback ?? 0, opts.ctx?.scoreData?.ai_score ?? 0);
  const content = computeOverallContentScore(seo, ai);
  return { seo, content, ai };
}

export function collectPrecisionCandidates(opts: {
  ctx: ArticleContext | null;
  html: string;
  profile: ArticleIntentProfile;
  visibilityPrompts?: Array<{ id: string; label: string }>;
  defaultSectionId?: string;
  strategy?: OptimizationStrategy;
  seoStrong?: boolean;
  aiWeak?: boolean;
}): EditCandidate[] {
  const plain = opts.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const liveItems = opts.ctx?.coverage?.items?.length
    ? liveCoverageItems(opts.ctx.coverage.items, plain, opts.html)
    : [];
  const termGaps = computeTermUsageGaps(opts.ctx?.scoreData ?? undefined, opts.html);
  const sections = splitSections(opts.html);
  return buildEditCandidates({
    profile: opts.profile,
    termGaps,
    coverageItems: liveItems,
    paaQuestions: opts.ctx?.paa,
    visibilityPrompts: opts.visibilityPrompts,
    defaultSectionId: opts.defaultSectionId,
    sections,
    strategy: opts.strategy,
    seoStrong: opts.seoStrong,
    aiWeak: opts.aiWeak,
  });
}

/**
 * Build plan with intent-aware targeting. Uncertain targets → skip.
 */
export function planPrecisionStepsV4(opts: {
  candidates: EditCandidate[];
  profile: ArticleIntentProfile;
  critical: CriticalContentMap;
  html: string;
  maxSteps?: number;
  baseBudget?: import('./editBudget').EditBudget;
}): PrecisionPlanStep[] {
  const sections = splitSections(opts.html);
  const guarded = filterCandidatesByIntent(opts.candidates, opts.profile);
  const assigned: EditCandidate[] = [];

  for (const c of guarded) {
    if (c.suggestedAction === 'add_missing_section' && c.targetSectionId) {
      assigned.push(c);
      continue;
    }
    const target = selectSectionTarget({ sections, candidate: c, critical: opts.critical });
    if (!target) continue;
    assigned.push({ ...c, targetSectionId: target.sectionId });
  }

  if (!assigned.length) return [];

  const defaultSectionId = assigned[0].targetSectionId || sections[0]?.id || 'none';
  const byId = new Map(assigned.map((c) => [c.id, c]));
  const plan = buildPrecisionEditPlan({
    candidates: assigned,
    profile: opts.profile,
    defaultSectionId,
    maxSteps: opts.maxSteps ?? 6,
    baseBudget: opts.baseBudget,
  });
  return filterPlanStepsByAction(plan.steps, byId, opts.profile);
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
  rejected: number;
  tokens: number;
  rolledBack: boolean;
  baseline: AoBaseline;
  finalScores: AoScores;
  deltas: ReturnType<typeof makeScoreDeltaSet>;
  sectionEvents: SectionEvent[];
  trace: AoTrace;
  outcome: 'improved' | 'already_optimal' | 'no_change' | 'rolled_back';
};

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
  afterHtml: string;
}): boolean {
  const plain = opts.afterHtml.replace(/<[^>]+>/g, ' ').toLowerCase();
  const claim = (opts.gapClaim || '').toLowerCase();
  if (opts.expectedOutcomeId?.startsWith('coverage:') || opts.expectedOutcomeId?.startsWith('section:')) {
    const tokens = claim.split(/\s+/).filter((w) => w.length > 4).slice(0, 4);
    if (!tokens.length) return false;
    const hits = tokens.filter((t) => plain.includes(t)).length;
    return hits >= Math.ceil(tokens.length * 0.6);
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
  maxSteps?: number;
  policy?: OptimizationPolicy;
  llmEdit: LlmEditFn;
  scoreHtml?: ScoreHtmlFn;
  signal?: AbortSignal;
}): Promise<PrecisionV4Result> {
  const trace = createAoTrace(opts.runId);
  const profile = buildProfileFromContext(opts.ctx, opts.html);
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

  const candidates = collectPrecisionCandidates({
    ctx: opts.ctx,
    html: opts.html,
    profile,
    visibilityPrompts: opts.visibilityPrompts,
    strategy: policy.strategy,
    seoStrong: policy.seoStrong,
    aiWeak: policy.aiWeak,
  });
  let steps = planPrecisionStepsV4({
    candidates,
    profile,
    critical,
    html: opts.html,
    maxSteps,
    baseBudget: policy.editBudget,
  });
  trace.push({
    step: 'edit_plan',
    metadata: { steps: steps.length, candidates: candidates.length, strategy: policy.strategy },
  });

  let working: AoDocumentSnapshot = { ...original };
  let tokens = 0;
  let rejected = 0;
  let accepted = 0;
  let stagnation = 0;
  const STAGNATION_WINDOW = 3;
  const resolvedGapIds = new Set<string>();

  for (let i = 0; i < steps.length; i++) {
    if (opts.signal?.aborted) break;

    // Early stop: targets reached
    if (
      Math.round(working.scores.seo) >= TARGET_SEO
      && Math.round(working.scores.ai) >= TARGET_AI
    ) {
      trace.push({ step: 'edit_plan', metadata: { stop: 'targets_reached' } });
      break;
    }
    if (stagnation >= STAGNATION_WINDOW) {
      trace.push({ step: 'edit_plan', metadata: { stop: 'stagnation' } });
      break;
    }

    const step = steps[i];
    if (step.gapId && resolvedGapIds.has(step.gapId)) {
      continue;
    }

    const sections = splitSections(working.html);
    const section = sections.find((s) => s.id === step.sectionId);
    if (!section) {
      rejected += 1;
      continue;
    }

    const prompt = buildPrecisionStepPrompt(step, section.html);
    let afterSection = section.html;
    try {
      const result = await opts.llmEdit(prompt);
      tokens += result.tokens;
      afterSection = result.html || section.html;
    } catch {
      rejected += 1;
      continue;
    }

    const tempHtml = replaceSectionHtml(working.html, section.html, afterSection, section.id);
    if (tempHtml.trim() === working.html.trim()) continue;

    const safety = runLocalSafetyGate({
      beforeHtml: section.html,
      afterHtml: afterSection,
      budget: step.budget,
      profile,
      stepId: step.id,
    });
    if (!safety.ok) {
      rejected += 1;
      continue;
    }

    const inv = runInvariantGate({
      beforeHtml: working.html,
      afterHtml: tempHtml,
      baselineWordCount: baseline.wordCount,
    });
    if (!inv.ok) {
      rejected += 1;
      continue;
    }

    const sem = runSemanticPreservationGate({
      beforeHtml: original.html,
      afterHtml: tempHtml,
      critical,
    });
    if (!sem.ok) {
      rejected += 1;
      continue;
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
      continue;
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
      afterHtml: tempHtml,
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
      continue;
    }

    const next = makeSnapshot(tempHtml, tempScores);
    const flat = isOverallFlat(working.scores, next.scores, OVERALL_FLAT_EPSILON);
    if (flat && !verifiedObjective) {
      // Should have been rejected; belt-and-suspenders
      rejected += 1;
      continue;
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
    });
    working = next;
    accepted += 1;
    if (step.gapId) resolvedGapIds.add(step.gapId);

    // Invalidate remaining steps with same gapId
    steps = steps.filter((s, idx) => idx <= i || !s.gapId || s.gapId !== step.gapId);
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
      rejected: rejected + accepted,
      tokens,
      rolledBack: true,
      baseline,
      finalScores: baseline.scores,
      deltas: makeScoreDeltaSet(baseline.scores, baseline.scores),
      sectionEvents: [],
      trace,
      outcome: 'rolled_back',
    };
  }

  const changed = accepted > 0 && !htmlMatchesNormalized(original.html, finalSnap.html);
  const sectionEvents = changed
    ? buildArticleSectionDiffEvents(original.html, finalSnap.html, {
      focus: 'ai-coverage',
      mode: 'less',
      reason: 'Precision section optimization',
    })
    : [];

  const deltas = makeScoreDeltaSet(baseline.scores, finalSnap.scores, finalScored.aiAvailability);
  trace.push({
    step: 'final_gate',
    beforeScores: baseline.scores,
    afterScores: finalSnap.scores,
    delta: deltas,
  });

  return {
    html: finalSnap.html,
    changed: changed ? sectionEvents.filter((e) => e.changed).length || 1 : 0,
    rejected,
    tokens,
    rolledBack: false,
    baseline,
    finalScores: finalSnap.scores,
    deltas,
    sectionEvents,
    trace,
    outcome: changed ? 'improved' : (steps.length === 0 ? 'already_optimal' : 'no_change'),
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

  for (const step of opts.steps) {
    if (opts.signal?.aborted) break;
    const sections = splitSections(working);
    const section = sections.find((s) => s.id === step.sectionId);
    if (!section) {
      rejected += 1;
      continue;
    }

    const prompt = buildPrecisionStepPrompt(step, section.html);
    let afterHtml = section.html;
    try {
      const result = await opts.llmEdit(prompt);
      tokens += result.tokens;
      afterHtml = result.html || section.html;
    } catch {
      rejected += 1;
      continue;
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
      continue;
    }
    if (afterHtml.trim() === section.html.trim()) continue;

    working = replaceSectionHtml(working, section.html, afterHtml, section.id);
    changed += 1;
  }

  return { html: working, changed, rejected, tokens };
}
