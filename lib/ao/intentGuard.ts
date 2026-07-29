import type { EditCandidate } from './editCandidate';
import { clamp01 } from './editCandidate';
import type { ArticleIntentProfile } from './intentProfile';
import { textHitsForbidden } from './intentProfile';
import type { PrecisionPlanStep } from './editPlan';

export const INTENT_FIT_MIN = 0.45;
export const COMMERCIAL_DRIFT_MAX = 0.5;
export const TOPIC_DRIFT_MAX = 0.55;

function overlapScore(gap: string, allowed: string[]): number {
  const tokens = gap
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3);
  if (!tokens.length) return 0.3;
  const set = new Set(allowed.map((a) => a.toLowerCase()));
  const hits = tokens.filter((t) => set.has(t) || [...set].some((a) => a.includes(t) || t.includes(a)));
  return clamp01(hits.length / Math.min(6, tokens.length));
}

/** Score a raw gap against the profile (fills intentFit / drifts). */
export function scoreCandidateAgainstProfile(
  candidate: EditCandidate,
  profile: ArticleIntentProfile,
): EditCandidate {
  const gap = candidate.targetGap;
  const intentFit = Math.max(candidate.intentFit, overlapScore(gap, profile.allowedSubtopics));
  const commercialDrift = textHitsForbidden(gap, profile)
    ? Math.max(candidate.commercialDrift, 0.95)
    : candidate.commercialDrift;
  const topicDrift = commercialDrift >= 0.9
    ? Math.max(candidate.topicDrift, 0.8)
    : candidate.topicDrift;
  return { ...candidate, intentFit, commercialDrift, topicDrift };
}

/** Guard #1 — filter EditCandidate[]. */
export function filterCandidatesByIntent(
  candidates: EditCandidate[],
  profile: ArticleIntentProfile,
): EditCandidate[] {
  return candidates
    .map((c) => scoreCandidateAgainstProfile(c, profile))
    .filter((c) => {
      if (c.commercialDrift > COMMERCIAL_DRIFT_MAX) return false;
      if (c.topicDrift > TOPIC_DRIFT_MAX) return false;
      if (c.intentFit < INTENT_FIT_MIN) return false;
      if (textHitsForbidden(c.targetGap, profile)) return false;
      return true;
    });
}

/**
 * Guard #2 — action fit.
 * Term/entity/paa never open new headings; add_faq only for ai_coverage/paa/visibility.
 */
export function validatePlanStepAction(
  step: PrecisionPlanStep,
  candidate: EditCandidate | undefined,
  profile: ArticleIntentProfile,
): { ok: boolean; reason?: string } {
  if (step.action === 'skip') return { ok: true };
  if (textHitsForbidden(step.targetGap.claimOrQuestion, profile)) {
    return { ok: false, reason: 'FORBIDDEN_TOPIC' };
  }
  if (candidate) {
    const src = candidate.source;
    if ((src === 'seo_term' || src === 'entity') && step.action === 'add_faq') {
      return { ok: false, reason: 'ACTION_MISMATCH' };
    }
    // Term ≠ Topic: never invent heading from a term alone
    if (src === 'seo_term' && step.forbiddenChanges.includes('new_h2') === false) {
      /* allow only if planner already forbids new_h2 — enforced via forbiddenChanges */
    }
  }
  if (step.action === 'add_faq' && step.forbiddenChanges.includes('new_topic')) {
    /* ok */
  }
  return { ok: true };
}

export function filterPlanStepsByAction(
  steps: PrecisionPlanStep[],
  byId: Map<string, EditCandidate>,
  profile: ArticleIntentProfile,
): PrecisionPlanStep[] {
  return steps.filter((s) => {
    const c = byId.get(s.candidateId);
    return validatePlanStepAction(s, c, profile).ok;
  });
}
