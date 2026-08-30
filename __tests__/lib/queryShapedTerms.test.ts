import { filterOnTopicTerms, filterOnTopicKeywords } from '@/src/core/domain/relevance/topicRelevance';

const KEYWORD = 'szantaż emocjonalny';
const terms = (...list: string[]) => list.map((term) => ({ term }));

describe('query-shaped NLP terms', () => {
  it('drops translation and file-format suggestions', () => {
    const kept = filterOnTopicTerms(
      terms(
        'szantaż emocjonalny po angielsku',
        'szantaż emocjonalny po angielskiego',
        'susan forward szantaż emocjonalny pdf',
        'przemoc emocjonalna',
      ),
      KEYWORD,
    ).map((t) => t.term);

    expect(kept).toEqual(['przemoc emocjonalna']);
  });

  it('drops question-shaped suggestions but keeps real phrases', () => {
    const kept = filterOnTopicTerms(
      terms(
        'czy szantaż emocjonalny jest karalny',
        'co grozi za szantaż emocjonalny',
        'szantaż emocjonalny w związku',
        'manipulacja emocjonalna',
      ),
      KEYWORD,
    ).map((t) => t.term);

    expect(kept).toEqual(['szantaż emocjonalny w związku', 'manipulacja emocjonalna']);
  });

  it('leaves keyword rows alone — a keyword is supposed to look like a query', () => {
    const kept = filterOnTopicKeywords(
      [{ keyword: 'czy szantaż emocjonalny jest karalny' }],
      KEYWORD,
    );

    expect(kept).toHaveLength(1);
  });
});
