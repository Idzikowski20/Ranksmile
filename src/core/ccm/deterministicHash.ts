import { createHash } from 'crypto';
import type { LexicalAst, SemanticAst } from '@/src/core/ccm/types/ast';
import type { ContentProfileId } from '@/src/core/ccm/types/status';
import { canonicalJsonStringify } from '@/src/core/ccm/canonicalJson';

export type DeterministicHashInput = {
  readonly ast: LexicalAst;
  readonly semanticAst: SemanticAst;
  readonly rulesVersion: string;
  readonly promptVersion: string;
  readonly profile: ContentProfileId;
  readonly irVersion: string;
  readonly serpBriefHash?: string;
};

export function computeDeterministicHash(input: DeterministicHashInput): string {
  return createHash('sha256').update(canonicalJsonStringify(input)).digest('hex');
}

/** Hash of knowledge.graph identity (nodes+edges) for ActionGraph binding. */
export function computeKnowledgeGraphHash(graph: {
  readonly nodes: readonly unknown[];
  readonly edges: readonly unknown[];
}): string {
  return createHash('sha256')
    .update(canonicalJsonStringify({ nodes: graph.nodes, edges: graph.edges }))
    .digest('hex');
}
