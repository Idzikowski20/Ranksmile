jest.mock('../../lib/dataforseo', () => ({
  getPeopleAlsoAsk: jest.fn(),
  isDataForSeoConfigured: jest.fn().mockReturnValue(true),
}));
jest.mock('../../lib/cache/fileCache', () => ({
  cached: jest.fn(({ producer }: { producer: () => Promise<unknown> }) => producer()),
  TTL: { SERP: 1 },
}));

import { getPeopleAlsoAsk } from '../../lib/dataforseo';
import {
  factsToCoverageItems,
  factsToVisibilitySummary,
  mergeVisibilitySummaries,
  factReadinessScore,
  splitFactSentences,
  fetchArticleFacts,
  type ArticleFact,
} from '../../lib/articleFacts';
import type { AiVisibilitySummary } from '../../lib/aiSearchScore';

const mockPaa = getPeopleAlsoAsk as jest.MockedFunction<typeof getPeopleAlsoAsk>;

describe('articleFacts', () => {
  beforeEach(() => {
    mockPaa.mockReset();
  });

  it('splits corpus text into fact-sized sentences', () => {
    const sentences = splitFactSentences('Prywatny detektyw oferuje uslugi w Warszawie. Krotkie.');
    expect(sentences).toHaveLength(1);
    expect(sentences[0]).toContain('Prywatny detektyw');
  });

  it('scores article readiness from token overlap', () => {
    const article = 'Biuro detektywistyczne w Warszawie oferuje prywatny detektyw i sledztwa cywilne.';
    const high = factReadinessScore(article, 'Prywatny detektyw w Warszawie oferuje uslugi detektywistyczne.');
    const low = factReadinessScore(article, 'Zupelnie inna tematyka bez wspolnych slow kluczowych.');
    expect(high).toBeGreaterThan(low);
    expect(high).toBeGreaterThanOrEqual(40);
  });

  it('maps facts to coverage items with knowledge category', () => {
    const facts: ArticleFact[] = [
      { id: 'f1', text: 'Detektyw prywatny moze prowadzic sprawy cywilne.', sourceFrequency: 2, sources: [{ kind: 'paa' }] },
    ];
    const items = factsToCoverageItems(facts);
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('fact');
    expect(items[0].source).toBe('paa');
    expect(items[0].importance).toBe('critical');
  });

  it('fetches facts from DataForSEO PAA answers only', async () => {
    mockPaa.mockResolvedValue({
      questions: [
        {
          question: 'ile kosztuje prywatny detektyw w warszawie',
          answer: 'Prywatny detektyw w Warszawie kosztuje od 150 do 400 zł za godzinę pracy w zależności od sprawy.',
          domain: 'example.com',
          url: 'https://example.com/cennik',
        },
        {
          question: 'cuckolding co to znaczy',
          answer: 'Cuckolding to zjawisko psychoseksualne niezwiazane z detektywistyką.',
          domain: 'slownik.pl',
          url: 'https://slownik.pl',
        },
      ],
      related: [],
    });

    const facts = await fetchArticleFacts({
      keyword: 'prywatny detektyw warszawa',
      resolvedKeyword: 'prywatny detektyw warszawa',
      articleText: 'Prywatny detektyw w Warszawie prowadzi sprawy cywilne i oferuje usługi detektywistyczne.',
      country: 'PL',
      languageCode: 'pl',
    });

    expect(facts.length).toBeGreaterThan(0);
    expect(facts.some((f) => f.text.toLowerCase().includes('cuckolding'))).toBe(false);
    expect(facts.every((f) => f.sources[0]?.kind === 'paa')).toBe(true);
  });

  it('does not surface synthetic template questions in visibility summary', () => {
    const facts: ArticleFact[] = [
      { id: 'f1', text: 'prywatny detektyw Warszawa czy warto?', sourceFrequency: 1, sources: [{ kind: 'chat_gpt' }] },
      { id: 'f2', text: 'Prywatny detektyw w Warszawie kosztuje od 150 do 400 zł za godzinę pracy.', sourceFrequency: 1, sources: [{ kind: 'paa' }] },
    ];
    const summary = factsToVisibilitySummary(facts, 'Detektyw prywatny prowadzi sprawy cywilne w biurze.');
    expect(summary.prompts_total).toBe(1);
    expect(summary.citations[0].prompt).toContain('kosztuje');
    expect(summary.citations[0].prompt).not.toContain('czy warto');
  });

  it('filters off-topic LLM filler from visibility summary', () => {
    const facts: ArticleFact[] = [
      { id: 'f2', text: 'Czy chcesz, żebym pomógł znaleźć więcej informacji na ten temat?', sourceFrequency: 1, sources: [{ kind: 'paa' }] },
    ];
    const summary = factsToVisibilitySummary(facts, 'Detektyw prywatny prowadzi sprawy cywilne w biurze.');
    expect(summary.prompts_total).toBe(0);
  });

  it('dedupes citations when merging visibility summaries', () => {
    const primary: AiVisibilitySummary = factsToVisibilitySummary(
      [{ id: 'f1', text: 'Prywatny detektyw w Warszawie kosztuje od 150 do 400 zł za godzinę.', sourceFrequency: 1, sources: [{ kind: 'paa' }] }],
      'Detektyw prywatny w Warszawie.',
    );
    const secondary: AiVisibilitySummary = {
      prompts_total: 1,
      prompts_cited: 0,
      competitor_citations: 0,
      extractability_score: 0,
      citations: [{ prompt: 'prywatny detektyw warszawa kosztuje od 150 do 400 zl za godzine', answer_readiness_score: 50 }],
    };
    const merged = mergeVisibilitySummaries(primary, secondary);
    expect(merged.citations).toHaveLength(2);
  });
});
