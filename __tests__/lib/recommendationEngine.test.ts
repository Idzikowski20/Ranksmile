import { buildInstruction, effortOf, buildGuidelines, groupGuidelines } from '../../lib/recommendationEngine';
import type { CoverageItem, CoverageSnapshot } from '../../lib/aiCoverage';

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

const ci = (id: string, category: CoverageItem['category'], importance: CoverageItem['importance'],
  covered: boolean, quality: number): CoverageItem =>
  ({ id, label: id, type: category === 'intent' ? 'intent' : 'paa', category, importance, source: 'paa', covered, quality });
const snapOf = (items: CoverageItem[]): CoverageSnapshot => ({
  schemaVersion: 1, judgeVersion: 'v1', promptVersion: 'v1', model: 'deepseek-chat', createdAt: '2026-06-30T00:00:00Z',
  items, buckets: [{ key: 'knowledge', label: 'Knowledge', weight: 2, items: 3, covered: 1, earned: 2, max: 6, score: 50 }] as never,
  answersMainQuestionEarly: false, overall: 40,
});

describe('buildGuidelines', () => {
  it('only NOT-fully-covered items (covered && quality>=4 excluded); stable ids; integer lift; effort/easyWin present', () => {
    const strong = ci('strong', 'knowledge', 'recommended', true, 5);
    const weak = ci('weak', 'knowledge', 'critical', false, 0);
    const shallow = ci('shallow', 'knowledge', 'recommended', true, 2);
    const gs = buildGuidelines(snapOf([strong, weak, shallow]));
    expect(gs.map((g) => g.coverageItemId).sort()).toEqual(['shallow', 'weak']);
    expect(gs.every((g) => g.id === `guideline-${g.coverageItemId}`)).toBe(true);
    expect(gs.every((g) => Number.isInteger(g.projectedLift))).toBe(true);
    expect(gs.every((g) => ['Easy','Medium','Large'].includes(g.effort))).toBe(true);
    expect(gs.every((g) => typeof g.easyWin === 'boolean')).toBe(true);
  });
});

describe('groupGuidelines', () => {
  it('maps to named groups, per-group bucket score, importance-first sort', () => {
    const crit = ci('k-crit', 'knowledge', 'critical', false, 0);
    const rec = ci('k-rec', 'knowledge', 'recommended', false, 0);
    const snap = snapOf([crit, rec]);
    const groups = groupGuidelines(buildGuidelines(snap), snap);
    const knowledge = groups.find((g) => g.key === 'knowledge');
    expect(knowledge?.label).toBe('Knowledge Coverage');
    expect(knowledge?.score).toBe(50);
    // importance-first: the critical guideline sorts before the recommended one
    expect(knowledge?.guidelines[0].coverageItemId).toBe('k-crit');
  });
  it('emits all 5 group keys (empty groups included for the UI)', () => {
    const groups = groupGuidelines([], snapOf([]));
    expect(groups.map((g) => g.key).sort()).toEqual(['authority','intent','knowledge','quality','structure']);
  });
  it('groupGuidelines sorts importance-first: a critical +1 guideline beats a recommended +15 guideline', () => {
    // Construct two manual Guidelines with asymmetric lifts to prove importance trumps projectedLift
    const guidelines: import('../../lib/recommendationEngine').Guideline[] = [
      {
        id: 'guideline-rec', coverageItemId: 'k-rec', group: 'knowledge',
        title: 'Recommended', instruction: 'x', importance: 'recommended', status: 'open',
        projectedLift: 15, effort: 'Easy', easyWin: false,
      },
      {
        id: 'guideline-crit', coverageItemId: 'k-crit', group: 'knowledge',
        title: 'Critical', instruction: 'x', importance: 'critical', status: 'open',
        projectedLift: 1, effort: 'Easy', easyWin: false,
      },
    ];
    const snapshot = snapOf([
      ci('k-crit', 'knowledge', 'critical', false, 0),
      ci('k-rec', 'knowledge', 'recommended', false, 0),
    ]);
    const groups = groupGuidelines(guidelines, snapshot);
    const knowledge = groups.find((g) => g.key === 'knowledge')!;
    // Critical (+1 lift) must sort before Recommended (+15 lift) because importance is the primary sort key
    expect(knowledge.guidelines.map((x) => x.coverageItemId)).toEqual(['k-crit', 'k-rec']);
  });
});
