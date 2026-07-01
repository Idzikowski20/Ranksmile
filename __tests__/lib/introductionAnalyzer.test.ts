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

  it('pins each verdict field to its exact intent id (one-hot)', () => {
    const FIELD_TO_ID: Array<[keyof IntroVerdict, string]> = [
      ['intentConfirmed', 'intent-answer-main'],
      ['answerStartsEarly', 'intent-answer-early'],
      ['expectationsSet', 'intent-expectations'],
      ['audienceMentioned', 'intent-who'],
      ['goalMentioned', 'intent-why'],
    ];

    const baseVerdict: IntroVerdict = {
      intentConfirmed: false,
      answerStartsEarly: false,
      audienceMentioned: false,
      goalMentioned: false,
      expectationsSet: false,
    };

    FIELD_TO_ID.forEach(([field, expectedId]) => {
      const oneHotVerdict = { ...baseVerdict, [field]: true };
      const items = introCoverageItems(oneHotVerdict);

      // Verify the expected field's ID is covered
      const expectedItem = items.find((i) => i.id === expectedId);
      expect(expectedItem).toBeDefined();
      expect(expectedItem?.covered).toBe(true);
      expect(expectedItem?.quality).toBe(5);

      // Verify all other fields are NOT covered
      const otherIds = FIELD_TO_ID
        .filter(([_, id]) => id !== expectedId)
        .map(([_, id]) => id);
      otherIds.forEach((otherId) => {
        const otherItem = items.find((i) => i.id === otherId);
        expect(otherItem).toBeDefined();
        expect(otherItem?.covered).toBe(false);
        expect(otherItem?.quality).toBe(0);
      });
    });
  });
});
