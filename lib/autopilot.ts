/**
 * Topic autopilot: seed a draft from a domain topic, run deep-analysis, then write.
 *
 * Analysis and generation are separate ticks on purpose. Deep-analysis materializes
 * inside its own (long) request, so the cron never waits on it — it fires the request
 * and a later sweep picks up whatever finished. A killed or failed analysis is retried
 * by the same sweep, so an interrupted request costs a tick, not the article.
 */
import db from '../database/database';
import { queryRows } from './db/query';

/** Analysis is considered stuck after this long without a job-row update. */
const STALE_ANALYSIS_MINUTES = 15;
/** Deep-analysis attempts per article before the autopilot gives up on the topic. */
export const MAX_ANALYSIS_ATTEMPTS = 3;

const isPg = Boolean(process.env.DATABASE_URL);
// ponytail: payload LIKE instead of a dedicated column — the flag is written once and
// only read by this sweep. Add an autopilot column if it ever needs indexing/filtering.
const autopilotJob = (alias: string) => `${alias}.job_type = 'deep_analysis' AND ${alias}.payload LIKE '%"autopilot":true%'`;

export type AutopilotAction = 'generate' | 'retry_analysis' | 'skip';

export type AutopilotCandidate = {
   articleId: number;
   jobStatus: string;
   stale: boolean;
   attempts: number;
};

/** Pure decision so the sweep's behaviour is testable without a database. */
export function decideAutopilotAction(candidate: AutopilotCandidate): AutopilotAction {
   if (candidate.jobStatus === 'done') return 'generate';
   if (candidate.attempts >= MAX_ANALYSIS_ATTEMPTS) return 'skip';
   if (candidate.jobStatus === 'failed') return 'retry_analysis';
   if (candidate.stale) return 'retry_analysis';
   return 'skip';
}

/** Draft row in the shape deep-analysis + /articles/[id]/generate expect (keyword mode). */
export async function createAutopilotDraft(domainId: number, keyword: string): Promise<number> {
   // Sequelize is imported lazily: a top-level `sequelize` import in lib/* breaks every
   // Jest suite that touches this module (uuid ESM is not transformed).
   const { QueryTypes } = await import('sequelize');
   const { ensureArticlesTables } = await import('./ensureArticlesTables');
   const { getArticleIdSql } = await import('./articleSql');
   const { getDomainLocale } = await import('./domainLanguage');
   await ensureArticlesTables();
   const articleIdSql = await getArticleIdSql();
   const { languageCode } = await getDomainLocale(domainId);
   const values = [domainId, keyword, '', '', keyword, languageCode];

   if (isPg) {
      const rows = await db.query<{ id: number }>(
         `INSERT INTO articles (domain_id, title, slug, meta_url, content, target_keyword, language, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, '', ?, ?, 'analyzing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING ${articleIdSql} AS id`,
         { replacements: values, type: QueryTypes.SELECT },
      );
      const id = rows[0]?.id;
      if (!id) throw new Error('autopilot draft insert returned no id');
      return id;
   }
   const [newId] = await db.query(
      `INSERT INTO articles (domain_id, title, slug, meta_url, content, target_keyword, language, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, '', ?, ?, 'analyzing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      { replacements: values, type: QueryTypes.INSERT },
   );
   return newId as unknown as number;
}

/** Roll back a seed whose analysis never started — the row is an empty skeleton. */
export async function discardAutopilotDraft(articleId: number): Promise<void> {
   const { getArticleIdSql } = await import('./articleSql');
   const articleIdSql = await getArticleIdSql();
   await db.query(
      `DELETE FROM articles WHERE ${articleIdSql} = ? AND status = 'analyzing' AND (content IS NULL OR content = '')`,
      { replacements: [articleId] },
   );
}

type TriggerArgs = { baseUrl: string; cronSecret: string };

/** Fire-and-forget: deep-analysis materializes in its own request, we only start it. */
export async function triggerAutopilotAnalysis(
   { baseUrl, cronSecret }: TriggerArgs,
   article: { articleId: number; domainId: number; keyword: string },
): Promise<boolean> {
   const res = await fetch(`${baseUrl}/api/articles/deep-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': cronSecret },
      body: JSON.stringify({
         keywords: [article.keyword],
         articleId: article.articleId,
         domainId: article.domainId,
         autopilot: true,
      }),
   });
   // The response is an SSE stream we deliberately don't drain — only the handshake matters.
   if (!res.ok) {
      console.error('[autopilot] deep-analysis rejected:', res.status, (await res.text().catch(() => '')).slice(0, 300));
      return false;
   }
   return true;
}

