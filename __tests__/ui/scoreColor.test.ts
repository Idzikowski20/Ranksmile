// __tests__/ui/scoreColor.test.ts
import { scoreColor, scoreBand } from '../../lib/scoreColor';

describe('scoreColor (kanon 33/66)', () => {
  it('zwraca czerwony dla < 33', () => {
    expect(scoreColor(0)).toBe('#d70028');
    expect(scoreColor(32)).toBe('#d70028');
  });
  it('zwraca żółty dla 33–65', () => {
    expect(scoreColor(33)).toBe('#efa00d');
    expect(scoreColor(65)).toBe('#efa00d');
  });
  it('zwraca zielony dla >= 66', () => {
    expect(scoreColor(66)).toBe('#1ab25e');
    expect(scoreColor(100)).toBe('#1ab25e');
  });
  it('klampuje wartości poza 0–100', () => {
    expect(scoreColor(-5)).toBe('#d70028');
    expect(scoreColor(150)).toBe('#1ab25e');
  });
  it('scoreBand zwraca low/mid/high', () => {
    expect(scoreBand(10)).toBe('low');
    expect(scoreBand(50)).toBe('mid');
    expect(scoreBand(80)).toBe('high');
  });
});
