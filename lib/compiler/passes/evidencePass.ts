import {
  applyWeakFactStatus,
  buildEvidenceForFacts,
} from '../../ccm/builders/evidenceBuilder';
import { isFactNode } from '../../ccm/types/graph';
import type { CompilerPass, PassInput, PassOutput } from '../passManager';

/** Evidence pass: EvidenceSpan + supportedBy; unsupported facts → weak. */
export const evidencePass: CompilerPass = {
  id: 'evidence',
  version: '0',
  costClass: 'heuristic',
  dependsOn: ['fact'],
  invalidates: [],
  run(input: PassInput): PassOutput {
    const facts = input.draft.nodes.filter(isFactNode);
    const { evidence, edges, weakFactIds } = buildEvidenceForFacts(facts, input.ast);
    const weak = new Set(weakFactIds);

    input.draft.nodes = input.draft.nodes.map((n) =>
      isFactNode(n) ? applyWeakFactStatus(n, weak) : n,
    );
    input.draft.nodes.push(...evidence);
    input.draft.edges.push(...edges);

    return {
      trace: {
        stageId: 'evidence',
        ok: true,
        note: `evidence=${evidence.length},weak=${weakFactIds.length}`,
      },
    };
  },
};
