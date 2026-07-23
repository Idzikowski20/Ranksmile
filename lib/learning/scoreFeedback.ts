/**
 * Closed-loop learning: score deltas → optimization_history + calibration persist.
 */
import type { Feature } from '../primitives/types';
import { recordOptimization } from '../learning/learningLoop';
import { calibrateAndPersist, extractFeatureVector } from '../engines/calibration';
import { getErrorMessage } from '../errors';

export async function recordScoreFeedback(opts: {
  workspaceId: string;
  articleId: number;
  changeType: string;
  beforeScore?: number;
  afterScore?: number;
  rankingDelta?: number;
  aiCitationDelta?: number;
  feature?: Feature;
}): Promise<void> {
  try {
    await recordOptimization({
      workspaceId: opts.workspaceId,
      articleId: opts.articleId,
      changeType: opts.changeType,
      changeDetail: {
        beforeScore: opts.beforeScore,
        afterScore: opts.afterScore,
      },
      beforeScore: opts.beforeScore,
      afterScore: opts.afterScore,
      rankingDelta: opts.rankingDelta,
      aiCitationDelta: opts.aiCitationDelta,
    });

    if (opts.feature && opts.afterScore != null) {
      await calibrateAndPersist(opts.workspaceId, [opts.feature], [opts.afterScore]);
    } else if (opts.afterScore != null && opts.beforeScore != null) {
      // Minimal synthetic feature from score delta
      const synthetic: Feature = {
        id: `score:${opts.articleId}`,
        version: Date.now(),
        createdAt: new Date().toISOString(),
        score: {
          score: opts.afterScore,
          confidence: 0.5,
          version: 1,
          contributors: [],
        },
        confidence: 0.5,
        signals: [
          { id: 'before', key: 'before_score', value: opts.beforeScore },
          { id: 'after', key: 'after_score', value: opts.afterScore },
        ],
        actions: [],
      };
      void extractFeatureVector(synthetic);
      await calibrateAndPersist(opts.workspaceId, [synthetic], [opts.afterScore]);
    }
  } catch (err: unknown) {
    console.warn('[recordScoreFeedback] failed:', getErrorMessage(err));
  }
}
