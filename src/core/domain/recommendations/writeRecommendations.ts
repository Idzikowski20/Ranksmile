import type { KeywordResearchResult } from '@/src/core/domain/keywords/types';
import type { WriteRecommendation } from './types';

/**
 * Turn a keyword-research run into Surfer-style `write` recommendations: the recommended,
 * not-yet-covered topic ideas, each a head keyword with its search volume, difficulty and
 * opportunity score — the same shape Surfer's `write` items carry (main_keyword,
 * search_volume, avg_difficulty). Best opportunity first.
 */
export function topicIdeasToWriteRecs(
  result: KeywordResearchResult,
  opts: { limit?: number } = {},
): WriteRecommendation[] {
  const recs: WriteRecommendation[] = [];
  const seen = new Set<string>();
  for (const cluster of result.clusters ?? []) {
    for (const idea of cluster.ideas ?? []) {
      // Recommended = the run's own "worth writing" flag; skip anything already covered.
      if (!idea.recommended) continue;
      const key = idea.main.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      recs.push({
        type: 'create',
        keyword: idea.main,
        searchVolume: idea.volume,
        keywordDifficulty: idea.kd,
        score: idea.score,
      });
    }
  }
  recs.sort((a, b) => b.score - a.score);
  return recs.slice(0, opts.limit ?? 25);
}
