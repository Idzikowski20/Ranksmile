/**
 * Map CCM ActionGraph recommendations → AO EditCandidate (backend AO wire).
 * Uses source `ai_coverage` so existing planner/gates stay unchanged.
 */
import { makeCandidate, type EditCandidate } from '../ao/editCandidate';
import type { CcmRecommendation } from './ccmRecommendations';

export type CcmToEditCandidatesOpts = {
  readonly defaultSectionId?: string;
  readonly limit?: number;
};

export function ccmRecommendationsToEditCandidates(
  recs: readonly CcmRecommendation[],
  opts: CcmToEditCandidatesOpts = {},
): EditCandidate[] {
  const limit = opts.limit ?? 8;
  return recs.slice(0, limit).map((r) => {
    const priority: EditCandidate['priority'] =
      r.priority >= 8 ? 'critical' : r.priority >= 3 ? 'recommended' : 'optional';
    const priorityTier: 0 | 1 | 2 | 5 =
      priority === 'critical' ? 0 : r.evidenceRequired ? 1 : priority === 'recommended' ? 2 : 5;
    return makeCandidate({
      id: `ccm-${r.id}`,
      gapId: `ccm:rec:${r.id}`,
      source: 'ai_coverage',
      targetSectionId: opts.defaultSectionId,
      targetGap: r.promptFragment,
      reason: `CCM ${r.kind}: ${r.promptFragment}`,
      expectedOutcome: { type: 'generic', id: `ccm:rec:${r.id}` },
      priority,
      priorityTier,
      suggestedAction:
        r.kind === 'strengthen_evidence' || r.kind === 'add_fact'
          ? 'add_facts'
          : 'improve_direct_answer',
      intentFit: 0.62,
      factualRisk: r.evidenceRequired ? 0.35 : 0.2,
    });
  });
}
