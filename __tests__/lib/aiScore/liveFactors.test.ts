import { introFactorsFromScoreData } from '../../../lib/aiScore/liveFactors';

const html = `
  <h1>Detektywi Kraków</h1>
  <p>Detektywi w Krakowie prowadzą obserwację osób i wywiad gospodarczy.</p>
  <p>Piszemy dla przedsiębiorców weryfikujących kontrahentów.</p>
`;

const scoreData = {
  terms: [{ term: 'obserwacja' }, { term: 'wywiad gospodarczy' }, { term: '' }],
  content_planner_v2: { bundle: { reader: { readerPersona: 'przedsiębiorców z Krakowa' } } },
};

describe('introFactorsFromScoreData', () => {
  it('scores topics from the article terms and the audience from the planner persona', () => {
    const byName = Object.fromEntries(
      introFactorsFromScoreData({ html, keyword: 'detektywi kraków', scoreData })
        .map((f) => [f.name, f]),
    );
    expect(byName.INTRODUCTION_COVERED_TOPICS.found).toBe(true);
    expect(byName.INTRODUCTION_TARGET_AUDIENCE.textSpan).toContain('przedsiębiorców');
  });

  it('still returns every factor when the article has no analysis yet', () => {
    const factors = introFactorsFromScoreData({ html, keyword: 'detektywi', scoreData: null });
    expect(factors).toHaveLength(4);
    expect(factors.find((f) => f.name === 'INTRODUCTION_TARGET_AUDIENCE')?.found).toBe(false);
  });

  it('reacts to the text as it is edited', () => {
    const before = introFactorsFromScoreData({
      html: '<p>Zupełnie nie na temat.</p>', keyword: 'detektywi kraków', scoreData,
    });
    const after = introFactorsFromScoreData({ html, keyword: 'detektywi kraków', scoreData });
    const score = (list: typeof before) => list.reduce((sum, f) => sum + f.score, 0);
    expect(score(after)).toBeGreaterThan(score(before));
  });

  it('ignores persona filler words too short to identify a reader', () => {
    const factors = introFactorsFromScoreData({
      html: '<p>To i za oraz w tym.</p>',
      keyword: 'x',
      scoreData: { content_planner_v2: { bundle: { reader: { readerPersona: 'i za w to' } } } },
    });
    expect(factors.find((f) => f.name === 'INTRODUCTION_TARGET_AUDIENCE')?.found).toBe(false);
  });
});
