import { createEmptyCcm } from '../../../lib/ccm/emptyCcm';
import { parseCcm, serializeCcm } from '../../../lib/ccm/serialize';
import { buildEntityNodes, buildFactNodes, buildIntentNodes } from '../../../lib/ccm/builders';

describe('serialize / parseCcm', () => {
  it('roundtrips empty CCM and rebuilds Maps', () => {
    const ccm = createEmptyCcm({
      articleId: '0',
      contentHash: '0'.repeat(64),
      compiledAt: '2026-08-02T00:00:00.000Z',
      ccmId: 'ccm_golden',
      version: 1,
      profile: 'generic',
    });
    const json = serializeCcm(ccm);
    const back = parseCcm(json);
    expect(back).not.toBeNull();
    expect(back?.ccmId).toBe('ccm_golden');
    expect(back?.compiler.compilerId).toBe('cia-v1');
    expect(back?.knowledge.indexes.byId).toBeInstanceOf(Map);
    expect(back?.knowledge.indexes.byId.size).toBe(0);
  });

  it('returns null on invalid JSON', () => {
    expect(parseCcm('{')).toBeNull();
    expect(parseCcm('{"schemaVersion":2}')).toBeNull();
  });

  it('empty CCM golden snapshot', () => {
    const ccm = createEmptyCcm({
      articleId: '0',
      contentHash: '0'.repeat(64),
      compiledAt: '2026-08-02T00:00:00.000Z',
      ccmId: 'ccm_golden',
      version: 1,
      profile: 'generic',
    });
    expect(serializeCcm(ccm)).toMatchSnapshot();
  });

  it('empty builders return []', () => {
    const ir = createEmptyCcm({
      articleId: '0',
      contentHash: '0'.repeat(64),
      compiledAt: '2026-08-02T00:00:00.000Z',
    }).ir;
    expect(buildEntityNodes(ir)).toEqual([]);
    expect(buildFactNodes(ir)).toEqual([]);
    expect(buildIntentNodes(ir)).toEqual([]);
  });
});
