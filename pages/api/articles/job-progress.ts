// POST /api/articles/job-progress — Called by Python sidecar during pipeline execution.
// GET  /api/articles/job-progress — Polled by frontend for per-step progress display.
import type { NextApiRequest, NextApiResponse } from 'next';
import { QueryTypes } from 'sequelize';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import { getCurrentUserId } from '../../../utils/getUser';
import { assertArticleAccess } from '../../../lib/tenancy';
import { verifyDomainOwnershipById } from '../../../utils/verifyDomainOwnership';
import { ensureArticlesTables } from '../../../lib/ensureArticlesTables';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';
import { affectedRows } from '../../../lib/queueRunner';
import { publicDeepAnalysisError } from '../../../lib/deepAnalysisErrors';
import { safeJsonParse } from '../../../lib/safeJson';
import {
  mergePhases, phasesFromStage, type AnalysisPhases, type AnalysisPhasesPatch,
} from '../../../lib/analysisPhases';

const FINALIZING_STALE_SECS = 5 * 60;
const isPg = Boolean(process.env.DATABASE_URL);

type JobAccessRow = {
  id: string;
  status?: string;
  job_type: string | null;
  domain_id: number | null;
  article_id: number | null;
};

async function canReadJob(userId: string | null, job: JobAccessRow): Promise<boolean> {
  if (job.domain_id && job.job_type === 'domain_setup') {
    return Boolean(await verifyDomainOwnershipById(Number(job.domain_id), userId));
  }
  if (job.article_id && Number(job.article_id) > 0) {
    return assertArticleAccess(userId, Number(job.article_id));
  }
  return false;
}

