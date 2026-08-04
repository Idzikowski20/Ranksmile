import type { ContentIr, FactCandidate } from '../../../lib/ccm/types/ir';

describe('ccm IR types', () => {
  it('accepts empty ContentIr', () => {
    const ir: ContentIr = {
      version: 1,
      contentHash: '0'.repeat(64),
      paragraphs: [],
      claims: [],
      candidates: [],
    };
    expect(ir.candidates).toEqual([]);
  });

  it('discriminates FactCandidate', () => {
    const fact: FactCandidate = {
      id: 'fc1',
      kind: 'fact',
      confidence: 0.9,
      blockIds: ['b1'],
      statement: 'X causes Y',
      entityCandidateIds: [],
    };
    const ir: ContentIr = {
      version: 1,
      contentHash: 'abc',
      paragraphs: [],
      claims: [],
      candidates: [fact],
    };
    const first = ir.candidates[0];
    expect(first?.kind).toBe('fact');
    if (first?.kind === 'fact') {
      expect(first.statement).toContain('causes');
    }
  });
});
