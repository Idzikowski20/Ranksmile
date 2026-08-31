import { QueryTypes } from 'sequelize';
import db from '@/database/database';
import type { KeywordResearchResult } from '@/src/core/domain/keywords/types';
import type { WriteRecommendation } from '@/src/core/domain/recommendations/types';
import { topicIdeasToWriteRecs } from '@/src/core/domain/recommendations/writeRecommendations';

/**
 * Surfer-style `write` recommendations for a domain, from its latest completed keyword-research
 * run. Returns [] when the domain has no run yet — the caller keeps its own recs.
 */
export async function loadWriteRecommendations(
  domainId: number,
  opts: { limit?: number } = {},
): Promise<WriteRecommendation[]> {
  const rows = await db.query<{ result_json: string | null }>(
    `SELECT result_json FROM keyword_research_runs
     WHERE domain_id = ? AND status = 'completed' AND result_json IS NOT NULL
     ORDER BY id DESC LIMIT 1`,
    { replacements: [domainId], type: QueryTypes.SELECT },
  ).catch(() => [] as Array<{ result_json: string | null }>);

  const raw = rows[0]?.result_json;
  if (!raw) return [];
  let result: KeywordResearchResult;
  try {
    result = (typeof raw === 'string' ? JSON.parse(raw) : raw) as KeywordResearchResult;
  } catch {
    return [];
  }
  return topicIdeasToWriteRecs(result, opts);
}
