import {
  canonicalizeQuestion,
  dedupeWithProvenance,
} from '../../lib/harvest/canonicalizeQuestion';
import {
  PLACEHOLDER_THRESHOLD,
  PLACEHOLDER_TOPIC_ID,
  clusterQuestions,
  tokenizeForHarvest,
} from '../../lib/harvest/clusterQuestions';
import {
  MIN_PER,
  MAX_PER,
  enforceBudget,
  medianQuestionCount,
} from '../../lib/harvest/enforceBudget';
import { computeQuestionScore, SOURCE_WEIGHT, PAA_SOURCE_WEIGHT } from '../../lib/harvest/questionScore';
import { harvestAiCoverage } from '../../lib/harvestAiCoverage';
import type { CoverageProvider } from '../../lib/harvest/providers';
import type { HarvestedQuestion } from '../../lib/harvest/canonicalizeQuestion';

describe('questionScore', () => {
  it('computes weight*100 + quality', () => {
    expect(computeQuestionScore(SOURCE_WEIGHT.ai_overview, 80)).toBe(580);
    expect(computeQuestionScore(PAA_SOURCE_WEIGHT, 40)).toBe(340);
    expect(computeQuestionScore(SOURCE_WEIGHT.reddit, 40)).toBe(240);
  });
});

