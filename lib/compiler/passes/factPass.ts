import { buildFactNodes } from '../../ccm/builders/factBuilder';
import type { KgEdge } from '../../ccm/types/graph';
import type { CompilerPass, PassInput, PassOutput } from '../passManager';

/** Fact pass: FactNodes + uses edges (Fact Engine MVP builders). */
export const factPass: CompilerPass = {
  id: 'fact',
  version: '1',
  costClass: 'heuristic',
  dependsOn: ['entity'],
  invalidates: [],
  run(input: PassInput): PassOutput {
    const nodes = buildFactNodes(input.ir);
    input.draft.nodes.push(...nodes);
    const known = new Set(input.draft.nodes.map((n) => n.id));
    const edges: KgEdge[] = [];
    for (const f of nodes) {
      for (const eid of f.entityIds) {
        if (!known.has(eid)) continue;
        edges.push({
          id: `e_uses_${f.id}_${eid}`,
          type: 'uses',
          from: f.id,
          to: eid,
          confidence: 1,
        });
      }
    }
    input.draft.edges.push(...edges);
    return {
      trace: {
        stageId: 'fact',
        ok: true,
        note: `nodes=${nodes.length},uses=${edges.length}`,
      },
    };
  },
};
