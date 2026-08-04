import { createEmptyCcm } from '../../../lib/ccm/emptyCcm';
import type { CanonicalContentModel } from '../../../lib/ccm/types/ccm';
import type { GraphIndexes } from '../../../lib/ccm/types/graph';

describe('ccm envelope', () => {
  it('empty CCM has schemaVersion 1, immutable, compilerId', () => {
    const ccm: CanonicalContentModel = createEmptyCcm({
      articleId: 'a1',
      contentHash: '0'.repeat(64),
      compiledAt: '2026-08-02T00:00:00.000Z',
    });
    expect(ccm.schemaVersion).toBe(1);
    expect(ccm.immutable).toBe(true);
    expect(ccm.compiler.compilerId).toBe('cia-v1');
    expect(ccm.knowledge.indexes.byId).toBeInstanceOf(Map);
  });

  it('GraphIndexes fields are ReadonlyMap', () => {
    const ccm = createEmptyCcm({
      articleId: 'a1',
      contentHash: '0'.repeat(64),
      compiledAt: '2026-08-02T00:00:00.000Z',
    });
    const idx: GraphIndexes = ccm.knowledge.indexes;
    expect(typeof idx.byId.get).toBe('function');
    expect(typeof idx.entityByCanonical.get).toBe('function');
  });
});
