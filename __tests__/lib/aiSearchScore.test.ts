import {
  computeAiSearchScore,
  computeAiSearchScoreV2,
  computeOverallContentScore,
  resolveAiScore,
  contentScoreSplit,
} from '../../lib/aiSearchScore';
import type { ArticleFact } from '../../lib/articleFacts';

const sampleFacts: ArticleFact[] = [
  { id: 'f1', text: 'Prywatny detektyw oferuje uslugi detektywistyczne w Warszawie.', sourceFrequency: 2, sources: [{ kind: 'serp' }] },
  { id: 'f2', text: 'Biuro detektywistyczne moze prowadzic sprawy cywilne i rodzinne.', sourceFrequency: 1, sources: [{ kind: 'ai_overview' }] },
  { id: 'f3', text: 'Koszt uslug detektywa zalezy od rodzaju sprawy.', sourceFrequency: 1, sources: [{ kind: 'chat_gpt' }] },
  { id: 'f4', text: 'Detektyw musi dzialac zgodnie z prawem i etyka zawodowa.', sourceFrequency: 1, sources: [{ kind: 'serp' }] },
];

describe('computeAiSearchScoreV2', () => {
  it('weights facts coverage at 70% and intent at 30%', () => {
    const article = [
      'Prywatny detektyw oferuje uslugi detektywistyczne w Warszawie.',
      'Biuro detektywistyczne prowadzi sprawy cywilne i rodzinne.',
      'Koszt uslug detektywa zalezy od rodzaju sprawy.',
      'Detektyw musi dzialac zgodnie z prawem.',
    ].join(' ');
    const score = computeAiSearchScoreV2({
      facts: sampleFacts,
      articleText: article,
      intentScore: 80,
      answersMainQuestionEarly: true,
    });
    expect(score).toBeGreaterThan(40);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('returns 0 when no facts', () => {
    expect(computeAiSearchScoreV2({ facts: [], articleText: 'text' })).toBe(0);
  });
});

describe('computeOverallContentScore', () => {
  it('blends SEO and AI with weak-dimension floor', () => {
    const blended = computeOverallContentScore(80, 40);
    expect(blended).toBeGreaterThanOrEqual(Math.round(80 * 0.55 + 40 * 0.45));
    expect(blended).toBeGreaterThanOrEqual(Math.round(40 * 0.8));
  });
});

describe('contentScoreSplit', () => {
  it('returns proportional SEO/AI percentages', () => {
    const { seoPct, aiPct } = contentScoreSplit(70, 30);
    expect(seoPct + aiPct).toBe(100);
    expect(seoPct).toBe(70);
  });
});

describe('resolveAiScore', () => {
  it('takes max of facts-v2 and legacy summary (V2=0 must not wipe healthy citations)', () => {
    // Reproduces article 159: facts pipeline scored 0, citation readiness still healthy.
    const summary = {
      prompts_total: 19,
      prompts_cited: 5,
      competitor_citations: 5,
      extractability_score: 44,
      citations: [
        { prompt: 'Czy inwigilacja jest legalna?', answer_readiness_score: 100 },
        { prompt: 'Czy inwigilacja jest karalna?', answer_readiness_score: 67 },
        { prompt: 'other', answer_readiness_score: 40 },
      ],
    };
    const unmatchedFacts: ArticleFact[] = [
      { id: 'f1', text: 'Unrelated fact that will not match the article body at all.', sourceFrequency: 2, sources: [{ kind: 'serp' }] },
    ];
    const fromV2 = computeAiSearchScoreV2({
      facts: unmatchedFacts,
      articleText: 'Inwigilacja to obserwacja. Czy inwigilacja jest legalna? Tak, w granicach prawa.',
    });
    const fromLegacy = computeAiSearchScore(summary);
    expect(fromV2).toBe(0);
    expect(fromLegacy).toBeGreaterThan(0);
    expect(resolveAiScore({
      facts: unmatchedFacts,
      articleText: 'Inwigilacja to obserwacja. Czy inwigilacja jest legalna? Tak, w granicach prawa.',
      summary,
    })).toBe(fromLegacy);
  });

  it('uses facts-v2 when it is the stronger signal', () => {
    const article = 'Prywatny detektyw oferuje uslugi detektywistyczne w Warszawie.';
    const resolved = resolveAiScore({
      facts: sampleFacts.slice(0, 1),
      articleText: article,
      summary: {
        prompts_total: 1,
        prompts_cited: 0,
        competitor_citations: 0,
        extractability_score: 0,
        citations: [{ prompt: 'x', answer_readiness_score: 10 }],
      },
    });
    expect(resolved).toBeGreaterThan(0);
    expect(resolved).toBe(
      Math.max(
        computeAiSearchScoreV2({ facts: sampleFacts.slice(0, 1), articleText: article }),
        computeAiSearchScore({
          prompts_total: 1,
          prompts_cited: 0,
          competitor_citations: 0,
          extractability_score: 0,
          citations: [{ prompt: 'x', answer_readiness_score: 10 }],
        }),
      ),
    );
  });

  it('falls back to coverage overall then legacy summary', () => {
    expect(resolveAiScore({ coverageOverall: 55 })).toBe(55);
    expect(resolveAiScore({
      summary: {
        prompts_total: 2,
        prompts_cited: 1,
        competitor_citations: 0,
        extractability_score: 50,
        citations: [
          { prompt: 'a', answer_readiness_score: 80 },
          { prompt: 'b', answer_readiness_score: 20 },
        ],
      },
    })).toBeGreaterThan(0);
  });
});
