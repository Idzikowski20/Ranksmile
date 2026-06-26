// POST /api/articles/job-progress — Called by Python sidecar during pipeline execution.
// GET  /api/articles/job-progress — Polled by frontend for per-step progress display.
import type { NextApiRequest, NextApiResponse } from 'next';
import { QueryTypes } from 'sequelize';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import { ensureArticlesTables } from '../../../lib/ensureArticlesTables';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await ensureArticlesTables();

  // Auth: internal token (Python sidecar) or session cookie (browser)
  const internalToken = req.headers['x-internal-token'];
  const isInternal = internalToken && internalToken === process.env.INTERNAL_PIPELINE_TOKEN;

  if (!isInternal) {
    const authorized = await verifyUser(req, res);
    if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  }

  // ── GET: poll job state (frontend) ──────────────────────────────
  if (req.method === 'GET') {
    const jobId = req.query.jobId as string;
    if (!jobId) return res.status(400).json({ error: 'jobId query param is required' });

    try {
      const rows = await db.query<{
        status: string;
        current_stage: string | null;
        stage_progress: number | null;
        total_progress: number | null;
        progress_message: string | null;
      }>(
        `SELECT status, current_stage, stage_progress, total_progress, progress_message
         FROM analysis_jobs WHERE id = ?`,
        { replacements: [jobId], type: QueryTypes.SELECT },
      );

      if (!rows.length) return res.status(404).json({ error: 'job not found' });

      const j = rows[0];
      return res.status(200).json({
        jobId,
        status: j.status,
        currentStage: j.current_stage,
        stageProgress: j.stage_progress,
        totalProgress: j.total_progress,
        progressMessage: j.progress_message,
      });
    } catch (err) {
      const msg = (err instanceof Error ? err.message : String(err));
      console.error('[job-progress] GET failed:', msg);
      return res.status(500).json({ error: msg });
    }
  }

  // ── POST: update progress (Python sidecar) ──────────────────────
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { jobId, currentStage, stageProgress, totalProgress, message, status, result } = req.body;
  if (!jobId) return res.status(400).json({ error: 'jobId is required' });

  try {
    const jobRows = await db.query<{ id: string }>(
      `SELECT id FROM analysis_jobs WHERE id = ?`,
      { replacements: [jobId], type: QueryTypes.SELECT },
    );
    if (!jobRows.length) {
      return res.status(404).json({ error: 'job not found' });
    }

    if (status === 'done' || status === 'failed') {
      // terminal callback
      const jrows = await db.query<{ job_type: string; domain_id: number | null }>(
        `SELECT job_type, domain_id FROM analysis_jobs WHERE id = ?`,
        { replacements: [jobId], type: QueryTypes.SELECT },
      );
      const jt = jrows[0]?.job_type;
      const domainId = jrows[0]?.domain_id;
      if (status === 'done' && jt === 'domain_setup' && domainId) {
        const { materializeDomainSetup } = await import('../../../lib/domainPipeline');
        await materializeDomainSetup(Number(domainId), result || {});
      }
      await db.query(
        `UPDATE analysis_jobs SET status = ?, result = COALESCE(?, result), error = ?, total_progress = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        { replacements: [status, result ? JSON.stringify(result) : null, status === 'failed' ? (message || 'failed') : null, status === 'done' ? 100 : null, jobId] },
      );
      return res.status(200).json({ ok: true });
    }

    await db.query(
      `UPDATE analysis_jobs
       SET status = 'running',
           current_stage = COALESCE(?, current_stage),
           stage_progress = COALESCE(?, stage_progress),
           total_progress = COALESCE(?, total_progress),
           progress_message = COALESCE(?, progress_message),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      { replacements: [currentStage || null, stageProgress ?? null, totalProgress ?? null, message || null, jobId] },
    );
    res.status(200).json({ ok: true });
  } catch (err) {
    const msg = (err instanceof Error ? err.message : String(err));
    console.error('[job-progress] update failed:', msg);
    res.status(500).json({ error: msg });
  }
}
