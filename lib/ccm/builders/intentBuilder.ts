import type { ContentIr, IntentCandidate } from '../types/ir';
import type { IntentNode } from '../types/graph';

function isIntentCandidate(c: ContentIr['candidates'][number]): c is IntentCandidate {
  return c.kind === 'intent';
}

/** Map IR IntentCandidates → IntentNodes (heading-derived tree stubs). */
export function buildIntentNodes(ir: ContentIr): readonly IntentNode[] {
  const intents = ir.candidates.filter(isIntentCandidate);
  const sorted = [...intents].sort((a, b) => a.priority - b.priority);
  return sorted.map((c, i) => {
    const parent = i > 0 ? sorted[0] : undefined;
    return {
      id: c.id,
      kind: 'intent' as const,
      label: c.label,
      userGoal: c.userGoal ?? c.label,
      queryVariants: [c.label],
      priority: c.priority,
      parentId: c.parentCandidateId ?? (parent && c.priority > 0 ? parent.id : undefined),
      childIds: [],
      importance: c.priority === 0 ? ('critical' as const) : ('recommended' as const),
      confidence: c.confidence,
      status: 'covered' as const,
      primary: c.priority === 0,
    };
  });
}
