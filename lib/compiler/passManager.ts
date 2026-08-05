import type { LexicalAst, SemanticAst } from '../ccm/types/ast';
import type { ContentIr } from '../ccm/types/ir';
import type { KgEdge, KgNode } from '../ccm/types/graph';
import type { ContentProfileId } from '../ccm/types/status';

export type DraftGraph = {
  nodes: KgNode[];
  edges: KgEdge[];
};

export type CompileContext = {
  readonly articleId: string;
  readonly profile: ContentProfileId;
  readonly contentHash: string;
  readonly dirtyBlockIds: readonly string[];
};

export type StageTrace = {
  readonly stageId: string;
  readonly ok: boolean;
  readonly note?: string;
};

export type PassInput = {
  readonly ast: LexicalAst;
  readonly semanticAst: SemanticAst;
  readonly ir: ContentIr;
  readonly draft: DraftGraph;
  readonly ctx: CompileContext;
};

export type PassOutput = {
  readonly trace: StageTrace;
};

export type CompilerPass = {
  readonly id: string;
  readonly version: string;
  readonly costClass: 'heuristic' | 'ner' | 'embedding' | 'llm' | 'hybrid';
  readonly dependsOn: readonly string[];
  readonly invalidates: readonly string[];
  run(input: PassInput): PassOutput;
};

export type PassManagerResult = {
  readonly ir: ContentIr;
  readonly draft: DraftGraph;
  readonly traces: readonly StageTrace[];
  readonly failedPassIds: readonly string[];
};

export function createDraftGraph(): DraftGraph {
  return { nodes: [], edges: [] };
}

export function createPassManager(passes: readonly CompilerPass[]) {
  const byId = new Map(passes.map((p) => [p.id, p]));

  function topo(enabled: readonly string[]): CompilerPass[] {
    const enabledSet = new Set(enabled);
    const ordered: CompilerPass[] = [];
    const visiting = new Set<string>();
    const done = new Set<string>();

    function visit(id: string): void {
      if (done.has(id)) return;
      if (visiting.has(id)) {
        throw new Error(`PassManager: cycle at ${id}`);
      }
      const pass = byId.get(id);
      if (!pass) throw new Error(`PassManager: unknown pass ${id}`);
      visiting.add(id);
      for (const dep of pass.dependsOn) visit(dep);
      visiting.delete(id);
      done.add(id);
      ordered.push(pass);
    }

    for (const id of enabledSet) visit(id);
    return ordered;
  }

  return {
    runAll(input: PassInput, enabled: readonly string[]): PassManagerResult {
      const traces: StageTrace[] = [];
      const failedPassIds: string[] = [];
      for (const pass of topo(enabled)) {
        const out = pass.run(input);
        traces.push(out.trace);
        if (!out.trace.ok) failedPassIds.push(pass.id);
      }
      return {
        ir: input.ir,
        draft: input.draft,
        traces,
        failedPassIds,
      };
    },
  };
}
