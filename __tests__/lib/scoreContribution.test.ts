// __tests__/lib/scoreContribution.test.ts
import { scoreContribution } from '../../lib/coverage/derived/scoreContribution';
import type { CoverageItem, CoverageSnapshot } from '../../lib/aiCoverage';

const item = (id: string, category: CoverageItem['category'], importance: CoverageItem['importance'],
  covered: boolean, quality: number): CoverageItem =>
  ({ id, label: id, type: category === 'intent' ? 'intent' : 'paa', category, importance, source: 'paa', covered, quality });
const snap = (items: CoverageItem[], overall: number, early = false): CoverageSnapshot => ({
  schemaVersion: 1, judgeVersion: 'v1', promptVersion: 'v1', model: 'deepseek-chat',
  createdAt: '2026-06-30T00:00:00Z', items, buckets: [], answersMainQuestionEarly: early, overall,
});

describe('scoreContribution', () => {
  it('fully-covered item → 0', () => {
    const a = item('a', 'knowledge', 'recommended', true, 5);
    expect(scoreContribution(a, snap([a], 85))).toBe(0);
  });
  it('critical uncovered > optional uncovered', () => {
    const crit = item('c', 'knowledge', 'critical', false, 0);
    const opt = item('o', 'knowledge', 'optional', false, 0);
    const s = snap([crit, opt], 0);
    expect(scoreContribution(crit, s)).toBeGreaterThan(scoreContribution(opt, s));
  });
  it('returns an integer', () => {
    const a = item('a', 'knowledge', 'recommended', false, 0);
    expect(Number.isInteger(scoreContribution(a, snap([a], 0)))).toBe(true);
  });
  it('intent-answer-early flips the early bonus in its hypothetical', () => {
    const early = item('intent-answer-early', 'intent', 'critical', false, 0);
    expect(scoreContribution(early, snap([early], 0, false))).toBeGreaterThan(15);
  });
});
