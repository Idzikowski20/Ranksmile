import { filterOnTopicTerms, filterOnTopicKeywords, filterNlpTermsForAnalysis, dropSuggestionTailsWhenCorpusRich, questionsFromSuggestions } from '@/src/core/domain/relevance/topicRelevance';

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

describe('dropSuggestionTailsWhenCorpusRich', () => {
  const seed = 'szantaż emocjonalny';
  const corpusRow = (term: string, i: number) => ({ term: `${term} ${i}`, doc_freq: 3, relevance: 0.7, type: 'entity' });
  const richCorpus = Array.from({ length: 30 }, (_, i) => corpusRow('poczucie winy wariant', i));

  it('drops metadata-less keyword tails once the corpus harvest is rich', () => {
    const kept = dropSuggestionTailsWhenCorpusRich(
      [...richCorpus,
        { term: 'szantaż emocjonalny empik' },
        { term: 'foch szantaż emocjonalny' },
        { term: 'szantaż emocjonalny' },
      ],
      seed,
    ).map((t) => t.term);

    expect(kept).not.toContain('szantaż emocjonalny empik');
    expect(kept).not.toContain('foch szantaż emocjonalny');
    expect(kept).toContain('szantaż emocjonalny');
  });

  it('keeps every suggestion while the corpus is thin — they still fill the gap', () => {
    const thin = [
      { term: 'poczucie winy', doc_freq: 3, relevance: 0.7, type: 'entity' },
      { term: 'szantaż emocjonalny empik' },
    ];
    expect(dropSuggestionTailsWhenCorpusRich(thin, seed)).toHaveLength(2);
  });

  it('keeps an evidenced subtopic that repeats the keyword', () => {
    const kept = dropSuggestionTailsWhenCorpusRich(
      [...richCorpus, { term: 'szantaż emocjonalny w związku', doc_freq: 6, relevance: 0.8, type: 'entity' }],
      seed,
    ).map((t) => t.term);

    expect(kept).toContain('szantaż emocjonalny w związku');
  });
});

describe('questionsFromSuggestions', () => {
  const seed = 'szantaż emocjonalny';

  it("routes Surfer's questions out of the suggestion pool", () => {
    const qs = questionsFromSuggestions(
      [
        { term: 'co grozi za szantaż emocjonalny' },
        { term: 'szantaż emocjonalny gdzie zgłosić' },
        { term: 'szantaż emocjonalny jak się bronić' },
        { term: 'szantaż emocjonalny pdf' },
        { term: 'przemoc psychiczna' },
      ],
      seed,
    );

    expect(qs).toContain('co grozi za szantaż emocjonalny?');
    expect(qs).toContain('szantaż emocjonalny gdzie zgłosić?');
    expect(qs).toContain('szantaż emocjonalny jak się bronić?');
    expect(qs.join(' ')).not.toMatch(/pdf/);
    expect(qs.join(' ')).not.toMatch(/przemoc psychiczna/);
  });

  it('dedupes and caps', () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ term: `szantaż emocjonalny jak reagować wariant ${i}` }));
    expect(questionsFromSuggestions(rows, seed).length).toBeLessThanOrEqual(8);
  });
});
