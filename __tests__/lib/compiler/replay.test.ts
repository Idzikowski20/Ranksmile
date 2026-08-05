import { compile } from '../../../lib/compiler/compile';
import {
  ReplayError,
  recomputeDeterministicHash,
  replayCompileFromSource,
  replayRoundTrip,
  verifyDeterministicHash,
} from '../../../lib/compiler/replay';
import { parseCcm } from '../../../lib/ccm/serialize';

const FIXED_AT = '2026-08-03T08:00:00.000Z';

const baseOpts = {
  articleId: 'replay-1',
  compiledAt: FIXED_AT,
  source: { kind: 'plain' as const, text: '# Replay\n\nDeterministic body.' },
  profile: 'generic' as const,
  ccmId: 'ccm_replay',
};

describe('compiler replay', () => {
  it('serialize → parse preserves deterministicHash and recomputes equal', () => {
    const { model } = compile(baseOpts);
    const trip = replayRoundTrip(model);
    expect(trip.deterministicHash).toBe(model.compiler.deterministicHash);
    expect(trip.model.compiler.deterministicHash).toBe(model.compiler.deterministicHash);
    expect(recomputeDeterministicHash(trip.model)).toBe(model.compiler.deterministicHash);
    expect(trip.model.ast.blocks[0]?.text).toBe('Replay');
  });

  it('verifyDeterministicHash ok on fresh compile', () => {
    const { model } = compile(baseOpts);
    expect(verifyDeterministicHash(model)).toEqual({
      ok: true,
      deterministicHash: model.compiler.deterministicHash,
    });
  });

  it('replayCompileFromSource matches original hash (compiledAt ignored by hash)', () => {
    const first = compile(baseOpts);
    const second = replayCompileFromSource(
      { ...baseOpts, compiledAt: '2099-01-01T00:00:00.000Z' },
      first.model.compiler.deterministicHash,
    );
    expect(second.model.compiler.deterministicHash).toBe(first.model.compiler.deterministicHash);
    expect(second.model.compiledAt).toBe('2099-01-01T00:00:00.000Z');
  });

  it('replayCompileFromSource throws on hash mismatch', () => {
    expect(() => replayCompileFromSource(baseOpts, '0'.repeat(64))).toThrow(ReplayError);
    try {
      replayCompileFromSource(baseOpts, '0'.repeat(64));
    } catch (e) {
      expect(e).toBeInstanceOf(ReplayError);
      expect((e as ReplayError).code).toBe('HASH_MISMATCH');
    }
  });

  it('tampered wire fails parse or hash check loudly', () => {
    const { model } = compile(baseOpts);
    const { wire } = replayRoundTrip(model);
    const broken = wire.replace(model.compiler.deterministicHash, 'f'.repeat(64));
    const parsed = parseCcm(broken);
    expect(parsed).not.toBeNull();
    if (!parsed) return;
    const check = verifyDeterministicHash(parsed);
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.code).toBe('HASH_MISMATCH');
  });
});
