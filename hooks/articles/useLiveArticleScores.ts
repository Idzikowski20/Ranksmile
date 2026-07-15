import { useMemo } from 'react';
import { computeLiveArticleScores, type LiveArticleScores, type LiveArticleScoresInput } from '../../lib/computeLiveArticleScores';

export function useLiveArticleScores(input: LiveArticleScoresInput): LiveArticleScores {
  return useMemo(() => computeLiveArticleScores(input), [
    input.plainText,
    input.wordCount,
    input.headingCount,
    input.html,
    input.scoreData,
    input.keyword,
    input.keywordCoverage,
    input.coverageItems,
    input.coverageSnapshot,
    input.aiVisibilitySummary,
    input.internalLinksCount,
    input.htmlForScoring,
    input.fallbackScore,
  ]);
}
