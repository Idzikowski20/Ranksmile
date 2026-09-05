/**
 * The post-Auto-Optimize regrade is two independent LLM passes (intro judge, coverage
 * judge) that ran one after the other — ~30 s of the run. They overlap now.
 */
import type { CoverageSnapshot } from '@/src/core/domain/coverage/aiCoverage';

const timeline: string[] = [];
const sleep = (ms: number) => new Promise((r) => { setTimeout(r, ms); });

jest.mock('@/src/infrastructure/ai/deepseek', () => {
  const llm = () => ({ apiKey: 'x', url: 'u', model: 'm', provider: 'deepseek', keyEnv: 'K' });
  return { chatLlm: llm, chatLlmFor: llm };
});
jest.mock('@/src/infrastructure/articles/introductionAnalyzer', () => {
  const actual = jest.requireActual('@/src/infrastructure/articles/introductionAnalyzer');
  return {
    ...actual,
    analyzeIntroduction: async () => {
      timeline.push('intro:start');
      await sleep(40);
      timeline.push('intro:end');
      return {
        answerStartsEarly: true,
        detectedMainQuestion: 'Co robić?',
        answersMainQuestion: true,
        setsExpectations: true,
        identifiesAudience: true,
        explainsWhy: true,
      };
    },
  };
});
jest.mock('@/src/infrastructure/coverage/buildCoverageSnapshot', () => {
  const actual = jest.requireActual('@/src/infrastructure/coverage/buildCoverageSnapshot');
  return {
    ...actual,
    judgeCoverageItems: async (_text: string, items: Array<{ id: string }>) => {
      timeline.push('judge:start');
      await sleep(40);
      timeline.push('judge:end');
      return {
        result: { items: items.map((i) => ({ id: i.id, covered: true, quality: 5, confidence: 1 })), answersMainQuestionEarly: false },
        judgeTokens: 1,
      };
    },
  };
});

const snapshot: CoverageSnapshot = {
  schemaVersion: 1,
  judgeVersion: 'v|m|0',
  promptVersion: 'v',
  model: 'm',
  createdAt: 'now',
  items: [
    {
      id: 'f1',
      label: 'Wezwanie do zapłaty wskazuje kwotę i termin.',
      type: 'fact',
      category: 'knowledge',
      importance: 'recommended',
      source: 'llm',
      covered: false,
      quality: 0,
    },
    {
      id: 'q1',
      label: 'Co zrobić, gdy najemca nie płaci czynszu?',
      type: 'paa',
      category: 'knowledge',
      importance: 'critical',
      source: 'llm',
      covered: false,
      quality: 0,
    },
  ],
  buckets: [],
  answersMainQuestionEarly: false,
  overall: 0,
};

describe('regradeCoverageSnapshot', () => {
  it('runs the intro judge and the coverage judge concurrently', async () => {
    const { regradeCoverageSnapshot } = await import('@/src/infrastructure/coverage/regradeCoverageSnapshot');
    const sentence = 'Gdy najemca nie płaci, właściciel wysyła wezwanie do zapłaty z kwotą i terminem. ';
    const html = `<h1>Najemca nie płaci czynszu</h1><p>${sentence.repeat(8)}</p>`;
    const out = await regradeCoverageSnapshot({
      snapshot, html, plainText: html.replace(/<[^>]+>/g, ' '), keyword: 'najemca nie płaci czynszu', force: true,
    });
    expect(out).not.toBeNull();
    const starts = timeline.slice(0, 2).sort();
    expect(starts).toEqual(['intro:start', 'judge:start']);
    expect(out!.answersMainQuestionEarly).toBe(true);
    expect(out!.items.find((i) => i.id === 'f1')?.covered).toBe(true);
  });
});
