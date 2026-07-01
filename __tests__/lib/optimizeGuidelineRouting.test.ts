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
