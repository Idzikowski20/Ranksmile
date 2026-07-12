import {
  resolveOptimizePhase,
  TARGET_CONTENT_FIRST,
  maxRoundsForPhase,
  targetContentForPhase,
} from '../../lib/optimizeRunPhase';

describe('resolveOptimizePhase', () => {
  it('returns first_run when score low and no prior AO', () => {
    expect(resolveOptimizePhase({ contentScore: 40 })).toBe('first_run');
  });

  it('returns follow_up when content score >= 80', () => {
    expect(resolveOptimizePhase({ contentScore: TARGET_CONTENT_FIRST })).toBe('follow_up');
  });

  it('returns follow_up when ao_meta has prior runs', () => {
    expect(resolveOptimizePhase({ contentScore: 50, aoMeta: { runs: 1 } })).toBe('follow_up');
  });

  it('returns follow_up when prior auto_optimize version exists', () => {
    expect(resolveOptimizePhase({ contentScore: 50, hasPriorAutoOptimizeVersion: true })).toBe('follow_up');
  });
});

describe('phase helpers', () => {
  it('first run allows more rounds and lower content target', () => {
    expect(maxRoundsForPhase('first_run')).toBeGreaterThan(maxRoundsForPhase('follow_up'));
    expect(targetContentForPhase('first_run')).toBeLessThan(targetContentForPhase('follow_up'));
  });
});
