/**
 * Product DTO: top ActionGraph edits for editor UI (Planner consumer surface).
 */
import type { ActionGraph, EditAction, EditActionKind } from '../ccm/types/actionGraph';

export type CcmRecommendation = {
  readonly id: string;
  readonly kind: EditActionKind;
  readonly priority: number;
  readonly promptFragment: string;
  readonly expectedImpact: number;
  readonly evidenceRequired: boolean;
};

const KIND_LABEL: Record<EditActionKind, string> = {
  add_fact: 'Add fact',
  strengthen_evidence: 'Strengthen evidence',
  cover_intent: 'Cover intent',
  answer_question: 'Answer question',
  fix_structure: 'Fix structure',
  fix_presentation: 'Fix presentation',
  resolve_conflict: 'Resolve conflict',
  dedupe_fact: 'Dedupe fact',
  refresh_outdated: 'Refresh outdated',
};

export function recommendationKindLabel(kind: EditActionKind): string {
  return KIND_LABEL[kind] ?? kind;
}

function toDto(a: EditAction): CcmRecommendation {
  return {
    id: a.id,
    kind: a.kind,
    priority: a.priority,
    promptFragment: a.promptFragment,
    expectedImpact: a.expectedImpact,
    evidenceRequired: a.evidenceRequired,
  };
}

/** Highest-priority actions first; roots preferred, then dependents. Cap for UI. */
export function summarizeRecommendations(
  actionGraph: ActionGraph | null | undefined,
  limit = 8,
): readonly CcmRecommendation[] {
  if (!actionGraph?.actions.length) return [];
  const rootSet = new Set(actionGraph.roots);
  const sorted = [...actionGraph.actions].sort((a, b) => {
    const rootDelta = (rootSet.has(b.id) ? 1 : 0) - (rootSet.has(a.id) ? 1 : 0);
    if (rootDelta !== 0) return rootDelta;
    if (b.priority !== a.priority) return b.priority - a.priority;
    return b.expectedImpact - a.expectedImpact;
  });
  return sorted.slice(0, limit).map(toDto);
}
