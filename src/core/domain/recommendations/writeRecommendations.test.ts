import { topicIdeasToWriteRecs } from './writeRecommendations';
import type { KeywordResearchResult, TopicCluster, TopicIdea } from '@/src/core/domain/keywords/types';

function idea(main: string, score: number, recommended: boolean, volume = 100, kd = 30): TopicIdea {
  return { main, volume, kd, position: null, keywords: [], score, recommended, clusterIndex: 0 };
}
function result(ideas: TopicIdea[]): KeywordResearchResult {
  const cluster = { index: 0, title: 't', summary: '', kd: 0, volume: 0, covered: 0, total: 0, ideas } as TopicCluster;
  return { clusters: [cluster] } as KeywordResearchResult;
}

describe('topicIdeasToWriteRecs', () => {
  it('keeps only recommended ideas, best score first, and carries Surfer-style metrics', () => {
    const recs = topicIdeasToWriteRecs(result([
      idea('low', 4, true, 200, 40),
      idea('not recommended', 9, false),
      idea('high', 8, true, 900, 20),
    ]));
    expect(recs.map((r) => r.keyword)).toEqual(['high', 'low']);
    expect(recs[0]).toMatchObject({ type: 'create', keyword: 'high', searchVolume: 900, keywordDifficulty: 20, score: 8 });
    expect(recs.some((r) => r.keyword === 'not recommended')).toBe(false);
  });

  it('dedupes repeated head keywords and honours the limit', () => {
    const recs = topicIdeasToWriteRecs(result([
      idea('Prywatny Detektyw', 7, true),
      idea('prywatny detektyw', 6, true),
      idea('inne', 5, true),
    ]), { limit: 2 });
    expect(recs).toHaveLength(2);
    expect(recs.filter((r) => r.keyword.toLowerCase() === 'prywatny detektyw')).toHaveLength(1);
  });

  it('tolerates an empty or malformed result', () => {
    expect(topicIdeasToWriteRecs({ clusters: [] } as unknown as KeywordResearchResult)).toEqual([]);
  });
});
