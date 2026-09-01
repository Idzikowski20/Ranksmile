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
import { evaluateRxQualityGate } from '../wie/rxQualityGate';
import { parseCompetitorSynthesis, type CompetitorSynthesis } from '../wie/competitorSynthesis';
import type { ReaderBrief } from '../wie/readerBrief';
import { buildPolicyContext, resolvePolicyBundle, type PolicyBundle } from '../wie/policyResolver';
import { recordPatternOutcome } from '../wie/patternStore';
import { buildNarrativePlan, type NarrativePlan } from '../wie/narrativePlanner';
import { bundleToExplainability } from '../wie/explainability';
import { enforceOpeningPolicy } from '../wie/enforceOpeningPolicy';
import {
  abVariantBHint,
  pickAbWinner,
  scoreAbVariant,
  shouldAbWriteStep,
} from '../wie/abWrite';

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
  /** Preloaded CCM → EditCandidate (from ActionGraph). */
  extraCandidates?: readonly EditCandidate[];
}): EditCandidate[] {
  const plain = opts.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const liveItems = opts.ctx?.coverage?.items?.length
    ? liveCoverageItems(opts.ctx.coverage.items, plain, opts.html)
    : [];
  const termGaps = computeTermUsageGaps(opts.ctx?.scoreData ?? undefined, opts.html);
  const sections = splitSections(opts.html);
  const base = buildEditCandidates({
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
  if (!opts.extraCandidates?.length) return base;
  const seen = new Set(base.map((c) => c.gapId));
  const merged = [...base];
  for (const c of opts.extraCandidates) {
    if (seen.has(c.gapId)) continue;
    seen.add(c.gapId);
    merged.push(c);
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
  baseBudget?: import('./editBudget').EditBudget;
}): PlanPrecisionResult {
  const sections = splitSections(opts.html);
  const guarded = filterCandidatesByIntent(opts.candidates, opts.profile);
  const assigned: EditCandidate[] = [];
  let skippedNoTarget = 0;
  let usedFallback = 0;

  for (const c of guarded) {
    if (c.suggestedAction === 'add_missing_section' && c.targetSectionId) {
      assigned.push(c);
      continue;
    }
    const isSeoEntity = c.source === 'seo_term' || c.source === 'entity';
    const target = selectSectionTarget({
      sections,
      candidate: c,
      critical: opts.critical,
      allowSeoEntityFallback: isSeoEntity,
    });
    if (!target) {
      skippedNoTarget += 1;
      continue;
    }
    if (target.usedFallback) usedFallback += 1;
    assigned.push({ ...c, targetSectionId: target.sectionId });
  }

  const targeting = { skippedNoTarget, usedFallback, assigned: assigned.length };
  if (!assigned.length) return { steps: [], targeting };

  const defaultSectionId = assigned[0].targetSectionId || sections[0]?.id || 'none';
  const byId = new Map(assigned.map((c) => [c.id, c]));
  const plan = buildPrecisionEditPlan({
    candidates: assigned,
    profile: opts.profile,
    defaultSectionId,
    maxSteps: opts.maxSteps ?? 6,
    baseBudget: opts.baseBudget,
  });
  return {
    steps: filterPlanStepsByAction(plan.steps, byId, opts.profile),
    targeting,
  };
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
  /** CCM ActionGraph → candidates (backend CIA wire). */
  extraCandidates?: readonly EditCandidate[];
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

  const synthesis: CompetitorSynthesis | null =
    opts.ctx?.competitorSynthesis
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

  const promptOpts = { synthesis, readerBrief, policy: policyBundle, narrative: narrativePlan };

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
    extraCandidates: opts.extraCandidates,
  });
  const planned = planPrecisionStepsV4({
    candidates,
    profile,
    critical,
    html: opts.html,
    maxSteps,
    baseBudget: policy.editBudget,
  });
  const targetingStats = planned.targeting;
  let steps = planned.steps;
  trace.push({
    step: 'edit_plan',
    metadata: {
      steps: steps.length,
      candidates: candidates.length,
      strategy: policy.strategy,
      targeting: targetingStats,
    },
  });

  let working: AoDocumentSnapshot = { ...original };
  let tokens = 0;
  let rejected = 0;
  let accepted = 0;
  let stagnation = 0;
  let abBudgetLeft = 2;
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

    const runAb = shouldAbWriteStep({
      action: step.action,
      stepIndex: i,
      abBudgetLeft,
    });

    const promptA = buildPrecisionStepPrompt(step, section.html, promptOpts);
    let afterA = section.html;
    try {
      const result = await opts.llmEdit(promptA);
      tokens += result.tokens;
      afterA = result.html || section.html;
    } catch {
      rejected += 1;
      continue;
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
        const fullHtml = replaceSectionHtml(working.html, section.html, sectionHtml, section.id);
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

    const rx = evaluateRxQualityGate({
      afterHtml: afterSection,
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
        void recordPatternOutcome({ patternIds: policyBundle.patternIdsUsed, success: false });
      }
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
      metadata: {
        patternIdsUsed: policyBundle?.patternIdsUsed,
        wie_policy_opening: policyBundle?.decisions.find((d) => d.id === 'opening')?.value,
        ...abMeta,
      },
    });
    working = next;
    accepted += 1;
    if (step.gapId) resolvedGapIds.add(step.gapId);
    if (policyBundle?.patternIdsUsed.length) {
      void recordPatternOutcome({ patternIds: policyBundle.patternIdsUsed, success: true });
    }

    // Invalidate remaining steps with same gapId
    steps = steps.filter((s, idx) => idx <= i || !s.gapId || s.gapId !== step.gapId);
  }

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
        void recordPatternOutcome({ patternIds: policyBundle.patternIdsUsed, success: false });
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
    outcome: changed ? 'improved' : (steps.length === 0 ? 'already_optimal' : 'no_change'),
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
