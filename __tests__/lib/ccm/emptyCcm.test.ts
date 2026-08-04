import { buildGraphIndexes } from '../../../lib/ccm/buildIndexes';
import { computeDeterministicHash } from '../../../lib/ccm/deterministicHash';
import { createEmptyCcm } from '../../../lib/ccm/emptyCcm';
import type { EvidenceSpanNode, FactNode, KgEdge } from '../../../lib/ccm/types/graph';

describe('canonical hash', () => {
  it('same hash for key-order-permuted objects', () => {
    const a = computeDeterministicHash({
      ast: { version: 1, blocks: [] },
      semanticAst: { version: 1, claims: [], discourse: [] },
      rulesVersion: '1',
      promptVersion: '1',
      profile: 'generic',
      irVersion: '1',
    });
    // rebuild with same values — canonicalJson sorts keys so field order in source is irrelevant
    const b = computeDeterministicHash({
      irVersion: '1',
      profile: 'generic',
      promptVersion: '1',
      rulesVersion: '1',
      semanticAst: { discourse: [], claims: [], version: 1 },
      ast: { blocks: [], version: 1 },
    });
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });
});

describe('buildGraphIndexes', () => {
  it('empty graph passes validation', () => {
    const idx = buildGraphIndexes([], []);
    expect(idx.byId.size).toBe(0);
  });

  it('throws on edge to missing node', () => {
    expect(() =>
      buildGraphIndexes([], [
        { id: 'e1', type: 'uses', from: 'missing', to: 'also', confidence: 1 },
      ]),
    ).toThrow(/edge\.from missing/);
  });

  it('throws on duplicate entity canonicalName', () => {
    const a = {
      id: 'ent1',
      kind: 'entity' as const,
      canonicalName: 'Apple',
      aliases: [],
      mentionCount: 1,
      importance: 'critical' as const,
      confidence: 1,
      status: 'covered' as const,
    };
    const b = { ...a, id: 'ent2' };
    expect(() => buildGraphIndexes([a, b], [])).toThrow(/duplicate entity canonicalName/);
  });

  it('throws on orphan evidence_span', () => {
    const ev: EvidenceSpanNode = {
      id: 'ev1',
      kind: 'evidence_span',
      blockId: 'b1',
      startOffset: 0,
      endOffset: 3,
      snippet: '2014',
      evidenceKind: 'date',
      confidence: 1,
      status: 'covered',
    };
    expect(() => buildGraphIndexes([ev], [])).toThrow(/orphan evidence_span/);
  });

  it('indexes supportedBy evidence under fact', () => {
    const fact: FactNode = {
      id: 'f1',
      kind: 'fact',
      statement: 'x',
      subject: 's',
      predicate: 'p',
      object: 'o',
      entityIds: [],
      importance: 'critical',
      confidence: 1,
      status: 'covered',
      verification: 'asserted',
    };
    const ev: EvidenceSpanNode = {
      id: 'ev1',
      kind: 'evidence_span',
      blockId: 'b1',
      startOffset: 0,
      endOffset: 1,
      snippet: 'x',
      evidenceKind: 'context',
      confidence: 1,
      status: 'covered',
    };
    const edge: KgEdge = {
      id: 'e1',
      type: 'supportedBy',
      from: 'f1',
      to: 'ev1',
      confidence: 1,
    };
    const idx = buildGraphIndexes([fact, ev], [edge]);
    expect(idx.evidenceByFactId.get('f1')).toEqual(['ev1']);
  });
});

describe('createEmptyCcm', () => {
  it('requires compiledAt and does not invent wall clock', () => {
    const ccm = createEmptyCcm({
      articleId: '0',
      contentHash: '0'.repeat(64),
      compiledAt: '2026-08-02T00:00:00.000Z',
      ccmId: 'ccm_golden',
    });
    expect(ccm.compiledAt).toBe('2026-08-02T00:00:00.000Z');
    expect(ccm.compiler.deterministicHash).toHaveLength(64);
  });
});
