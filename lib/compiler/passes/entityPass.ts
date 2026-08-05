import { buildEntityNodes } from '../../ccm/builders/entityBuilder';
import type { CompilerPass, PassInput, PassOutput } from '../passManager';

/** Skeleton: EntityNodes from IR EntityCandidates. */
export const entityPass: CompilerPass = {
  id: 'entity',
  version: '0',
  costClass: 'heuristic',
  dependsOn: [],
  invalidates: [],
  run(input: PassInput): PassOutput {
    const nodes = buildEntityNodes(input.ir);
    input.draft.nodes.push(...nodes);
    return { trace: { stageId: 'entity', ok: true, note: `nodes=${nodes.length}` } };
  },
};
