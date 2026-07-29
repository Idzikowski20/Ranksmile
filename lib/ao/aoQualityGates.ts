/**
 * v4 / v4.1 quality gates: invariant, semantic, candidate (TEMP vs WORKING), final (FINAL vs BASELINE).
 */
import type { CriticalContentMap } from './criticalContentMap';
import { unitSemanticallyPresent } from './criticalContentMap';
import type {
  AoScores,
  ScoreAvailability,
  ScoreGatePolicy,
  CandidateGateDecision,
} from './aoScoreDelta';
import {
  DEFAULT_SCORE_GATE_CONFIG,
  STRICT_SCORE_GATE_POLICY,
  hasSeoContentRegression,
  isPromisingSeoContent,
  makeScoreDeltaSet,
  evaluateCandidateGateDecision,
  evaluateFinalGateDecision,
  strictScoreGateRejectReason,
} from './aoScoreDelta';
import type { AoRejectionReason } from './aoRejectionReason';
import { countWordsFromHtml } from './aoBaseline';
import { runEditSafetyGate, type RejectReason } from './editSafetyGate';
import type { EditBudget } from './editBudget';
import type { ArticleIntentProfile } from './intentProfile';

export type GateResult =
  | { ok: true; detail?: string }
  | { ok: false; reason: AoRejectionReason; detail?: string };

function mapSafetyReason(r: RejectReason): AoRejectionReason {
  return r as AoRejectionReason;
}

function mapDecisionToGate(d: CandidateGateDecision): GateResult {
  if (d.decision === 'accept') return { ok: true, detail: d.reason };
  const reason: AoRejectionReason =
    d.decision === 'score_inconclusive'
      ? 'SCORE_INCONCLUSIVE'
      : d.decision === 'reject_regression'
        ? 'CONTENT_SCORE_REGRESSION'
        : d.decision === 'reject_metric_tolerance'
          ? (d.reason.includes('seo') ? 'SEO_REGRESSION' : 'AI_SEARCH_REGRESSION')
          : 'QUALITY_GATE_FAILED';
  return { ok: false, reason, detail: `${d.decision}:${d.reason}` };
}

export function runInvariantGate(opts: {
  beforeHtml: string;
  afterHtml: string;
  baselineWordCount: number;
}): GateResult {
  const afterWords = countWordsFromHtml(opts.afterHtml);
  if (afterWords < 20) {
    return { ok: false, reason: 'STRUCTURAL_REGRESSION', detail: 'article truncated' };
  }
  if (opts.baselineWordCount >= 200 && afterWords < opts.baselineWordCount * 0.6) {
    return { ok: false, reason: 'STRUCTURAL_REGRESSION', detail: 'word count collapse' };
  }
  const beforeH2 = (opts.beforeHtml.match(/<h2\b/gi) || []).length;
  const afterH2 = (opts.afterHtml.match(/<h2\b/gi) || []).length;
  if (beforeH2 >= 2 && afterH2 === 0) {
    return { ok: false, reason: 'STRUCTURAL_REGRESSION', detail: 'all H2 removed' };
  }
  return { ok: true };
}

export function runSemanticPreservationGate(opts: {
  beforeHtml: string;
  afterHtml: string;
  critical: CriticalContentMap;
}): GateResult {
  for (const def of opts.critical.definitions.filter((d) => d.importance === 'critical')) {
    if (unitSemanticallyPresent(def, opts.beforeHtml) && !unitSemanticallyPresent(def, opts.afterHtml)) {
      return { ok: false, reason: 'DEFINITION_REMOVED', detail: def.id };
    }
  }
  for (const ans of opts.critical.directAnswers.filter((d) => d.importance === 'critical')) {
    if (unitSemanticallyPresent(ans, opts.beforeHtml) && !unitSemanticallyPresent(ans, opts.afterHtml)) {
      return { ok: false, reason: 'LEAD_INTENT_LOST', detail: ans.id };
    }
  }
  for (const ent of opts.critical.keyEntities.filter((e) => e.importance === 'critical')) {
    if (!unitSemanticallyPresent(ent, opts.afterHtml)) {
      return { ok: false, reason: 'PRIMARY_ENTITY_LOST', detail: ent.text };
    }
  }
  return { ok: true };
}

export function runLocalSafetyGate(opts: {
  beforeHtml: string;
  afterHtml: string;
  budget: EditBudget;
  profile: ArticleIntentProfile;
  stepId?: string;
}): GateResult {
  const r = runEditSafetyGate(opts);
  if (r.ok) return { ok: true };
  return { ok: false, reason: mapSafetyReason(r.rejectReason), detail: r.detail };
}

/** Candidate score gate: TEMP vs WORKING. */
export function runCandidateScoreGate(opts: {
  working: AoScores;
  temp: AoScores;
  aiAvailability?: ScoreAvailability;
  minMeaningfulDelta?: number;
  policy?: ScoreGatePolicy;
  verifiedObjective?: boolean;
}): GateResult {
  // Legacy strict callers (v4 goldens) without policy
  if (!opts.policy) {
    const reason = strictScoreGateRejectReason(opts.working, opts.temp, {
      aiAvailability: opts.aiAvailability,
      minMeaningfulDelta: opts.minMeaningfulDelta ?? DEFAULT_SCORE_GATE_CONFIG.minMeaningfulDelta,
    });
    if (!reason) return { ok: true };
    return { ok: false, reason };
  }

  const decision = evaluateCandidateGateDecision(opts.working, opts.temp, {
    policy: opts.policy,
    aiAvailability: opts.aiAvailability,
    verifiedObjective: opts.verifiedObjective,
  });
  return mapDecisionToGate(decision);
}

/** Final regression gate: COMPLETE FINAL vs ORIGINAL BASELINE. */
export function runFinalScoreGate(opts: {
  baseline: AoScores;
  final: AoScores;
  aiAvailability?: ScoreAvailability;
  minMeaningfulDelta?: number;
  policy?: ScoreGatePolicy;
}): GateResult {
  const decision = evaluateFinalGateDecision(opts.baseline, opts.final, {
    policy: opts.policy ?? STRICT_SCORE_GATE_POLICY,
    aiAvailability: opts.aiAvailability ?? 'available',
  });
  if (decision.decision === 'accept') return { ok: true, detail: decision.reason };
  const mapped = mapDecisionToGate(decision);
  if (!mapped.ok && mapped.reason !== 'SCORE_INCONCLUSIVE') {
    return { ok: false, reason: 'FINAL_REGRESSION', detail: mapped.detail };
  }
  return mapped;
}

export {
  hasSeoContentRegression,
  isPromisingSeoContent,
  makeScoreDeltaSet,
  evaluateCandidateGateDecision,
  evaluateFinalGateDecision,
};
