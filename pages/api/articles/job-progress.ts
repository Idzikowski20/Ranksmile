// POST /api/articles/job-progress
// Called by Python sidecar during pipeline execution.
// Updates analysis_jobs row with current progress.
// Auth: accepts x-internal-token OR standard session cookie (verifyUser).
import type { NextApiRequest, NextApiResponse } from 'next';
import { QueryTypes } from 'sequelize';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import { ensureArticlesTables } from '../../../lib/ensureArticlesTables';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await db.sync();
  await ensureArticlesTables();

  // Auth: internal token (Python sidecar) or session cookie (browser)
  const internalToken = req.headers['x-internal-token'];
  if (internalToken && internalToken === process.env.INTERNAL_PIPELINE_TOKEN) {
    // Authorized via internal token — skip verifyUser
  } else {
    const authorized = await verifyUser(req, res);
    if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { jobId, currentStage, stageProgress, totalProgress, message } = req.body;
  if (!jobId) return res.status(400).json({ error: 'jobId is required' });

  try {
    // Verify job exists before updating (catch typos in jobId early)
    const jobRows = await db.query<{ id: string }>(
      `SELECT id FROM analysis_jobs WHERE id = ?`,
      { replacements: [jobId], type: QueryTypes.SELECT },
    );
    if (!jobRows.length) {
      return res.status(404).json({ error: 'job not found' });
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
  } catch (err: any) {
    console.error('[job-progress] update failed:', err.message);
    res.status(500).json({ error: err.message });
  }
}
