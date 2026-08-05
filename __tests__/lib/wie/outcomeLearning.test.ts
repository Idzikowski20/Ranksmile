import {
  computeOutcomeSuccessScore,
  extractPatternIdsFromTraceEvents,
  outcomeIsSuccess,
  saveWieLastRun,
  readWieLastRun,
  applyOutcomeLearning,
} from '../../../lib/wie/outcomeLearning';

describe('WIE outcomeLearning', () => {
  it('scores strong GSC + engagement as success', () => {
    const s = computeOutcomeSuccessScore({
      impressions: 200,
      clicks: 12,
      ctr: 0.06,
      position: 4,
      avgTimeSec: 120,
      bounceRate: 0.4,
      conversions: 1,
    });
    expect(s).toBeGreaterThanOrEqual(0.55);
    expect(outcomeIsSuccess(s)).toBe(true);
  });

  it('scores weak CTR as failure-ish', () => {
    const s = computeOutcomeSuccessScore({
      impressions: 200,
      clicks: 1,
      ctr: 0.005,
      position: 28,
      avgTimeSec: 12,
      bounceRate: 0.85,
    });
    expect(outcomeIsSuccess(s)).toBe(false);
  });

  it('treats cold-start low impressions as neutral', () => {
    const s = computeOutcomeSuccessScore({
      impressions: 10,
      clicks: 0,
      ctr: 0,
    });
    expect(s).toBe(0.5);
  });

  it('extracts pattern ids from trace metadata', () => {
    const ids = extractPatternIdsFromTraceEvents([
      { metadata: { patternIdsUsed: ['a', 'b'] } },
      { metadata: { decisions: [{ pattern_id: 'c' }, { pattern_id: 'a' }] } },
    ]);
    expect(ids.sort()).toEqual(['a', 'b', 'c']);
  });

  it('persists last run and applies outcome', async () => {
    const articleId = 900001 + Math.floor(Math.random() * 1000);
    await saveWieLastRun(articleId, {
      at: new Date().toISOString(),
      patternIds: ['problem_before_definition', 'one_example_per_practical'],
      dna_version: 1,
    });
    const run = await readWieLastRun(articleId);
    expect(run?.patternIds.length).toBe(2);

    const result = await applyOutcomeLearning({
      articleId,
      metrics: {
        impressions: 150,
        clicks: 10,
        ctr: 0.067,
        position: 6,
        avgTimeSec: 80,
      },
    });
    expect(result.applied).toBe(true);
    expect(result.patternIds.length).toBe(2);
    expect(result.success).toBe(true);
  });
});
