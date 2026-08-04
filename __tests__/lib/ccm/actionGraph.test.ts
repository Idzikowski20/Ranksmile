import { asObjectId, asPredicateId, asSubjectId } from '../../../lib/ccm/ids';
import type { ActionGraph } from '../../../lib/ccm/types/actionGraph';
import type { RecommendationOp } from '../../../lib/ccm/types/recommendationDsl';

describe('ActionGraph + branded Recommendation DSL', () => {
  it('ADD_FACT uses branded SubjectId / PredicateId / ObjectId', () => {
    const op: RecommendationOp = {
      op: 'ADD_FACT',
      targetIntentId: 'i1',
      fact: {
        subject: asSubjectId('subj'),
        predicate: asPredicateId('pred'),
        object: asObjectId('obj'),
        statement: 'subj pred obj',
      },
      expected: { expectedScoreDelta: 2 },
    };
    expect(op.fact.subject).toBe('subj');
  });

  it('ActionGraph requires fromKnowledgeGraphHash', () => {
    const ag: ActionGraph = {
      schemaVersion: 1,
      immutable: true,
      fromCcmVersion: 1,
      contentHash: '0'.repeat(64),
      fromKnowledgeGraphHash: 'kg'.padEnd(64, '0'),
      builtAt: '2026-08-02T00:00:00.000Z',
      actions: [],
      roots: [],
    };
    expect(ag.fromKnowledgeGraphHash).toHaveLength(64);
  });
});
