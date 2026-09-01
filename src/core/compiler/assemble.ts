import type { CompilerStageId } from '@/src/core/ccm/types/compilerMeta';
import { buildGraphIndexes } from '@/src/core/ccm/buildIndexes';
import { computeDeterministicHash } from '@/src/core/ccm/deterministicHash';
import { createEmptyCcm, type EmptyCcmOpts } from '@/src/core/ccm/emptyCcm';
import type { LexicalAst, SemanticAst } from '@/src/core/ccm/types/ast';
import type { CanonicalContentModel } from '@/src/core/ccm/types/ccm';
import type { ContentIr } from '@/src/core/ccm/types/ir';
import type { KgEdge, KgNode } from '@/src/core/ccm/types/graph';
import type { StageTrace } from '@/src/core/compiler/passManager';

export type AssembleInput = {
  readonly opts: EmptyCcmOpts;
  readonly ast: LexicalAst;
  readonly semanticAst: SemanticAst;
  readonly ir: ContentIr;
  readonly nodes: readonly KgNode[];
  readonly edges: readonly KgEdge[];
  readonly traces: readonly StageTrace[];
  readonly failedStages: readonly CompilerStageId[];
  readonly mode?: 'full' | 'incremental' | 'adapter';
  readonly extraNotes?: readonly string[];
};

/** Assemble CCM snapshot from pipeline stages (KG may be empty). */
export function assembleCcm(input: AssembleInput): CanonicalContentModel {
  const base = createEmptyCcm(input.opts);
  const profile = input.opts.profile ?? 'generic';
  const rulesVersion = base.compiler.rulesVersion;
  const promptVersion = base.compiler.promptVersion;
  const irVersion = base.compiler.irVersion;
  const deterministicHash = computeDeterministicHash({
    ast: input.ast,
    semanticAst: input.semanticAst,
    rulesVersion,
    promptVersion,
    profile,
    irVersion,
  });
  const indexes = buildGraphIndexes(input.nodes, input.edges);
  const notes = [
    ...base.compiler.notes.filter((n) => n !== 'empty'),
    `skeleton_traces=${input.traces.length}`,
    ...(input.extraNotes ?? []),
  ];

  return {
    ...base,
    ast: input.ast,
    semanticAst: input.semanticAst,
    ir: input.ir,
    knowledge: {
      graph: { nodes: input.nodes, edges: input.edges },
      indexes,
    },
    compiler: {
      ...base.compiler,
      deterministicHash,
      partial: input.failedStages.length > 0,
      failedStages: input.failedStages,
      notes,
      mode: input.mode ?? 'full',
      capabilities: {
        ...base.compiler.capabilities,
        ir: true,
        planner: true,
        incremental: (input.mode ?? 'full') === 'incremental',
      },
    },
  };
}
