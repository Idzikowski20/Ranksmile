/**
 * FAQ append under the same dual-gate contract as Precision AO v4:
 * Candidate: TEMP (working+FAQ) vs WORKING
 * Final: re-score(working) vs BASELINE → FAIL = full rollback to original
 */
import { mergeFaqHtml } from '../aoFaqSection';
import { htmlMatchesNormalized } from './aoBaseline';
import type { CriticalContentMap } from './criticalContentMap';
import type { AoRejectionReason } from './aoRejectionReason';
import type { AoScores, ScoreAvailability, ScoreGatePolicy } from './aoScoreDelta';
import { makeScoreDeltaSet, STRICT_SCORE_GATE_POLICY } from './aoScoreDelta';
import {
  hasSeoContentRegression,
  isPromisingSeoContent,
  runCandidateScoreGate,
  runFinalScoreGate,
  runInvariantGate,
  runSemanticPreservationGate,
} from './aoQualityGates';

export type ScoreHtmlFn = (html: string) => { scores: AoScores; aiAvailability: ScoreAvailability };

export type GatedFaqResult = {
  html: string;
  /** FAQ merged and candidate gate passed. */
  accepted: boolean;
  /** Final gate failed → restored originalHtml. */
  rolledBack: boolean;
  scores: AoScores;
  aiAvailability: ScoreAvailability;
  deltas: ReturnType<typeof makeScoreDeltaSet>;
  reason?: AoRejectionReason;
  detail?: string;
};

export function applyGatedFaqMerge(opts: {
  originalHtml: string;
  workingHtml: string;
  faqHtml: string;
  baselineScores: AoScores;
  workingScores: AoScores;
  baselineWordCount: number;
  critical: CriticalContentMap;
  scoreHtml: ScoreHtmlFn;
  policy?: ScoreGatePolicy;
}): GatedFaqResult {
  const policy = opts.policy ?? STRICT_SCORE_GATE_POLICY;
  const tempHtml = mergeFaqHtml(opts.workingHtml, opts.faqHtml);
  if (htmlMatchesNormalized(tempHtml, opts.workingHtml)) {
    return {
      html: opts.workingHtml,
      accepted: false,
      rolledBack: false,
      scores: opts.workingScores,
      aiAvailability: 'available',
      deltas: makeScoreDeltaSet(opts.baselineScores, opts.workingScores),
    };
  }

  const inv = runInvariantGate({
    beforeHtml: opts.workingHtml,
    afterHtml: tempHtml,
    baselineWordCount: opts.baselineWordCount,
  });
  if (!inv.ok) {
    return rejectFaq(opts, inv.reason, inv.detail);
  }

  const sem = runSemanticPreservationGate({
    beforeHtml: opts.originalHtml,
    afterHtml: tempHtml,
    critical: opts.critical,
  });
  if (!sem.ok) {
    return rejectFaq(opts, sem.reason, sem.detail);
  }

  const partial = opts.scoreHtml(tempHtml);
  const tempSeoContent: AoScores = {
    seo: partial.scores.seo,
    content: partial.scores.content,
    ai: opts.workingScores.ai,
  };

  if (hasSeoContentRegression(opts.workingScores, tempSeoContent)) {
    const why = runCandidateScoreGate({
      working: opts.workingScores,
      temp: tempSeoContent,
      aiAvailability: 'unavailable',
    });
    return rejectFaq(opts, why.ok ? 'SEO_REGRESSION' : why.reason, why.ok ? undefined : why.detail);
  }

  let tempScores = tempSeoContent;
  let aiAvailability: ScoreAvailability = 'unavailable';

  if (isPromisingSeoContent(opts.workingScores, tempSeoContent)) {
    const full = opts.scoreHtml(tempHtml);
    tempScores = full.scores;
    aiAvailability = full.aiAvailability;
  } else {
    tempScores = { ...tempSeoContent, ai: opts.workingScores.ai };
    aiAvailability = 'available';
  }

  const cGate = runCandidateScoreGate({
    working: opts.workingScores,
    temp: tempScores,
    aiAvailability,
    policy,
    verifiedObjective: true, // FAQ Q&A presence verified by merge non-empty
  });
  if (!cGate.ok) {
    return rejectFaq(opts, cGate.reason, cGate.detail);
  }

  // Candidate PASS — FAQ is now working; re-score for Final gate vs ORIGINAL baseline
  const finalScored = opts.scoreHtml(tempHtml);
  const finalGate = runFinalScoreGate({
    baseline: opts.baselineScores,
    final: finalScored.scores,
    aiAvailability: finalScored.aiAvailability,
    policy,
  });

  if (!finalGate.ok) {
    return {
      html: opts.originalHtml,
      accepted: false,
      rolledBack: true,
      scores: opts.baselineScores,
      aiAvailability: 'available',
      deltas: makeScoreDeltaSet(opts.baselineScores, opts.baselineScores),
      reason: finalGate.reason,
      detail: finalGate.detail,
    };
  }

  return {
    html: tempHtml,
    accepted: true,
    rolledBack: false,
    scores: finalScored.scores,
    aiAvailability: finalScored.aiAvailability,
    deltas: makeScoreDeltaSet(opts.baselineScores, finalScored.scores, finalScored.aiAvailability),
  };
}

function rejectFaq(
  opts: {
    workingHtml: string;
    workingScores: AoScores;
    baselineScores: AoScores;
  },
  reason: AoRejectionReason,
  detail?: string,
): GatedFaqResult {
  return {
    html: opts.workingHtml,
    accepted: false,
    rolledBack: false,
    scores: opts.workingScores,
    aiAvailability: 'available',
    deltas: makeScoreDeltaSet(opts.baselineScores, opts.workingScores),
    reason,
    detail,
  };
}