async function failStaleFinalization(job: JobAccessRow): Promise<boolean> {
  const stalePredicate = isPg
    ? `updated_at < NOW() - INTERVAL '${FINALIZING_STALE_SECS} seconds'`
    : `updated_at < datetime('now', '-${FINALIZING_STALE_SECS} seconds')`;
  const recovered = await db.transaction(async (transaction) => {
    const claim = await db.query(
      `UPDATE analysis_jobs
       SET status = 'failed', error = 'finalizing timed out', updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'finalizing' AND ${stalePredicate}`,
      { replacements: [job.id], transaction },
    );
    if (affectedRows(claim) === 0) return false;
    if (job.article_id) {
      const { getArticleIdSql } = await import('../../../lib/articleSql');
      const articleIdSql = await getArticleIdSql();
      await db.query(
        `UPDATE articles SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
        { replacements: [job.article_id], transaction },
      );
    }
    return true;
  });
  if (recovered && job.job_type === 'domain_setup' && job.domain_id) {
    const { releaseSiteAuditRun } = await import('../../../lib/quota/siteAudit');
    await releaseSiteAuditRun(Number(job.domain_id), job.id).catch(() => {});
  }
  return recovered;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  await ensureArticlesTables();

  // Auth: internal token (Python sidecar), cron secret (eval suite), or session cookie.
  const internalToken = req.headers['x-internal-token'];
  const isInternal = Boolean(
    process.env.INTERNAL_PIPELINE_TOKEN
      && typeof internalToken === 'string'
      && internalToken === process.env.INTERNAL_PIPELINE_TOKEN,
  );
  const { assertCronSecret } = await import('../../../lib/cronAuth');
  const isCron = assertCronSecret(req);

  if (!isInternal && !isCron) {
    const authorized = await verifyUser(req, res);
    if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  }

  // ── GET: poll job state (frontend) ──────────────────────────────
  if (req.method === 'GET') {
    const jobId = req.query.jobId as string | undefined;
    const articleId = req.query.articleId as string | undefined;
    // Default deep_analysis: import/editor hooks and deep-analysis page poll by articleId.
    // article_generate must be requested explicitly — otherwise a finished deep_analysis
    // job makes /articles/generating skip /generate and open an empty draft.
    const jobTypeRaw = typeof req.query.jobType === 'string' ? req.query.jobType.trim() : '';
    const jobType = jobTypeRaw || 'deep_analysis';
    if (!jobId && !articleId) {
      return res.status(400).json({ error: 'jobId or articleId query param is required' });
    }

    try {
      if (!isInternal && !isCron && articleId) {
        const userId = await getCurrentUserId(req, res);
        if (!(await assertArticleAccess(userId, Number(articleId)))) {
          return res.status(403).json({ error: 'Access denied.' });
        }
      }

      const rows = await db.query<JobAccessRow & {
        status: string;
        current_stage: string | null;
        stage_progress: number | null;
        total_progress: number | null;
        progress_message: string | null;
        progress_json: string | null;
        error: string | null;
        updated_at: string | Date | null;
      }>(
        jobId
          ? `SELECT id, job_type, domain_id, article_id, status, current_stage, stage_progress,
                    total_progress, progress_message, progress_json, error, updated_at
             FROM analysis_jobs WHERE id = ?`
          : `SELECT id, job_type, domain_id, article_id, status, current_stage, stage_progress,
                    total_progress, progress_message, progress_json, error, updated_at
             FROM analysis_jobs
             WHERE article_id = ? AND job_type = ?
             ORDER BY created_at DESC, id DESC
             LIMIT 1`,
        { replacements: jobId ? [jobId] : [Number(articleId), jobType], type: QueryTypes.SELECT },
      );

      if (!rows.length) return res.status(404).json({ error: 'job not found' });

      const j = rows[0];
      if (!isInternal && !isCron) {
        const userId = await getCurrentUserId(req, res);
        if (!(await canReadJob(userId, j))) {
          return res.status(403).json({ error: 'Access denied.' });
        }
      }

      if (j.status === 'finalizing' && await failStaleFinalization(j)) {
        j.status = 'failed';
        j.error = 'finalizing timed out';
        j.progress_message = 'Finalization timed out';
      }
      const publicJobError = j.status === 'failed' && j.job_type === 'deep_analysis'
        ? publicDeepAnalysisError(j.error, j.current_stage)
        : null;

      return res.status(200).json({
        jobId: j.id,
        jobType: j.job_type,
        status: j.status,
        currentStage: j.current_stage,
        stageProgress: j.stage_progress,
        totalProgress: j.total_progress,
        progressMessage: publicJobError || j.progress_message,
        phases: safeJsonParse<AnalysisPhases | null>(j.progress_json, null),
        error: publicJobError,
        updatedAt: j.updated_at ? new Date(j.updated_at).toISOString() : null,
      });
    } catch (err) {
      const msg = (err instanceof Error ? err.message : String(err));
      console.error('[job-progress] GET failed:', msg);
      return res.status(500).json({ error: 'Failed to load job progress' });
    }
  }

  // ── POST: update progress (Python sidecar) ──────────────────────
  if (req.method === 'DELETE') {
    const jobId = typeof req.query.jobId === 'string' ? req.query.jobId : '';
    if (!jobId) return res.status(400).json({ error: 'jobId query param is required' });
    const userId = await getCurrentUserId(req, res);
    const rows = await db.query<JobAccessRow>(
      'SELECT id, status, job_type, domain_id, article_id FROM analysis_jobs WHERE id = ?',
      { replacements: [jobId], type: QueryTypes.SELECT },
    );
    const job = rows[0];
    if (!job) return res.status(404).json({ error: 'job not found' });
    if (!(await canReadJob(userId, job))) return res.status(403).json({ error: 'Access denied.' });
    // This endpoint is used only by ArticleEditor. Domain setup owns a separate quota
    // reservation lifecycle and must not be canceled here.
    if (job.job_type !== 'article_generate' || !job.article_id) {
      return res.status(409).json({ error: 'job cannot be canceled here' });
    }

    const canceled = await db.transaction(async (transaction) => {
      const claim = await db.query(
        `UPDATE analysis_jobs
         SET status = 'canceled', error = 'canceled_by_user', updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND status IN ('queued', 'running')`,
        { replacements: [jobId], transaction },
      );
      if (affectedRows(claim) === 0) return false;
      const { getArticleIdSql } = await import('../../../lib/articleSql');
      const articleIdSql = await getArticleIdSql();
      await db.query(
        `UPDATE articles SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
        { replacements: [job.article_id], transaction },
      );
      return true;
    });
    if (!canceled) return res.status(409).json({ error: 'job already finishing or finished' });
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isInternal) return res.status(401).json({ error: 'Unauthorized' });

  const { jobId, currentStage, stageProgress, totalProgress, message, status, result } = req.body;
  if (!jobId) return res.status(400).json({ error: 'jobId is required' });

  try {
    if (status === 'done' || status === 'failed') {
      const jrows = await db.query<{ job_type: string; domain_id: number | null; article_id: number | null }>(
        `SELECT job_type, domain_id, article_id FROM analysis_jobs WHERE id = ?`,
        { replacements: [jobId], type: QueryTypes.SELECT },
      );
      if (!jrows.length) return res.status(404).json({ error: 'job not found' });
      if (await failStaleFinalization({ id: jobId, ...jrows[0] })) {
        return res.status(409).json({ error: 'job finalization timed out' });
      }
      // Claim terminal handling before materializing any result. DELETE competes on the
      // same queued/running states, so exactly one of cancellation or materialization wins.
      const claim = await db.query(
        `UPDATE analysis_jobs SET status = 'finalizing', updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND status IN ('queued', 'running')`,
        { replacements: [jobId] },
      );
      if (affectedRows(claim) === 0) return res.status(409).json({ error: 'job canceled or already finalized' });

      // terminal callback
      const jt = jrows[0]?.job_type;
      const domainId = jrows[0]?.domain_id;
      const genArticleId = jrows[0]?.article_id;
      if (status === 'done' && jt === 'domain_setup' && domainId) {
        const { materializeDomainSetup } = await import('../../../lib/domainPipeline');
        try {
          await materializeDomainSetup(Number(domainId), result || {});
          const { closeSiteAuditRun } = await import('../../../lib/quota/siteAudit');
          await closeSiteAuditRun(Number(domainId), jobId).catch(() => {});
          void import('../../../lib/siteAudit/crawlSnapshot')
            .then((m) => m.saveCrawlSnapshot(Number(domainId)))
            .catch((err) => { console.warn('[job-progress] crawl snapshot failed (non-fatal):', err); });
          // Fire-and-forget: pre-scan the shared Organic Competitors store for the
          // domain's top keywords so they're ready in the audit/editor modal.
          void import('../../../lib/competitorPrescan')
            .then((m) => m.prescanDomainCompetitors(Number(domainId)))
            .then(() => import('../../../lib/scoreDomainPages').then((m) => m.scoreDomainPages(Number(domainId))))
            .catch((err) => { console.warn('[job-progress] domain page scoring failed (non-fatal):', err); });
        } catch (e) {
          // Materialization (delete+insert tx) failed — DON'T leave the job 'running'
          // (Retry only re-claims queued/failed/stale-running, so a stuck 'running' job
          // would be dead for the 10-min staleness window). Mark it failed so Retry works now.
          const msg = e instanceof Error ? e.message : String(e);
          await db.query(
            `UPDATE analysis_jobs SET status = 'failed', error = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND status = 'finalizing'`,
            { replacements: [`materialize failed: ${msg}`, jobId] },
          );
          const { releaseSiteAuditRun } = await import('../../../lib/quota/siteAudit');
          await releaseSiteAuditRun(Number(domainId), jobId).catch(() => {});
          return res.status(500).json({ error: 'materialization failed' });
        }
      } else if (status === 'failed' && jt === 'domain_setup' && domainId) {
        const { releaseSiteAuditRun } = await import('../../../lib/quota/siteAudit');
        await releaseSiteAuditRun(Number(domainId), jobId).catch(() => {});
      }
      if (jt === 'article_generate' && genArticleId) {
        const { getArticleIdSql } = await import('../../../lib/articleSql');
        const articleIdSql = await getArticleIdSql();
        if (status === 'done') {
          const html = (result?.article_html as string) || '';
          const { isUsableArticleHtml, stripHtmlToPlain } = await import('../../../lib/articleHtmlUsable');
          // Never wipe a draft with an empty LLM response — fail the job so the UI can retry.
          if (!isUsableArticleHtml(html)) {
            await db.query(
              `UPDATE analysis_jobs SET status = 'failed', error = ?, updated_at = CURRENT_TIMESTAMP
               WHERE id = ? AND status = 'finalizing'`,
              { replacements: ['empty_article_html', jobId] },
            );
            await db.query(
              `UPDATE articles SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
              { replacements: [genArticleId] },
            );
            return res.status(422).json({ error: 'empty_article_html' });
          }
          const plain = stripHtmlToPlain(html);
          const wordCount = plain.split(/\s+/).filter(Boolean).length;
          const { reconcilePostGenerateArticle } = await import('../../../lib/reconcilePostGenerateArticle');
          const sidecarScore = (result?.score_data && typeof result.score_data === 'object')
            ? result.score_data as import('../../../lib/contentScore').ScoreData
            : { terms: [], words_target: 2000, words_min: 1500, words_max: 2500, headings_target: 15, headings_min: 10, headings_max: 20 };
          const reconciled = await reconcilePostGenerateArticle({
            articleId: Number(genArticleId),
            html,
            sidecarScoreData: sidecarScore,
          }).catch((err) => {
            console.warn('[job-progress] post-generate reconcile failed (non-fatal):', err);
            return null;
          });
          const scoreJson = JSON.stringify(reconciled?.scoreData ?? sidecarScore);
          const contentScore = reconciled?.contentScore ?? null;
          await db.query(
            `UPDATE articles SET
               title = COALESCE(?, title), content = ?, meta_title = ?, meta_description = ?, meta_url = ?,
               schema_json = ?, score_data = ?, internal_links_cache = ?, word_count = ?,
               ai_info_to_cover = COALESCE(?, ai_info_to_cover),
               content_score = COALESCE(?, content_score),
               status = 'draft', updated_at = CURRENT_TIMESTAMP
             WHERE ${articleIdSql} = ?`,
            { replacements: [
              result?.meta_title || null,
              html,
              result?.meta_title || '',
              result?.meta_description || '',
              result?.meta_url || '',
              JSON.stringify(result?.article_schema || result?.schema_json || {}),
              scoreJson,
              JSON.stringify({ suggestions: result?.internal_links || [] }),
              wordCount,
              reconciled?.aiInfoToCover ?? null,
              contentScore,
              genArticleId,
            ] },
          );
        } else {
          // failed → roll the placeholder back to an editable draft so the user can retry.
          await db.query(
            `UPDATE articles SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
            { replacements: [genArticleId] },
          );
        }
      }
      await db.query(
        `UPDATE analysis_jobs SET status = ?, result = COALESCE(?, result), error = ?, total_progress = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND status = 'finalizing'`,
        { replacements: [
          status,
          result ? JSON.stringify(result) : null,
          status === 'failed' ? (message || 'failed') : null,
          status === 'done' ? 100 : null,
          jobId,
        ] },
      );
      return res.status(200).json({ ok: true });
    }

    // Typed phases: an explicit patch from the sidecar wins, otherwise derive what the
    // stage implies. Stored merged so a later event never erases an earlier phase.
    const { phases: phasePatch } = req.body as { phases?: AnalysisPhasesPatch };
    const prevRows = await db.query<{ progress_json: string | null }>(
      `SELECT progress_json FROM analysis_jobs WHERE id = ?`,
      { replacements: [jobId], type: QueryTypes.SELECT },
    );
    const prev = safeJsonParse<AnalysisPhases | null>(prevRows[0]?.progress_json ?? null, null);
    const nextPhases = mergePhases(
      prev,
      phasePatch ?? phasesFromStage(currentStage || '', Number(stageProgress ?? 0)),
    );

    await db.query(
      `UPDATE analysis_jobs
       SET status = 'running',
           current_stage = COALESCE(?, current_stage),
           stage_progress = COALESCE(?, stage_progress),
           total_progress = COALESCE(?, total_progress),
           progress_message = COALESCE(?, progress_message),
           progress_json = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status IN ('queued', 'running')`,
      { replacements: [
        currentStage || null,
        stageProgress ?? null,
        totalProgress ?? null,
        message || null,
        JSON.stringify(nextPhases),
        jobId,
      ] },
    );
    res.status(200).json({ ok: true });
  } catch (err) {
    const msg = (err instanceof Error ? err.message : String(err));
    console.error('[job-progress] update failed:', msg);
    res.status(500).json({ error: msg });
  }
}

export default withOrgPaymentAccess(handler);
