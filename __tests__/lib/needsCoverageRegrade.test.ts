import { needsCoverageRegrade } from '@/src/infrastructure/coverage/regradeCoverageSnapshot';
import type { CoverageSnapshot, CoverageItem } from '@/src/core/domain/coverage/aiCoverage';

jest.mock('@/src/infrastructure/ai/deepseek', () => ({ chatLlm: () => ({ apiKey: '' }) }));
jest.mock('@/src/infrastructure/articles/introductionAnalyzer', () => ({
  analyzeIntroduction: jest.fn(),
  deepseekIntroJudge: {},
}));

const LONG_TEXT = 'słowo '.repeat(120).trim();

const paaItem = (id: string): CoverageItem => ({
  id,
  label: `Pytanie ${id}?`,
  type: 'paa',
  category: 'knowledge',
  importance: 'recommended',
  source: 'llm',
  covered: true,
  quality: 2,
});

const intentItem = (): CoverageItem => ({
  id: 'intent-answer-main',
  label: 'Answer the main question',
  type: 'intent',
  category: 'intent',
  importance: 'critical',
  source: 'llm',
  covered: true,
  quality: 3,
});

const snap = (items: CoverageItem[]): CoverageSnapshot => ({
  items,
  buckets: [],
  overall: 20,
  answersMainQuestionEarly: false,
  judge: { name: 'test', version: '1' },
  gradedAt: new Date().toISOString(),
} as unknown as CoverageSnapshot);

describe('needsCoverageRegrade', () => {
  it('regrades a keyword-mode snapshot that has PAA rows but no intent rows', () => {
    // Article 29's shape: deep analysis graded before any article existed, so the intro
    // analyzer never ran — intent bucket empty, AI score structurally capped at ~43.
    expect(needsCoverageRegrade(snap([paaItem('a'), paaItem('b')]), LONG_TEXT)).toBe(true);
  });

  it('leaves a snapshot with intent rows and a real score alone', () => {
    expect(needsCoverageRegrade(snap([intentItem(), paaItem('a')]), LONG_TEXT)).toBe(false);
  });

  it('never regrades against empty text', () => {
    expect(needsCoverageRegrade(snap([paaItem('a')]), '')).toBe(false);
  });
});
