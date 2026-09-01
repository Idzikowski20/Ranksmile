/**
 * EditCandidate = WHAT / WHY (planner chooses WHERE/HOW).
 * Stable gapId for dedupe. Priority P0–P6 domain tiers.
 */
export type EditCandidateSource =
  | 'seo_term'
  | 'ai_coverage'
  | 'paa'
  | 'visibility'
  | 'entity'
  | 'section_quality'
  | 'critical'
  | 'intent';

/** P0 Critical … P6 Style — tier beats expected score impact. */
export type EditCandidatePriorityTier = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type EditCandidatePriority = 'critical' | 'recommended' | 'optional';

export type ExpectedOutcome =
  | { type: 'coverage_item_resolved'; id: string }
  | { type: 'definition_present'; id: string }
  | { type: 'direct_answer_present'; id: string }
  | { type: 'entity_present'; id: string }
  | { type: 'section_quality_improved'; id: string }
  | { type: 'faq_gap_resolved'; id: string }
  | { type: 'generic'; id: string };

export type EditCandidate = {
  id: string;
  /** Stable semantic gap identity for dedupe (e.g. coverage:question:slug). */
  gapId: string;
  source: EditCandidateSource;
  targetSectionId?: string;
  targetGap: string;
  reason: string;
  expectedOutcome: ExpectedOutcome;
  /** Domain priority tier P0–P6. */
  priorityTier: EditCandidatePriorityTier;
  intentFit: number;
  topicDrift: number;
  commercialDrift: number;
  factualRisk: number;
  /** Legacy priority label. */
  priority: EditCandidatePriority;
  /** Suggested action for planner. */
  suggestedAction?: string;
};

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function priorityToTier(p: EditCandidatePriority): EditCandidatePriorityTier {
  if (p === 'critical') return 0;
  if (p === 'recommended') return 2;
  return 5;
}

export function makeCandidate(
  partial: Omit<EditCandidate, 'intentFit' | 'topicDrift' | 'commercialDrift' | 'factualRisk' | 'gapId' | 'reason' | 'expectedOutcome' | 'priorityTier'> & {
    intentFit?: number;
    topicDrift?: number;
    commercialDrift?: number;
    factualRisk?: number;
    gapId?: string;
    reason?: string;
    expectedOutcome?: ExpectedOutcome;
    priorityTier?: EditCandidatePriorityTier;
  },
): EditCandidate {
  const gapId = partial.gapId || `${partial.source}:${partial.id}`;
  return {
    id: partial.id,
    gapId,
    source: partial.source,
    targetSectionId: partial.targetSectionId,
    targetGap: partial.targetGap,
    reason: partial.reason || partial.targetGap,
    expectedOutcome: partial.expectedOutcome || { type: 'generic', id: gapId },
    priorityTier: partial.priorityTier ?? priorityToTier(partial.priority),
    priority: partial.priority,
    suggestedAction: partial.suggestedAction,
    intentFit: clamp01(partial.intentFit ?? 0.5),
    topicDrift: clamp01(partial.topicDrift ?? 0),
    commercialDrift: clamp01(partial.commercialDrift ?? 0),
    factualRisk: clamp01(partial.factualRisk ?? 0.2),
  };
}

/** Sort: tier asc, then stable section order, then id. */
export function sortCandidatesByPriority(cands: EditCandidate[]): EditCandidate[] {
  return [...cands].sort((a, b) => {
    if (a.priorityTier !== b.priorityTier) return a.priorityTier - b.priorityTier;
    const sa = a.targetSectionId || '';
    const sb = b.targetSectionId || '';
    if (sa !== sb) return sa.localeCompare(sb);
    return a.gapId.localeCompare(b.gapId);
  });
}
