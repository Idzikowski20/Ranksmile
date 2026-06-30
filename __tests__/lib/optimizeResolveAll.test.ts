import { collectOptimizerPositions, PMDocLike, PMNodeLike } from '../../lib/optimizeResolveAll';

/** Build a fake PM doc whose `descendants` yields the given nodes in document order. */
const makeDoc = (nodes: Array<{ name: string; pos: number; nodeSize: number; sectionId?: string }>): PMDocLike => ({
  descendants(fn: (node: PMNodeLike, pos: number) => void) {
    nodes.forEach((n) => fn({ type: { name: n.name }, nodeSize: n.nodeSize, attrs: { sectionId: n.sectionId } }, n.pos));
  },
});

describe('collectOptimizerPositions', () => {
  it('returns an empty array when no contentOptimizer nodes exist', () => {
    const doc = makeDoc([
      { name: 'paragraph', pos: 1, nodeSize: 5 },
      { name: 'heading', pos: 7, nodeSize: 3 },
    ]);
    expect(collectOptimizerPositions(doc)).toEqual([]);
  });

  it('collects only contentOptimizer nodes, ignoring others', () => {
    const doc = makeDoc([
      { name: 'paragraph', pos: 1, nodeSize: 5 },
      { name: 'contentOptimizer', pos: 6, nodeSize: 1, sectionId: 's1' },
      { name: 'heading', pos: 7, nodeSize: 3 },
    ]);
    const refs = collectOptimizerPositions(doc);
    expect(refs).toHaveLength(1);
    expect(refs[0]).toEqual({ sectionId: 's1', pos: 6, nodeSize: 1 });
  });

  it('sorts positions DESCENDING so high-pos splices run first', () => {
    const doc = makeDoc([
      { name: 'contentOptimizer', pos: 2, nodeSize: 1, sectionId: 'a' },
      { name: 'paragraph', pos: 3, nodeSize: 10 },
      { name: 'contentOptimizer', pos: 13, nodeSize: 1, sectionId: 'b' },
      { name: 'contentOptimizer', pos: 20, nodeSize: 1, sectionId: 'c' },
    ]);
    const refs = collectOptimizerPositions(doc);
    expect(refs.map((r) => r.pos)).toEqual([20, 13, 2]);
    expect(refs.map((r) => r.sectionId)).toEqual(['c', 'b', 'a']);
  });

  it('coerces a missing sectionId to an empty string', () => {
    const doc = makeDoc([{ name: 'contentOptimizer', pos: 4, nodeSize: 1 }]);
    expect(collectOptimizerPositions(doc)[0].sectionId).toBe('');
  });
});
