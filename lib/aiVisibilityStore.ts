// Shared persistence for an AI-visibility run + its citations.
// Used by both the manual /ai-visibility endpoint and the deep-analysis pipeline
// so the editor's "AI Search — Info to cover" list is populated either way.
import { QueryTypes } from 'sequelize';
import db from '../database/database';
import { computeAiSearchScore, type AiVisibilitySummary } from './aiSearchScore';

/** Insert one ai_visibility_runs row (+ citations) and return the run id. */
export async function persistAiVisibilityRun(
   articleId: number | string,
   keyword: string,
   summary: AiVisibilitySummary,
   scoreOverride?: number,
): Promise<number> {
   const score = scoreOverride ?? computeAiSearchScore(summary);
   const runValues = [
      articleId,
      keyword || '',
      score,
      summary.prompts_total || 0,
      summary.prompts_cited || 0,
      summary.competitor_citations || 0,
      JSON.stringify(summary),
   ];

   let runId: number | undefined;
   if (process.env.DATABASE_URL) {
      const rows = await db.query<{ id: number }>(
         `INSERT INTO ai_visibility_runs
            (article_id, target_keyword, score, prompts_total, prompts_cited, competitor_citations, summary_json, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          RETURNING id`,
         { replacements: runValues, type: QueryTypes.SELECT },
      );
      runId = rows[0]?.id;
   } else {
      const [insertedRunId] = await db.query(
         `INSERT INTO ai_visibility_runs
            (article_id, target_keyword, score, prompts_total, prompts_cited, competitor_citations, summary_json, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
         { replacements: runValues, type: QueryTypes.INSERT },
      );
      runId = insertedRunId as unknown as number;
   }
   if (!runId) throw new Error('Failed to resolve AI visibility run id');

   const citations = summary.citations || [];
   if (citations.length) {
      const placeholders = citations.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)').join(', ');
      const replacements = citations.flatMap((c) => [
         runId,
         c.prompt,
         c.answer || '',
         c.cited_url || '',
         c.cited_domain || '',
         c.is_own_domain ? 1 : 0,
         c.is_competitor ? 1 : 0,
         '',
      ]);
      await db.query(
         `INSERT INTO ai_visibility_citations
            (run_id, prompt, answer, cited_url, cited_domain, is_own_domain, is_competitor, sentiment, created_at)
          VALUES ${placeholders}`,
         { replacements },
      ).catch(() => {});
   }
   return runId;
}
