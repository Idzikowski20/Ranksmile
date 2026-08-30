import { filterOnTopicTerms, filterOnTopicKeywords, filterNlpTermsForAnalysis } from '@/src/core/domain/relevance/topicRelevance';

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

describe('interrogatives inside the phrase', () => {
  const seed = 'szantaż emocjonalny';

  it('drops autocomplete questions where the keyword comes first', () => {
    // Google puts the keyword first, so anchoring the rule to the start missed all of these.
    const kept = filterOnTopicTerms(
      terms(
        'szantaż emocjonalny czy jest karalny',
        'szantaż emocjonalny jak się bronić',
        'szantaż emocjonalny co to',
        'szantaż emocjonalny w związku',
      ),
      seed,
    ).map((t) => t.term);

    expect(kept).toEqual(['szantaż emocjonalny w związku']);
  });

  it('keeps a real subtopic rather than shrinking what the article is measured against', () => {
    const kept = filterNlpTermsForAnalysis(
      [{ term: 'szantaż emocjonalny w pracy', target_count: 1 }],
      seed,
    ).map((t) => t.term);

    expect(kept).toEqual(['szantaż emocjonalny w pracy']);
  });
});
