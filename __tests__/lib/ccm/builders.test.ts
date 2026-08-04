import { buildEntityNodes } from '../../../lib/ccm/builders/entityBuilder';
import { buildFactNodes } from '../../../lib/ccm/builders/factBuilder';
import { buildIntentNodes } from '../../../lib/ccm/builders/intentBuilder';
import type { ContentIr } from '../../../lib/ccm/types/ir';

const ir: ContentIr = {
  version: 1,
  contentHash: '0'.repeat(64),
  paragraphs: [{ id: 'p1', blockId: 'b1', claimIds: ['c1'] }],
  claims: [
    {
      id: 'c1',
      paragraphId: 'p1',
      blockId: 'b1',
      startOffset: 0,
      endOffset: 10,
      text: 'Rosja 2014',
      kind: 'factish',
    },
  ],
  candidates: [
    {
      id: 'ec_1',
      kind: 'entity',
      confidence: 0.6,
      blockIds: ['b1'],
      surface: 'Rosja',
      canonicalHint: 'Rosja',
    },
    {
      id: 'fc_c1',
      kind: 'fact',
      confidence: 0.7,
      blockIds: ['b1'],
      statement: 'Rosja 2014',
      subject: 'Rosja',
      predicate: 'states',
      entityCandidateIds: ['ec_1'],
    },
    {
      id: 'ic_b0',
      kind: 'intent',
      confidence: 0.8,
      blockIds: ['b0'],
      label: 'Topic',
      priority: 0,
    },
  ],
};

describe('ccm builders', () => {
  it('maps candidates to nodes', () => {
    expect(buildEntityNodes(ir)).toHaveLength(1);
    expect(buildFactNodes(ir)[0]?.entityIds).toEqual(['ec_1']);
    expect(buildIntentNodes(ir)[0]?.primary).toBe(true);
  });

  it('empty IR → empty nodes', () => {
    const empty: ContentIr = {
      version: 1,
      contentHash: '0'.repeat(64),
      paragraphs: [],
      claims: [],
      candidates: [],
    };
    expect(buildEntityNodes(empty)).toEqual([]);
    expect(buildFactNodes(empty)).toEqual([]);
    expect(buildIntentNodes(empty)).toEqual([]);
  });
});
