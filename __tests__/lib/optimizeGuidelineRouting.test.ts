import { assignGuidelinesToSections } from '../../lib/optimizeGuidelineRouting';
import type { Guideline } from '../../lib/recommendationEngine';
import type { Section } from '../../lib/articleSections';

const g = (over: Partial<Guideline>): Guideline => ({
  id: 'guideline-x', coverageItemId: 'x', group: 'knowledge', title: 'X', instruction: 'Do X.',
  importance: 'recommended', status: 'open', projectedLift: 10, effort: 'Easy', easyWin: false, ...over,
});
const sec = (id: string, index: number, headingText: string, html: string): Section => ({ id, index, headingText, html });
const noBreakdown = { slots: [], totalPossible: 0 };

describe('assignGuidelinesToSections (scoring)', () => {
  it('exact sectionId match wins with confidence 1 and reason Exact section match', () => {
    const s0 = sec('sec_0_a', 0, 'Intro', '<p>hello</p>');
    const s1 = sec('sec_1_b', 1, 'Dosage', '<h2>Dosage</h2><p>take two</p>');
    const gl = g({ title: 'Cover: Side effects', sectionId: 'sec_1_b' });
    const routed = assignGuidelinesToSections([gl], [s0, s1], { breakdown: noBreakdown });
    expect(routed.get('sec_1_b')?.[0].guideline.coverageItemId).toBe('x');
    expect(routed.get('sec_1_b')?.[0].confidence).toBe(1);
    expect(routed.get('sec_1_b')?.[0].reason).toBe('Exact section match');
    expect(routed.get('sec_0_a')).toBeUndefined();
  });

  it('routes by heading token overlap when no sectionId', () => {
    const s0 = sec('sec_0_a', 0, 'Installation Guide', '<h2>Installation Guide</h2><p>run npm</p>');
    const s1 = sec('sec_1_b', 1, 'Pricing Plans', '<h2>Pricing Plans</h2><p>cost</p>');
    const gl = g({ title: 'Cover: Installation steps', instruction: 'Explain installation.' });
    const routed = assignGuidelinesToSections([gl], [s0, s1], { breakdown: noBreakdown });
    expect(routed.get('sec_0_a')?.[0].guideline.coverageItemId).toBe('x');
    expect(routed.get('sec_0_a')?.[0].confidence).toBeGreaterThan(0);
    expect(routed.get('sec_0_a')?.[0].confidence).toBeLessThanOrEqual(1);
  });

  it('routes an entity guideline to the section where its term already appears (body frequency)', () => {
    const s0 = sec('sec_0_a', 0, 'Overview', '<p>general text with nothing special</p>');
    const s1 = sec('sec_1_b', 1, 'Details', '<p>React Hooks are great; React Hooks simplify state</p>');
    const gl = g({ title: 'Use the term: React Hooks', instruction: 'Work the term React Hooks in.' });
    const routed = assignGuidelinesToSections([gl], [s0, s1], { breakdown: noBreakdown });
    expect(routed.get('sec_1_b')?.[0].guideline.coverageItemId).toBe('x');
  });
});

describe('assignGuidelinesToSections (fallback + priority + edges)', () => {
  const sec = (id: string, index: number, headingText: string, html: string): Section => ({ id, index, headingText, html });
  const g = (over: Partial<Guideline>): Guideline => ({
    id: 'guideline-x', coverageItemId: 'x', group: 'knowledge', title: 'X', instruction: 'Do X.',
    importance: 'recommended', status: 'open', projectedLift: 10, effort: 'Easy', easyWin: false, ...over,
  });

  it('stale sectionId (not among current sections) does NOT route to a missing section — falls through to scoring', () => {
    const s0 = sec('sec_0_a', 0, 'Installation', '<h2>Installation</h2><p>install steps here</p>');
    const gl = g({ title: 'Cover: Installation', instruction: 'installation', sectionId: 'sec_9_gone' });
    const routed = assignGuidelinesToSections([gl], [s0], { breakdown: { slots: [], totalPossible: 0 } });
    expect(routed.get('sec_9_gone')).toBeUndefined();
    expect(routed.get('sec_0_a')?.[0].guideline.coverageItemId).toBe('x'); // routed by heading, not lost
    expect(routed.get('sec_0_a')?.[0].reason).not.toBe('Exact section match');
  });

  it('heading-miss with no body/freq signal: intent guideline falls back to intro (index 0)', () => {
    const s0 = sec('sec_0_a', 0, '', '<p>opening paragraph</p>');
    const s1 = sec('sec_1_b', 1, 'Zzz Unrelated', '<h2>Zzz Unrelated</h2><p>qqq www</p>');
    const gl = g({ group: 'intent', title: 'Answer the main question early', instruction: 'answer early' });
    const routed = assignGuidelinesToSections([gl], [s0, s1], { breakdown: { slots: [], totalPossible: 0 } });
    expect(routed.get('sec_0_a')?.[0].guideline.coverageItemId).toBe('x');
    expect(routed.get('sec_0_a')?.[0].reason).toContain('Fallback');
  });

  it('heading-miss non-intent falls back to the highest-missingPoints section', () => {
    const s0 = sec('sec_0_a', 0, 'Alpha', '<h2>Alpha</h2><p>aaa</p>');
    const s1 = sec('sec_1_b', 1, 'Beta', '<h2>Beta</h2><p>bbb</p>');
    const gl = g({ title: 'Add statistic', instruction: 'cite a statistic', group: 'authority' });
    const breakdown = { slots: [{ key: 'sec_1_b', missingPoints: 9 }, { key: 'sec_0_a', missingPoints: 2 }], totalPossible: 100 };
    const routed = assignGuidelinesToSections([gl], [s0, s1], { breakdown });
    expect(routed.get('sec_1_b')?.[0].guideline.coverageItemId).toBe('x');
  });

  it('sorts each section array by priority desc (critical before higher-lift recommended)', () => {
    const s0 = sec('sec_0_a', 0, 'Dosage Guide', '<h2>Dosage Guide</h2><p>dosage details</p>');
    const crit = g({ coverageItemId: 'c', title: 'Cover: Dosage', instruction: 'dosage', importance: 'critical', projectedLift: 10 });
    const rec = g({ coverageItemId: 'r', title: 'Cover: Dosage', instruction: 'dosage', importance: 'recommended', projectedLift: 14 });
    const routed = assignGuidelinesToSections([rec, crit], [s0], { breakdown: { slots: [], totalPossible: 0 } });
    expect(routed.get('sec_0_a')?.map((r) => r.guideline.coverageItemId)).toEqual(['c', 'r']);
  });
});
