import { prioritizeActions } from '../../lib/primitives/prioritizeActions';
import { applyStrategy } from '../../lib/primitives/prioritizeActions';
import type { Action } from '../../lib/primitives/types';

const base = (partial: Partial<Action> & Pick<Action, 'id' | 'title' | 'expectedLift'>): Action => ({
  type: partial.type || 'custom',
  instruction: partial.instruction || partial.title,
  confidence: partial.confidence ?? 0.8,
  cost: partial.cost || 'medium',
  reason: partial.reason || partial.title,
  origin: partial.origin || 'coverage',
  appliesTo: partial.appliesTo || { kind: 'article' },
  featureId: partial.featureId || 'coverage',
  ...partial,
  id: partial.id,
  title: partial.title,
  expectedLift: partial.expectedLift,
});

describe('prioritizeActions', () => {
  it('dedupes by id keeping higher lift', () => {
    const out = prioritizeActions([
      base({ id: 'a', title: 'A', expectedLift: 5 }),
      base({ id: 'a', title: 'A2', expectedLift: 12 }),
      base({ id: 'b', title: 'B', expectedLift: 8 }),
    ]);
    expect(out.map((x) => x.id)).toEqual(['a', 'b']);
    expect(out[0].expectedLift).toBe(12);
  });

  it('sorts by expectedLift desc', () => {
    const out = prioritizeActions([
      base({ id: 'x', title: 'X', expectedLift: 3 }),
      base({ id: 'y', title: 'Y', expectedLift: 15 }),
    ]);
    expect(out[0].id).toBe('y');
  });
});

describe('applyStrategy', () => {
  it('quick_wins keeps easy or high lift', () => {
    const out = applyStrategy(
      [
        base({ id: '1', title: '1', expectedLift: 3, cost: 'large' }),
        base({ id: '2', title: '2', expectedLift: 2, cost: 'easy' }),
        base({ id: '3', title: '3', expectedLift: 10, cost: 'large' }),
      ],
      { id: 'quick_wins', label: 'Quick wins' },
    );
    expect(out.map((x) => x.id).sort()).toEqual(['2', '3']);
  });
});
