/** @jest-environment node */
import { scoreBand, scoreColor } from '@/src/infrastructure/config/scoreColor';

const GREEN = '#1ab25e';
const AMBER = '#efa00d';

describe('scoreColor greenAt threshold', () => {
  it('defaults to the shared 66 floor (site-audit / ranksmile gauges unchanged)', () => {
    expect(scoreBand(66)).toBe('high');
    expect(scoreColor(66)).toBe(GREEN);
    expect(scoreColor(65)).toBe(AMBER);
  });

  it('article trio passes 70 — 66..69 render amber, 70 green', () => {
    expect(scoreColor(69, 70)).toBe(AMBER);
    expect(scoreColor(66, 70)).toBe(AMBER);
    expect(scoreColor(70, 70)).toBe(GREEN);
  });
});
