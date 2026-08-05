import type { CanonicalContentModel } from '../ccm/types/ccm';
import type { CompilerStageId } from '../ccm/types/compilerMeta';
import { hashCompileSource } from './contentHash';
import { lex } from './lexer';
import { parseTokens } from './parser';
import { normalizeAst } from './normalizer';
import { buildSemanticAst } from './semantic';
import { buildContentIr } from './irBuilder';
import { assembleCcm } from './assemble';
import {
  createDraftGraph,
  createPassManager,
  type PassManagerResult,
  type StageTrace,
} from './passManager';
import { entityPass } from './passes/entityPass';
import { factPass } from './passes/factPass';
import { evidencePass } from './passes/evidencePass';
import { intentPass } from './passes/intentPass';
import {
  buildInvalidationGraph,
  getDependencyGraph,
  type CompileDependencyGraph,
  type InvalidationGraph,
} from './incremental';
import { applyConstraintStrip, runConstraints } from '../ccm/constraintEngine';
import type { CompileOpts } from './types';

export type CompileResult = {
  readonly model: CanonicalContentModel;
  readonly traces: readonly StageTrace[];
  readonly passResult: PassManagerResult;
  readonly dependencyGraph: CompileDependencyGraph;
  readonly invalidationGraph: InvalidationGraph | null;
  /** True when previous snapshot hash matched — returned previous model. */
  readonly noop: boolean;
};

const DEFAULT_PASSES = [entityPass, factPass, evidencePass, intentPass] as const;
const ALL_ENABLED: readonly CompilerStageId[] = [
  'entity',
  'fact',
  'evidence',
  'intent',
];

function asFailedStages(ids: readonly string[]): readonly CompilerStageId[] {
  const allowed = new Set<string>(ALL_ENABLED);
  return ids.filter((id): id is CompilerStageId => allowed.has(id));
}

/**
 * Content Compiler:
 * Lexer → Parser → Normalizer → Semantic → IR →
 * PassManager(entity→fact→evidence→intent) → CCM.
 * Incremental: invalidation graph + pass subset; still re-lexes full source (MVP).
 */
export function compile(opts: CompileOpts): CompileResult {
  const mode = opts.mode ?? 'full';
  const contentHash = hashCompileSource(opts.source);
  const dirtyBlockIds = opts.dirtyBlockIds ?? [];

  if (
    mode === 'incremental' &&
    opts.previous &&
    opts.previous.contentHash === contentHash &&
    dirtyBlockIds.length === 0
  ) {
    const dependencyGraph = getDependencyGraph(opts.previous);
    return {
      model: opts.previous,
      traces: [{ stageId: 'noop', ok: true, note: 'identical contentHash' }],
      passResult: {
        ir: opts.previous.ir,
        draft: {
          nodes: [...opts.previous.knowledge.graph.nodes],
          edges: [...opts.previous.knowledge.graph.edges],
        },
        traces: [],
        failedPassIds: [],
      },
      dependencyGraph,
      invalidationGraph: null,
      noop: true,
    };
  }

  const tokens = lex(opts.source);
  const ast = normalizeAst(parseTokens(tokens));
  const semanticAst = buildSemanticAst(ast);
  const ir = buildContentIr(ast, semanticAst, contentHash);

  const profile = opts.profile ?? 'generic';
  let enabled: readonly CompilerStageId[] = ALL_ENABLED;
  let invalidationGraph: InvalidationGraph | null = null;
  const extraNotes: string[] = [];

  if (mode === 'incremental' && opts.previous && dirtyBlockIds.length > 0) {
    invalidationGraph = buildInvalidationGraph(opts.previous, dirtyBlockIds);
    const passSet = new Set(invalidationGraph.dirtyPassIds);
    enabled = ALL_ENABLED.filter((id) => passSet.has(id));
    if (enabled.length === 0) enabled = ALL_ENABLED;
    extraNotes.push(
      `incremental_dirty_blocks=${dirtyBlockIds.length}`,
      `incremental_passes=${enabled.join(',')}`,
    );
  }

  const draft = createDraftGraph();
  const pm = createPassManager(DEFAULT_PASSES);
  const passResult = pm.runAll(
    {
      ast,
      semanticAst,
      ir,
      draft,
      ctx: {
        articleId: opts.articleId,
        profile,
        contentHash,
        dirtyBlockIds,
      },
    },
    enabled,
  );

  const assembled = assembleCcm({
    opts: {
      articleId: opts.articleId,
      contentHash,
      compiledAt: opts.compiledAt,
      profile,
      ccmId: opts.ccmId,
      version: opts.version,
      locale: opts.locale,
      compilerId: opts.compilerId,
    },
    ast,
    semanticAst,
    ir,
    nodes: passResult.draft.nodes,
    edges: passResult.draft.edges,
    traces: passResult.traces,
    failedStages: asFailedStages(passResult.failedPassIds),
    mode,
    extraNotes,
  });

  const constraintReport = runConstraints(assembled);
  const model =
    constraintReport.warningCount > 0 || constraintReport.errorCount > 0
      ? applyConstraintStrip(assembled, constraintReport)
      : assembled;

  const dependencyGraph = getDependencyGraph(model);
  if (!invalidationGraph && dirtyBlockIds.length > 0) {
    invalidationGraph = buildInvalidationGraph(model, dirtyBlockIds);
  }

  return {
    model,
    traces: passResult.traces,
    passResult,
    dependencyGraph,
    invalidationGraph,
    noop: false,
  };
}
