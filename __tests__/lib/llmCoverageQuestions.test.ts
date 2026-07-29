import {
  coverageQuestionPrompt,
  extractQuestionsFromText,
} from '../../lib/llmCoverageQuestions';
import { curateAiCoverageItems } from '../../lib/curateCoverageItems';

describe('extractQuestionsFromText', () => {
  it('pulls question lines from ChatGPT-style answers without fan_out', () => {
    const text = [
      'Here are common questions:',
      'Co to jest cuckolding?',
      'Jakie są rodzaje cuckoldu?',
      'Not a question.',
      '3. Czy cuckold to coś złego?',
    ].join('\n');
    const qs = extractQuestionsFromText(text);
    expect(qs).toEqual(expect.arrayContaining([
      'Co to jest cuckolding?',
      'Jakie są rodzaje cuckoldu?',
      'Czy cuckold to coś złego?',
    ]));
    expect(qs.some((q) => /Not a question/i.test(q))).toBe(false);
  });

  it('returns empty when there are no questions', () => {
    expect(extractQuestionsFromText('Cuckolding is a relationship dynamic.')).toEqual([]);
  });
});

describe('coverageQuestionPrompt', () => {
  it('asks engines for a question list (not a bare keyword)', () => {
    const p = coverageQuestionPrompt('cuckolding');
    expect(p).toMatch(/questions/i);
    expect(p).toContain('cuckolding');
  });
});

describe('curateAiCoverageItems PAA provenance', () => {
  it('does not label plain PAA as ai_overview', () => {
    const { knowledge } = curateAiCoverageItems({
      keyword: 'nękanie',
      paaQuestions: [
        { question: 'Kiedy można zgłosić nękanie?' },
        { question: 'Jakie zachowania są uważane za nękanie?' },
      ],
    });
    expect(knowledge.length).toBeGreaterThanOrEqual(1);
    expect(knowledge.every((i) => !(i.llmSources || []).includes('ai_overview'))).toBe(true);
  });

  it('keeps real LLM engine sources', () => {
    const { knowledge } = curateAiCoverageItems({
      keyword: 'nękanie',
      llmQuestions: [
        { question: 'Czym jest uporczywe nękanie?', sources: ['chat_gpt', 'perplexity'] },
      ],
    });
    const row = knowledge.find((i) => /uporczywe/i.test(i.label));
    expect(row?.llmSources?.sort()).toEqual(['chat_gpt', 'perplexity'].sort());
  });
});
