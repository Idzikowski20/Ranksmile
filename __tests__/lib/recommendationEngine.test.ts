import { buildInstruction, effortOf } from '../../lib/recommendationEngine';
import type { CoverageItem } from '../../lib/aiCoverage';

const it_ = (over: Partial<CoverageItem>): CoverageItem =>
  ({ id: 'x', label: 'What is X?', type: 'paa', category: 'knowledge',
     importance: 'recommended', source: 'paa', covered: false, quality: 0, ...over });

describe('buildInstruction', () => {
  it('uncovered paa with missing → "Cover" title + checklist bullets', () => {
    const r = buildInstruction(it_({ missing: ['dosage', 'side effects'] }));
    expect(r.title).toBe('Cover: What is X?');
    expect(r.instruction).toContain('• dosage');
    expect(r.instruction).toContain('• side effects');
  });
  it('needsExpansion → "Expand" title + reason', () => {
    const r = buildInstruction(it_({ covered: true, quality: 2, needsExpansion: true, reason: 'too vague' }));
    expect(r.title).toBe('Expand: What is X?');
    expect(r.instruction).toContain('too vague');
  });
  it('entity → "Use the term"', () => {
    const r = buildInstruction(it_({ type: 'entity', label: 'React Hooks' }));
    expect(r.title).toBe('Use the term: React Hooks');
  });
  it('intent-answer-early uses keyword from context when present', () => {
    const r = buildInstruction(
      { ...it_({}), id: 'intent-answer-early', type: 'intent', category: 'intent' },
      { keyword: 'react hooks' } as never);
    expect(r.instruction.toLowerCase()).toContain('react hooks');
  });
  it('never blank even with no missing/reason', () => {
    expect(buildInstruction(it_({ type: 'entity', label: 'X' })).instruction.length).toBeGreaterThan(0);
  });
});

describe('effortOf', () => {
  it('needsExpansion → Large', () => expect(effortOf(it_({ needsExpansion: true }))).toBe('Large'));
  it('>5 missing → Large', () => expect(effortOf(it_({ missing: ['a','b','c','d','e','f'] }))).toBe('Large'));
  it('3-5 missing → Medium', () => expect(effortOf(it_({ missing: ['a','b','c'] }))).toBe('Medium'));
  it('<=2 missing → Easy', () => expect(effortOf(it_({ missing: ['a','b'] }))).toBe('Easy'));
  it('entity (0 missing) → Easy', () => expect(effortOf(it_({ type: 'entity' }))).toBe('Easy'));
});
