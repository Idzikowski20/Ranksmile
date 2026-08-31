import { setAiScore, setSeoScore } from '@/src/infrastructure/articles/contentScore';

describe('setAiScore / setSeoScore write value and calculated_at together', () => {
  it('stamps ai_score with a timestamp', () => {
    const sd: { ai_score?: number; _ai_score_at?: number } = {};
    setAiScore(sd, 73, 1700000000000);
    expect(sd.ai_score).toBe(73);
    expect(sd._ai_score_at).toBe(1700000000000);
  });
  it('stamps seo_score with a timestamp', () => {
    const sd: { seo_score?: number; _seo_score_at?: number } = {};
    setSeoScore(sd, 88, 1700000000001);
    expect(sd.seo_score).toBe(88);
    expect(sd._seo_score_at).toBe(1700000000001);
  });
  it('defaults to now when no timestamp given', () => {
    const sd: { ai_score?: number; _ai_score_at?: number } = {};
    const before = Date.now();
    setAiScore(sd, 50);
    expect(sd._ai_score_at).toBeGreaterThanOrEqual(before);
  });
});
