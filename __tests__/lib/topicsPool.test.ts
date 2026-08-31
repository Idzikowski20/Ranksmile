import { curateAiCoverageItems } from '@/src/infrastructure/coverage/curateCoverageItems';

describe('competitor topics in the coverage pool (Surfer parity)', () => {
  const keyword = 'szantaż emocjonalny';

  it('adds on-topic competitor angles as concept items', () => {
    const { knowledge } = curateAiCoverageItems({
      keyword,
      paaQuestions: [{ question: 'Jak rozpoznać szantaż emocjonalny?' }],
      competitorTopics: [
        'Szantaż emocjonalny w związku i rodzinie',
        'Szantaż emocjonalny w miejscu pracy',
      ],
    });
    const concepts = knowledge.filter((k) => k.type === 'concept');
    expect(concepts.length).toBe(2);
    expect(concepts.every((c) => c.category === 'knowledge')).toBe(true);
    expect(knowledge.some((k) => k.type === 'paa')).toBe(true);
  });

  it('drops questions, boilerplate and off-topic from the topics input', () => {
    const { knowledge } = curateAiCoverageItems({
      keyword,
      competitorTopics: [
        'Co to jest szantaż emocjonalny?',
        'Chwilowo nie możesz polubić tej opinii',
        'Najlepsze przepisy na pierogi',
        'Szantaż emocjonalny w pracy',
      ],
    });
    const labels = knowledge.filter((k) => k.type === 'concept').map((k) => k.label);
    expect(labels).toEqual(['Szantaż emocjonalny w pracy']);
  });

  it('does not duplicate a topic that matches a question already added', () => {
    const { knowledge } = curateAiCoverageItems({
      keyword,
      paaQuestions: [{ question: 'Szantaż emocjonalny w związku' }],
      competitorTopics: ['Szantaż emocjonalny w związku'],
    });
    const matching = knowledge.filter((k) => k.label.toLowerCase() === 'szantaż emocjonalny w związku');
    expect(matching.length).toBe(1);
  });
});
