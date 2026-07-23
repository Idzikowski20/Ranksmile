/**
 * Learning loop persistence + re-exports pure core.
 */
import db from '../../database/database';
import { ensureCorpusTables } from '../ensureCorpusTables';

export { runLearningLoop, type LearningUpdate } from './learningLoopCore';

export type OptimizationEvent = {
  workspaceId: string;
  articleId?: number;
  changeType: string;
  changeDetail?: Record<string, unknown>;
  beforeScore?: number;
  afterScore?: number;
  rankingDelta?: number;
  aiCitationDelta?: number;
};

export async function recordOptimization(event: OptimizationEvent): Promise<void> {
  await ensureCorpusTables();
  await db.query(
    `INSERT INTO optimization_history
      (workspace_id, article_id, change_type, change_detail, before_score, after_score,
       ranking_delta, ai_citation_delta)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    {
      replacements: [
        event.workspaceId,
        event.articleId ?? null,
        event.changeType,
        JSON.stringify(event.changeDetail ?? {}),
        event.beforeScore ?? null,
        event.afterScore ?? null,
        event.rankingDelta ?? null,
        event.aiCitationDelta ?? null,
      ],
    },
  );
}