async function triggerGenerate(
   { baseUrl, cronSecret }: TriggerArgs,
   articleId: number,
): Promise<boolean> {
   const res = await fetch(`${baseUrl}/api/articles/${articleId}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': cronSecret },
      body: JSON.stringify({ contentType: 'blog' }),
   });
   if (!res.ok) {
      console.error('[autopilot] generate rejected:', articleId, res.status, (await res.text().catch(() => '')).slice(0, 300));
      return false;
   }
   return true;
}

type CandidateRow = {
   article_id: number;
   status: string;
   stale: number | boolean;
   domain_id: number | null;
   target_keyword: string | null;
   content: string | null;
   attempts: number;
   generate_jobs: number;
};

/** Latest autopilot analysis per article, with everything the decision needs. */
async function loadCandidates(limit: number): Promise<CandidateRow[]> {
   const { getArticleIdSql } = await import('./articleSql');
   const articleIdSql = await getArticleIdSql();
   const stalePredicate = isPg
      ? `j.updated_at < NOW() - INTERVAL '${STALE_ANALYSIS_MINUTES} minutes'`
      : `j.updated_at < datetime('now', '-${STALE_ANALYSIS_MINUTES} minutes')`;

   return queryRows<CandidateRow>(
      `SELECT j.article_id,
              j.status,
              CASE WHEN ${stalePredicate} THEN 1 ELSE 0 END AS stale,
              a.domain_id,
              a.target_keyword,
              a.content,
              (SELECT COUNT(*) FROM analysis_jobs t
                WHERE t.article_id = j.article_id AND ${autopilotJob('t')}) AS attempts,
              (SELECT COUNT(*) FROM analysis_jobs g
                WHERE g.article_id = j.article_id AND g.job_type = 'article_generate') AS generate_jobs
         FROM analysis_jobs j
         JOIN articles a ON a.${articleIdSql} = j.article_id
        WHERE ${autopilotJob('j')}
          AND j.created_at = (
                SELECT MAX(l.created_at) FROM analysis_jobs l
                 WHERE l.article_id = j.article_id AND l.job_type = 'deep_analysis')
        ORDER BY j.created_at ASC
        LIMIT ?`,
      [limit],
   );
}

export type AutopilotSweepResult = {
   generated: number[];
   retried: number[];
   skipped: number;
};

/**
 * One autopilot tick: generate articles whose analysis finished, restart the ones
 * whose analysis failed or stalled. Already-generating articles are filtered out here
 * and rejected again by the single-in-flight guard in /articles/[id]/generate.
 */
export async function runAutopilotSweep(
   args: TriggerArgs & { limit?: number },
): Promise<AutopilotSweepResult> {
   const limit = args.limit ?? 10;
   const result: AutopilotSweepResult = { generated: [], retried: [], skipped: 0 };
   const all = await loadCandidates(limit);
   // Written or already handed to the Write Engine — nothing left for the autopilot.
   const rows = all.filter((row) => !(row.content || '').trim() && Number(row.generate_jobs) === 0);
   result.skipped = all.length - rows.length;

   for (const row of rows) {
      const action = decideAutopilotAction({
         articleId: row.article_id,
         jobStatus: row.status,
         stale: Boolean(Number(row.stale)),
         attempts: Number(row.attempts) || 1,
      });
      if (action === 'generate') {
         // eslint-disable-next-line no-await-in-loop
         const ok = await triggerGenerate(args, row.article_id);
         if (ok) result.generated.push(row.article_id);
      } else if (action === 'retry_analysis' && row.domain_id && row.target_keyword) {
         // eslint-disable-next-line no-await-in-loop
         const ok = await triggerAutopilotAnalysis(args, {
            articleId: row.article_id,
            domainId: row.domain_id,
            keyword: row.target_keyword,
         });
         if (ok) result.retried.push(row.article_id);
      } else {
         result.skipped += 1;
      }
   }

   return result;
}
