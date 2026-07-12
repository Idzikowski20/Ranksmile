import {
  factsToCoverageItems,
  factsToVisibilitySummary,
  mergeVisibilitySummaries,
  factReadinessScore,
  splitFactSentences,
  type ArticleFact,
} from '../../lib/articleFacts';
import type { AiVisibilitySummary } from '../../lib/aiSearchScore';

describe('articleFacts', () => {
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
      { id: 'f1', text: 'Detektyw prywatny moze prowadzic sprawy cywilne.', sourceFrequency: 2, sources: [{ kind: 'serp' }] },
    ];
    const items = factsToCoverageItems(facts);
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('fact');
    expect(items[0].category).toBe('knowledge');
    expect(items[0].importance).toBe('critical');
  });

  it('builds visibility summary from citation prompts only', () => {
    const facts: ArticleFact[] = [
      { id: 'f1', text: 'prywatny detektyw Warszawa czy warto?', sourceFrequency: 1, sources: [{ kind: 'chat_gpt' }] },
      { id: 'f2', text: 'Lubimyczytac.pl nie prowadzi sprzedazy.', sourceFrequency: 1, sources: [{ kind: 'serp' }] },
    ];
    const summary = factsToVisibilitySummary(facts, 'Detektyw prywatny prowadzi sprawy cywilne w biurze.');
    expect(summary.prompts_total).toBe(1);
    expect(summary.citations[0].prompt).toContain('czy warto');
  });

  it('dedupes citations when merging visibility summaries', () => {
    const primary: AiVisibilitySummary = factsToVisibilitySummary(
      [{ id: 'f1', text: 'prywatny detektyw Warszawa czy warto?', sourceFrequency: 1, sources: [{ kind: 'serp' }] }],
      '',
    );
    const secondary: AiVisibilitySummary = {
      prompts_total: 1,
      prompts_cited: 0,
      competitor_citations: 0,
      extractability_score: 0,
      citations: [{ prompt: 'prywatny detektyw warszawa czy warto?', answer_readiness_score: 50 }],
    };
    const merged = mergeVisibilitySummaries(primary, secondary);
    expect(merged.citations).toHaveLength(1);
  });
});
