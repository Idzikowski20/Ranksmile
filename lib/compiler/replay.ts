import { computeDeterministicHash } from '../ccm/deterministicHash';
import { parseCcm, serializeCcm } from '../ccm/serialize';
import type { CanonicalContentModel } from '../ccm/types/ccm';
import { compile, type CompileResult } from './compile';
import type { CompileOpts } from './types';

export type ReplayErrorCode = 'PARSE_FAILED' | 'HASH_MISMATCH' | 'CONTENT_HASH_MISMATCH';

export class ReplayError extends Error {
  readonly code: ReplayErrorCode;

  constructor(code: ReplayErrorCode, message: string) {
    super(message);
    this.name = 'ReplayError';
    this.code = code;
  }
}

/** Recompute hash from snapshot fields (AST + compiler versions + profile). */
export function recomputeDeterministicHash(model: CanonicalContentModel): string {
  return computeDeterministicHash({
    ast: model.ast,
    semanticAst: model.semanticAst,
    rulesVersion: model.compiler.rulesVersion,
    promptVersion: model.compiler.promptVersion,
    profile: model.profile,
    irVersion: model.compiler.irVersion,
  });
}

export type IntegrityOk = { readonly ok: true; readonly deterministicHash: string };
export type IntegrityFail = {
  readonly ok: false;
  readonly code: ReplayErrorCode;
  readonly message: string;
};

/** Check stored hash matches recomputation. Does not throw. */
export function verifyDeterministicHash(
  model: CanonicalContentModel,
): IntegrityOk | IntegrityFail {
  const recomputed = recomputeDeterministicHash(model);
  if (recomputed !== model.compiler.deterministicHash) {
    return {
      ok: false,
      code: 'HASH_MISMATCH',
      message: `stored=${model.compiler.deterministicHash} recomputed=${recomputed}`,
    };
  }
  return { ok: true, deterministicHash: recomputed };
}

export type ReplayRoundTripResult = {
  readonly model: CanonicalContentModel;
  readonly wire: string;
  readonly deterministicHash: string;
};

/**
 * Serialize → parse → verify deterministicHash (stored + recomputed).
 * Loud failure — no silent best-effort.
 */
export function replayRoundTrip(model: CanonicalContentModel): ReplayRoundTripResult {
  const wire = serializeCcm(model);
  const parsed = parseCcm(wire);
  if (!parsed) {
    throw new ReplayError('PARSE_FAILED', 'parseCcm returned null for serialized CCM');
  }
  if (parsed.contentHash !== model.contentHash) {
    throw new ReplayError(
      'CONTENT_HASH_MISMATCH',
      `contentHash round-trip diverged: ${model.contentHash} → ${parsed.contentHash}`,
    );
  }
  if (parsed.compiler.deterministicHash !== model.compiler.deterministicHash) {
    throw new ReplayError(
      'HASH_MISMATCH',
      `deterministicHash not preserved on wire: ${model.compiler.deterministicHash} → ${parsed.compiler.deterministicHash}`,
    );
  }
  const check = verifyDeterministicHash(parsed);
  if (!check.ok) {
    throw new ReplayError(check.code, check.message);
  }
  return {
    model: parsed,
    wire,
    deterministicHash: check.deterministicHash,
  };
}

/**
 * Re-compile from the same source inputs. If `expectedDeterministicHash` is set,
 * must match or throws ReplayError (History-style loud fail).
 */
export function replayCompileFromSource(
  opts: CompileOpts,
  expectedDeterministicHash?: string,
): CompileResult {
  const result = compile(opts);
  if (
    expectedDeterministicHash !== undefined &&
    result.model.compiler.deterministicHash !== expectedDeterministicHash
  ) {
    throw new ReplayError(
      'HASH_MISMATCH',
      `replay compile hash ${result.model.compiler.deterministicHash} ≠ expected ${expectedDeterministicHash}`,
    );
  }
  return result;
}
