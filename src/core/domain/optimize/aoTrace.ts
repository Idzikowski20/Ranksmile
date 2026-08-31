import type { AoScores, AoScoreDeltaSet } from '@/src/core/domain/optimize/aoScoreDelta';
import type { AoRejectionReason } from '@/src/core/domain/optimize/aoRejectionReason';

export type AoTraceStep =
  | 'baseline'
  | 'intent_analysis'
  | 'critical_content'
  | 'target_selection'
  | 'edit_plan'
  | 'candidate_generation'
  | 'candidate_apply'
  | 'invariant_gate'
  | 'semantic_gate'
  | 'candidate_score_gate'
  | 'rx_quality_gate'
  | 'opening_policy_enforce'
  | 'score_gate'
  | 'final_gate'
  | 'accepted'
  | 'rejected'
  | 'rollback';

export type AoTraceEvent = {
  runId: string;
  step: AoTraceStep;
  sectionId?: string;
  candidateId?: string;
  beforeHash?: string;
  afterHash?: string;
  beforeScores?: AoScores;
  afterScores?: AoScores;
  delta?: AoScoreDeltaSet;
  reason?: AoRejectionReason | string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export function createAoTrace(runId: string) {
  const events: AoTraceEvent[] = [];
  return {
    events,
    push(partial: Omit<AoTraceEvent, 'runId' | 'createdAt'> & { createdAt?: string }) {
      events.push({
        runId,
        createdAt: partial.createdAt ?? new Date().toISOString(),
        ...partial,
      });
    },
    summary() {
      return {
        eventCount: events.length,
        accepted: events.filter((e) => e.step === 'accepted').length,
        rejected: events.filter((e) => e.step === 'rejected').length,
        rollback: events.some((e) => e.step === 'rollback'),
        // Action alongside the reason: "5x CHANGE_RATIO" is unactionable without
        // knowing which edit shapes hit it.
        reasons: events
          .filter((e) => e.reason)
          .map((e) => {
            const action = (e.metadata as { action?: string } | undefined)?.action;
            const detail = (e.metadata as { detail?: string } | undefined)?.detail;
            return [e.reason, action, detail].filter(Boolean).join(' | ');
          }),
      };
    },
  };
}

export type AoTrace = ReturnType<typeof createAoTrace>;