describe('canonicalizeQuestion', () => {
  it('strips question prefixes and folds PL', () => {
    expect(canonicalizeQuestion('Jak działa wojna hybrydowa?')).toBe(
      canonicalizeQuestion('działa wojna hybrydowa'),
    );
    expect(canonicalizeQuestion('Co to jest SEO?')).toContain('seo');
  });

  it('dedupes with full sources[] provenance and PAA weight hint', () => {
    const rows = dedupeWithProvenance([
      {
        question: 'Jak działa wojna hybrydowa?',
        sources: ['ai_overview'],
        quality: 50,
        weightHint: 3,
      },
      {
        question: 'jak dziala wojna hybrydowa',
        sources: ['gemini', 'chat_gpt'],
        quality: 70,
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.sources.sort()).toEqual(['ai_overview', 'chat_gpt', 'gemini'].sort());
    expect(rows[0]!.maxSourceWeight).toBe(SOURCE_WEIGHT.ai_overview);
    expect(rows[0]!.engineCoverage).toBe(3);
    expect(rows[0]!.frequency).toBe(2);
    expect(rows[0]!.questionScore).toBe(
      computeQuestionScore(SOURCE_WEIGHT.ai_overview, 70, { frequency: 2, engineCoverage: 3 }),
    );
  });

  it('keeps PAA weight when only overview source', () => {
    const rows = dedupeWithProvenance([
      {
        question: 'Ile kosztuje audyt SEO?',
        sources: ['ai_overview'],
        quality: 60,
        weightHint: PAA_SOURCE_WEIGHT,
      },
    ]);
    expect(rows[0]!.maxSourceWeight).toBe(PAA_SOURCE_WEIGHT);
    expect(rows[0]!.questionScore).toBe(
      computeQuestionScore(PAA_SOURCE_WEIGHT, 60, { frequency: 1, engineCoverage: 1 }),
    );
  });
});

describe('clusterQuestions', () => {
  it('exports PLACEHOLDER_THRESHOLD = 0.25', () => {
    expect(PLACEHOLDER_THRESHOLD).toBe(0.25);
  });

  it('tokenizes with shared helper', () => {
    expect(tokenizeForHarvest('Jak działa wojna hybrydowa w praktyce')).toEqual(
      expect.arrayContaining(['dziala', 'wojna', 'hybrydowa', 'praktyce']),
    );
  });

  it('assigns low-confidence questions to placeholder', () => {
    const qs: HarvestedQuestion[] = [
      {
        question: 'Jaka jest pogoda w Krakowie jutro?',
        canonicalKey: 'pogoda w krakowie jutro',
        sources: ['ai_overview'],
        maxSourceWeight: 3,
        quality: 10,
        questionScore: 310,
      },
      {
        question: 'Jak działa wojna hybrydowa w praktyce?',
        canonicalKey: 'dziala wojna hybrydowa w praktyce',
        sources: ['gemini'],
        maxSourceWeight: 4,
        quality: 80,
        questionScore: 480,
      },
    ];
    const { topics, lowConfidenceAssignments } = clusterQuestions(
      ['Wojna hybrydowa — definicja i przykłady'],
      qs,
    );
    expect(lowConfidenceAssignments).toBeGreaterThanOrEqual(1);
    const placeholder = topics.find((t) => t.id === PLACEHOLDER_TOPIC_ID);
    expect(placeholder?.questions.some((q) => /pogoda/i.test(q.question))).toBe(true);
    const hybrid = topics.find((t) => /hybrydowa/i.test(t.title));
    expect(hybrid?.questions.some((q) => /hybrydowa/i.test(q.question))).toBe(true);
    expect(hybrid?.questions[0]?.confidence).toBeGreaterThanOrEqual(PLACEHOLDER_THRESHOLD);
  });
});

describe('enforceBudget', () => {
  function q(score: number, text: string): HarvestedQuestion & { confidence: number } {
    return {
      question: text,
      canonicalKey: text,
      sources: ['ai_overview'],
      maxSourceWeight: 5,
      quality: score % 100,
      questionScore: score,
      confidence: 0.5,
    };
  }

  it('caps per topic at MAX_PER and never drops below MIN_PER when trimming surplus', () => {
    const topics = [
      {
        id: 'a',
        title: 'Topic A with enough length',
        questions: Array.from({ length: 8 }, (_, i) => q(500 - i, `Question A ${i} about topic`)),
      },
      {
        id: 'b',
        title: 'Topic B with enough length',
        questions: Array.from({ length: 3 }, (_, i) => q(400 - i, `Question B ${i} about topic`)),
      },
    ];
    const { topics: out, budgetRemovedQuestions } = enforceBudget(topics);
    const a = out.find((t) => t.id === 'a')!;
    expect(a.questions.length).toBeLessThanOrEqual(MAX_PER);
    expect(a.questions.length).toBeGreaterThanOrEqual(MIN_PER);
    const b = out.find((t) => t.id === 'b')!;
    expect(b.questions.length).toBe(MIN_PER);
    expect(budgetRemovedQuestions).toBeGreaterThan(0);
  });

  it('medianQuestionCount works', () => {
    expect(medianQuestionCount([{ questions: [1, 2] }, { questions: [1] }, { questions: [1, 2, 3, 4] }])).toBe(2);
  });
});

describe('harvestAiCoverage orchestrator', () => {
  it('merges providers, dedupes, clusters, budgets, and reports latency stats', async () => {
    const mockProviders: CoverageProvider[] = [
      {
        id: 'dataforseo_llm',
        fetch: async () => ({
          provider: 'dataforseo_llm',
          latencyMs: 12,
          questions: [
            { question: 'Jak działa wojna hybrydowa?', sources: ['gemini'] },
            { question: 'Czym różni się wojna hybrydowa od wojny konwencjonalnej?', sources: ['chat_gpt'] },
            { question: 'Jakie są przykłady wojny hybrydowej?', sources: ['perplexity'] },
          ],
        }),
      },
      {
        id: 'serp_paa',
        fetch: async () => ({
          provider: 'serp_paa',
          latencyMs: 5,
          weightHint: 3,
          questions: [
            { question: 'Jak dziala wojna hybrydowa', sources: ['ai_overview'] },
            { question: 'Jakie są cele wojny hybrydowej?', sources: ['ai_overview'] },
            { question: 'Kto stosuje wojnę hybrydową?', sources: ['ai_overview'] },
            { question: 'Jak bronić się przed wojną hybrydową?', sources: ['ai_overview'] },
            { question: 'Czym jest dezinformacja w wojnie hybrydowej?', sources: ['ai_overview'] },
            { question: 'Jakie narzędzia wojny hybrydowej są najczęstsze?', sources: ['ai_overview'] },
            { question: 'Czy cyberataki to element wojny hybrydowej?', sources: ['ai_overview'] },
            { question: 'Jak rozpoznać wojnę hybrydową?', sources: ['ai_overview'] },
            { question: 'Jakie państwa prowadzą wojnę hybrydową?', sources: ['ai_overview'] },
          ],
        }),
      },
    ];

    const result = await harvestAiCoverage({
      keyword: 'wojna hybrydowa',
      languageCode: 'pl',
      outlineTitles: [
        'Definicja wojny hybrydowej',
        'Przykłady i case studies',
        'Dezinformacja i cyberataki',
        'Obrona i odporność',
        'Cele i strategie państw',
        'Narzędzia wojny hybrydowej',
      ],
      providers: mockProviders,
      skipFill: true,
    });

    expect(result.stats.rawQuestions).toBeGreaterThan(result.stats.uniqueQuestions);
    expect(result.stats.providerLatency.dataforseo_llm).toBe(12);
    expect(result.stats.providerLatency.serp_paa).toBe(5);
    expect(result.stats.uniqueQuestions).toBeGreaterThanOrEqual(9);
    expect(result.topics.length).toBeGreaterThan(0);
    expect(result.llmQuestions.every((q) => q.sources.length > 0)).toBe(true);

    const hybrid = result.questions.find((q) => /dziala|działa/i.test(q.question) || /hybrydowa/i.test(q.question));
    expect(hybrid).toBeTruthy();
    // Provenance union: PAA + gemini for the same canonical question
    const merged = result.questions.find((q) =>
      q.sources.includes('gemini') && q.sources.includes('ai_overview'),
    );
    expect(merged).toBeTruthy();
  });

  it('returns empty harvest for blank keyword', async () => {
    const result = await harvestAiCoverage({ keyword: '  ' });
    expect(result.stats.uniqueQuestions).toBe(0);
    expect(result.topics).toEqual([]);
  });
});
