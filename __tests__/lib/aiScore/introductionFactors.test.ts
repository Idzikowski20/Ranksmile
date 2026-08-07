import { scoreIntroduction } from '../../../lib/aiScore/introductionFactors';
import { aioScore, factsCoverageFactor, type ScoreFactor } from '../../../lib/aiScore/factors';

const html = `
  <h1>Detektywi Kraków</h1>
  <p>Detektywi w Krakowie realizują obserwację osób, wykrywanie zdrad i wywiad gospodarczy.</p>
  <p>Artykuł kierowany jest do klientów indywidualnych oraz przedsiębiorców.</p>
`;

describe('scoreIntroduction', () => {
  const factors = scoreIntroduction({
    html,
    keyword: 'detektywi kraków',
    coveredTopics: ['obserwacja', 'wywiad gospodarczy'],
    audienceTerms: ['klientów', 'przedsiębiorców'],
  });
  const byName = Object.fromEntries(factors.map((f) => [f.name, f]));

  it('returns the four introduction factors', () => {
    expect(factors.map((f) => f.name).sort()).toEqual([
      'INTRODUCTION_COVERED_TOPICS',
      'INTRODUCTION_EARLY_QUERY_ANSWER',
      'INTRODUCTION_TARGET_AUDIENCE',
      'INTRODUCTION_TOPIC_RELEVANCE',
    ]);
  });

  it('finds the sentence that answers the query and returns it as the span', () => {
    expect(byName.INTRODUCTION_EARLY_QUERY_ANSWER.found).toBe(true);
    expect(byName.INTRODUCTION_EARLY_QUERY_ANSWER.textSpan)
      .toContain('Detektywi w Krakowie realizują obserwację');
  });

  it('names the audience sentence', () => {
    expect(byName.INTRODUCTION_TARGET_AUDIENCE.textSpan).toContain('przedsiębiorców');
  });

  it('scores every factor between 0 and 1', () => {
    for (const factor of factors) {
      expect(factor.score).toBeGreaterThanOrEqual(0);
      expect(factor.score).toBeLessThanOrEqual(1);
    }
  });

  it('does not let a short query match inside another word', () => {
    const factors = scoreIntroduction({
      html: '<p>Wysyłamy email do klienta i czekamy na odpowiedź.</p>',
      keyword: 'AI',
      coveredTopics: [],
      audienceTerms: [],
    });
    expect(factors.find((f) => f.name === 'INTRODUCTION_TOPIC_RELEVANCE')?.found).toBe(false);
  });

  it('matches a two-letter query when it stands on its own', () => {
    const factors = scoreIntroduction({
      html: '<p>AI zmienia sposób, w jaki szukamy informacji.</p>',
      keyword: 'AI',
      coveredTopics: [],
      audienceTerms: [],
    });
    expect(factors.find((f) => f.name === 'INTRODUCTION_EARLY_QUERY_ANSWER')?.found).toBe(true);
  });

  it('reports a miss instead of inventing a span', () => {
    const empty = scoreIntroduction({
      html: '<h1>T</h1><p>Lorem ipsum dolor sit amet.</p>',
      keyword: 'detektywi kraków',
      coveredTopics: ['obserwacja'],
      audienceTerms: ['przedsiębiorców'],
    });
    const audience = empty.find((f) => f.name === 'INTRODUCTION_TARGET_AUDIENCE');
    expect(audience).toMatchObject({ found: false, score: 0 });
    expect(audience?.textSpan).toBeUndefined();
  });

  it('ignores headings when picking the introduction', () => {
    const factorsWithNoisyHeading = scoreIntroduction({
      html: '<h1>przedsiębiorców</h1><p>Zupełnie inne zdanie.</p>',
      keyword: 'detektywi',
      coveredTopics: [],
      audienceTerms: ['przedsiębiorców'],
    });
    expect(factorsWithNoisyHeading.find((f) => f.name === 'INTRODUCTION_TARGET_AUDIENCE')?.found)
      .toBe(false);
  });
});

describe('aioScore', () => {
  const facts: ScoreFactor = { name: 'FACTS_COVERAGE', found: true, score: 1 };
  const topics: ScoreFactor = { name: 'INTRODUCTION_COVERED_TOPICS', found: true, score: 1 };
  const early: ScoreFactor = { name: 'INTRODUCTION_EARLY_QUERY_ANSWER', found: true, score: 1 };

  it('climbs as factors land instead of starting high on the first one', () => {
    const first = aioScore([facts]).value;
    const second = aioScore([facts, topics]).value;
    const third = aioScore([facts, topics, early]).value;

    expect(first).toBeLessThan(second);
    expect(second).toBeLessThan(third);
    expect(first).toBeLessThan(100);
  });

  it('reaches 100 only when every factor is perfect', () => {
    expect(aioScore([
      facts, topics, early,
      { name: 'INTRODUCTION_TARGET_AUDIENCE', found: true, score: 1 },
      { name: 'INTRODUCTION_TOPIC_RELEVANCE', found: true, score: 1 },
    ]).value).toBe(100);
  });

  it('turns a coverage ratio into a factor', () => {
    expect(factsCoverageFactor(41, 50)).toMatchObject({
      name: 'FACTS_COVERAGE', value: 82, found: true,
    });
  });

  it('handles an empty knowledge base without dividing by zero', () => {
    expect(factsCoverageFactor(0, 0)).toMatchObject({ value: 0, found: false, score: 0 });
  });
});
