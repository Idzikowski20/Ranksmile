import { computeAiSearchScoreV2 } from '../../lib/aiSearchScore';
import type { ScoreFactor } from '../../lib/aiScore/factors';
import type { ArticleFact } from '../../lib/articleFacts';

const facts = [
  { id: '1', text: 'Licencję wydaje komendant wojewódzki policji.', sourceFrequency: 2 },
  { id: '2', text: 'Kurs trwa 50 godzin.', sourceFrequency: 1 },
] as unknown as ArticleFact[];

const articleText = 'Licencję wydaje komendant wojewódzki policji. Kurs trwa 50 godzin.';

function intro(score: number): ScoreFactor[] {
  return [
    { name: 'INTRODUCTION_COVERED_TOPICS', found: score > 0, score },
    { name: 'INTRODUCTION_TARGET_AUDIENCE', found: score > 0, score },
    { name: 'INTRODUCTION_EARLY_QUERY_ANSWER', found: score > 0, score },
    { name: 'INTRODUCTION_TOPIC_RELEVANCE', found: score > 0, score },
  ];
}

describe('computeAiSearchScoreV2 with introduction factors', () => {
  it('scores a strong introduction above a missing one', () => {
    const weak = computeAiSearchScoreV2({ facts, articleText, introFactors: intro(0) });
    const strong = computeAiSearchScoreV2({ facts, articleText, introFactors: intro(1) });
    expect(strong).toBeGreaterThan(weak);
  });

  it('keeps the intent part capped at 30 of the 100 points', () => {
    const noIntent = computeAiSearchScoreV2({ facts, articleText, introFactors: intro(0) });
    const fullIntent = computeAiSearchScoreV2({ facts, articleText, introFactors: intro(1) });
    expect(fullIntent - noIntent).toBeLessThanOrEqual(30);
  });

  it('falls back to the legacy boolean when no factors are supplied', () => {
    const legacy = computeAiSearchScoreV2({ facts, articleText, answersMainQuestionEarly: true });
    const plain = computeAiSearchScoreV2({ facts, articleText });
    expect(legacy).toBeGreaterThan(plain);
  });

  it('still returns 0 without facts, whatever the introduction says', () => {
    expect(computeAiSearchScoreV2({ facts: [], articleText, introFactors: intro(1) })).toBe(0);
  });
});
