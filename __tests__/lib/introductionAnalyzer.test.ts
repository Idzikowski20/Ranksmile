import { analyzeIntroduction, introCoverageItems, IntroductionJudge, IntroVerdict } from '../../lib/introductionAnalyzer';

const judge = (run: IntroductionJudge['run']): IntroductionJudge => ({ version: 'test-intro-v1', run });

describe('analyzeIntroduction', () => {
  it('returns verdict from injected judge', async () => {
    const j = judge(async () => ({
      intentConfirmed: true, answerStartsEarly: true,
      audienceMentioned: false, goalMentioned: true, expectationsSet: true,
    }));
    const v = await analyzeIntroduction('intro text', 'react hooks', j);
    expect(v.intentConfirmed).toBe(true);
    expect(v.audienceMentioned).toBe(false);
  });
  it('falls back to safe defaults on judge failure', async () => {
    const j = judge(async () => { throw new Error('LLM down'); });
    const v = await analyzeIntroduction('intro text', 'react hooks', j);
    expect(v).toEqual({
      intentConfirmed: false, answerStartsEarly: false,
      audienceMentioned: false, goalMentioned: false, expectationsSet: false,
    });
  });
  it('skips judge call when intro text empty', async () => {
    const run = jest.fn();
    await analyzeIntroduction('', 'react hooks', judge(run as never));
    expect(run).not.toHaveBeenCalled();
  });
});

describe('introCoverageItems', () => {
  it('maps verdict onto 5 fixed intent items (category:intent)', () => {
    const verdict: IntroVerdict = {
      intentConfirmed: true, answerStartsEarly: false,
      audienceMentioned: true, goalMentioned: false, expectationsSet: true,
    };
    const items = introCoverageItems(verdict);
    expect(items.map((i) => i.id)).toEqual([
      'intent-answer-main', 'intent-answer-early',
      'intent-expectations', 'intent-who', 'intent-why',
    ]);
    expect(items[0].covered).toBe(true);     // intentConfirmed
    expect(items[0].quality).toBe(5);
    expect(items[1].covered).toBe(false);    // answerStartsEarly
    expect(items[2].covered).toBe(true);     // expectationsSet
    expect(items[3].covered).toBe(true);     // audienceMentioned
    expect(items[4].covered).toBe(false);    // goalMentioned
    expect(items.every((i) => i.category === 'intent')).toBe(true);
  });
});
