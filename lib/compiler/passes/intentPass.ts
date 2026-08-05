import { buildIntentNodes } from '../../ccm/builders/intentBuilder';
import type { KgEdge } from '../../ccm/types/graph';
import type { CompilerPass, PassInput, PassOutput } from '../passManager';

/** Intent pass: IntentNodes + parentOf edges; facts in section support intent. */
export const intentPass: CompilerPass = {
  id: 'intent',
  version: '0',
  costClass: 'heuristic',
  dependsOn: ['evidence'],
  invalidates: [],
  run(input: PassInput): PassOutput {
    const nodes = buildIntentNodes(input.ir);
    const withChildren = nodes.map((n) => ({
      ...n,
      parentId: nodes.some((parent) => parent.id === n.parentId) ? n.parentId : undefined,
      childIds: nodes.filter((c) => c.parentId === n.id).map((c) => c.id),
    }));
    input.draft.nodes.push(...withChildren);

    const edges: KgEdge[] = [];
    for (const n of withChildren) {
      if (!n.parentId) continue;
      edges.push({
        id: `e_parent_${n.parentId}_${n.id}`,
        type: 'parentOf',
        from: n.parentId,
        to: n.id,
        confidence: 1,
      });
    }

    // Fact in block after an intent heading → supports (same sectionId / block)
    const intentsByBlock = new Map<string, string>();
    for (const c of input.ir.candidates) {
      if (c.kind !== 'intent') continue;
      for (const b of c.blockIds) intentsByBlock.set(b, c.id);
    }
    // Map paragraph blocks to nearest preceding heading intent via AST order in IR paragraphs
    let currentIntent: string | undefined;
    for (const p of input.ir.paragraphs) {
      const intentId = intentsByBlock.get(p.blockId);
      if (intentId) {
        currentIntent = intentId;
        continue;
      }
      if (!currentIntent) continue;
      for (const n of input.draft.nodes) {
        if (n.kind !== 'fact' || n.sectionId !== p.blockId) continue;
        edges.push({
          id: `e_supports_${n.id}_${currentIntent}`,
          type: 'supports',
          from: n.id,
          to: currentIntent,
          confidence: 0.7,
        });
      }
    }

    input.draft.edges.push(...edges);
    return {
      trace: {
        stageId: 'intent',
        ok: true,
        note: `nodes=${withChildren.length},edges=${edges.length}`,
      },
    };
  },
};
