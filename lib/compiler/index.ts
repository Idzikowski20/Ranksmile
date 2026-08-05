/**
 * Content Compiler (CIA) — Lexer→…→empty CCM skeleton.
 * Zone: may import lib/ccm; must not import lib/ao, lib/wie, cheerio, jsdom.
 */
export type {
  CompileOpts,
  CompileSource,
  LexToken,
  TipTapNode,
} from './types';
export { hashCompileSource } from './contentHash';
export { lex } from './lexer';
export { parseTokens } from './parser';
export { normalizeAst } from './normalizer';
export { buildSemanticAst } from './semantic';
export { buildContentIr } from './irBuilder';
export { assembleCcm } from './assemble';
export { compile, type CompileResult } from './compile';
export {
  getDependencyGraph,
  buildInvalidationGraph,
  type CompileDependencyGraph,
  type InvalidationGraph,
} from './incremental';
export {
  ReplayError,
  recomputeDeterministicHash,
  verifyDeterministicHash,
  replayRoundTrip,
  replayCompileFromSource,
  type ReplayErrorCode,
  type ReplayRoundTripResult,
} from './replay';
export {
  createPassManager,
  createDraftGraph,
  type CompilerPass,
  type PassInput,
  type PassManagerResult,
  type StageTrace,
} from './passManager';
export { entityPass } from './passes/entityPass';
export { factPass } from './passes/factPass';
export { evidencePass } from './passes/evidencePass';
export { intentPass } from './passes/intentPass';
