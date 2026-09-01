/**
 * Content Compiler (CIA) — Lexer→…→empty CCM skeleton.
 * Zone: may import lib/ccm; must not import lib/ao, lib/wie, cheerio, jsdom.
 */
export type {
  CompileOpts,
  CompileSource,
  LexToken,
  TipTapNode,
} from '@/src/core/compiler/types';
export { hashCompileSource } from '@/src/core/compiler/contentHash';
export { lex } from '@/src/core/compiler/lexer';
export { parseTokens } from '@/src/core/compiler/parser';
export { normalizeAst } from '@/src/core/compiler/normalizer';
export { buildSemanticAst } from '@/src/core/compiler/semantic';
export { buildContentIr } from '@/src/core/compiler/irBuilder';
export { assembleCcm } from '@/src/core/compiler/assemble';
export { compile, type CompileResult } from '@/src/core/compiler/compile';
export {
  getDependencyGraph,
  buildInvalidationGraph,
  type CompileDependencyGraph,
  type InvalidationGraph,
} from '@/src/core/compiler/incremental';
export {
  ReplayError,
  recomputeDeterministicHash,
  verifyDeterministicHash,
  replayRoundTrip,
  replayCompileFromSource,
  type ReplayErrorCode,
  type ReplayRoundTripResult,
} from '@/src/core/compiler/replay';
export {
  createPassManager,
  createDraftGraph,
  type CompilerPass,
  type PassInput,
  type PassManagerResult,
  type StageTrace,
} from '@/src/core/compiler/passManager';
export { entityPass } from '@/src/core/compiler/passes/entityPass';
export { factPass } from '@/src/core/compiler/passes/factPass';
export { evidencePass } from '@/src/core/compiler/passes/evidencePass';
export { intentPass } from '@/src/core/compiler/passes/intentPass';
