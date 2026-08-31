import { researchedFactsToDaSeeds } from '@/src/core/intelligence/loadDaFactSeeds';

describe('researchedFactsToDaSeeds', () => {
  const facts = {
    claims: [
      'Szantaż emocjonalny to technika manipulacji przez poczucie winy.',
      'Najczęściej stosują go osoby bliskie ofierze.',
      'x', // too short — dropped
      'Szantaż emocjonalny to technika manipulacji przez poczucie winy.', // dup — dropped
    ],
    sources: [
      { cited_by: ['perplexity', 'openai'], source_urls: ['https://pl.wikipedia.org/wiki/x', 'https://www.medonet.pl/y'] },
      { cited_by: ['google', 'gemini'], source_urls: ['https://health.clevelandclinic.org/z'] },
      {},
      {},
    ],
  };

  it('maps engines to CCM taxonomy and keeps source websites', () => {
    const seeds = researchedFactsToDaSeeds(facts, 'some article plain text');
    expect(seeds).toHaveLength(2);

    // perplexity stays; openai -> chat_gpt
    expect(seeds[0].citedBy).toEqual(['perplexity', 'chat_gpt']);
    expect(seeds[0].sourceUrls).toEqual(['https://pl.wikipedia.org/wiki/x', 'https://www.medonet.pl/y']);
    expect(seeds[0].domain).toBe('pl.wikipedia.org');

    // google -> ai_overview; gemini stays
    expect(seeds[1].citedBy).toEqual(['ai_overview', 'gemini']);
  });

  it('is empty for missing facts', () => {
    expect(researchedFactsToDaSeeds(null, 'x')).toHaveLength(0);
    expect(researchedFactsToDaSeeds({ claims: [] }, 'x')).toHaveLength(0);
  });
});
