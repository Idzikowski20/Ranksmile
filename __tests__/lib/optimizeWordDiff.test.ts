import { wordDiffSegments } from '../../lib/optimizeWordDiff';

describe('wordDiffSegments', () => {
  it('marks removed + added words between two strings', () => {
    const segs = wordDiffSegments('Tworzymy aplikacje', 'Tworzenie aplikacji');
    expect(segs.filter((s) => s.type === 'removed').map((s) => s.text).join('')).toContain('Tworzymy');
    expect(segs.filter((s) => s.type === 'added').map((s) => s.text).join('')).toContain('Tworzenie');
    expect(segs.some((s) => s.type === 'equal' && /aplikacj/.test(s.text))).toBe(true);
  });
  it('returns a single equal segment when texts match', () => {
    expect(wordDiffSegments('same text', 'same text')).toEqual([{ type: 'equal', text: 'same text' }]);
  });
});
