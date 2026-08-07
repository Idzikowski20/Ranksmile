// GET /api/articles/[id]/generate-stream?jobId=... — one SSE response carrying the two
// channels Surfer splits across AiArticleStatusStreaming and AiArticleContentStreaming.
// The browser polls nothing; this handler tails the job row and pushes deltas.
import type { NextApiRequest, NextApiResponse } from 'next';
import { QueryTypes } from 'sequelize';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { assertArticleAccess } from '../../../../lib/tenancy';
import { ensureArticlesTables } from '../../../../lib/ensureArticlesTables';
import { flushHeaders, flushSse } from '../../../../lib/types/api';
import { streamDelta } from '../../../../lib/streamDelta';

const TICK_MS = 700;
/**
 * A job stuck in 'finalizing' has no reaper on this path — job-progress runs that check
 * on its own GET. Rather than leaving the editor to wait out its 8-minute timeout, the
 * stream applies the same cutoff and reports the failure.
 */
const FINALIZING_STALE_MS = 3 * 60 * 1000;
/** Stop tailing a job that never reaches a terminal state (~20 min of writing). */
const MAX_TICKS = 1700;

type JobRow = {
  status: string;
  updated_at: string | Date | null;
  status_text: string | null;
  stream_text: string | null;
  error: string | null;
};

function send(res: NextApiResponse, event: string, data: Record<string, unknown>) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  flushSse(res);
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  await ensureArticlesTables();
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const articleId = Number(req.query.id);
  const jobId = typeof req.query.jobId === 'string' ? req.query.jobId : '';
  if (!Number.isFinite(articleId) || !jobId) {
    return res.status(400).json({ error: 'articleId and jobId are required' });
  }
  const userId = await getCurrentUserId(req, res);
  if (!(await assertArticleAccess(userId, articleId))) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.status(200);
  flushHeaders(res);
  res.write(':ok\n\n');

  // Quiet phases can outlast a proxy's idle timeout; a comment frame keeps it open.
  const heartbeat = setInterval(() => {
    try { res.write(':hb\n\n'); flushSse(res); } catch { clearInterval(heartbeat); }
  }, 20_000);
  let sentLength = 0;
  let lastStatus = '';
  let closed = false;
  req.on('close', () => { closed = true; clearInterval(heartbeat); });

  try {
    for (let tick = 0; tick < MAX_TICKS && !closed; tick += 1) {
    // eslint-disable-next-line no-await-in-loop
    const rows = await db.query<JobRow>(
      `SELECT status, status_text, stream_text, error, updated_at FROM analysis_jobs
        WHERE id = ? AND article_id = ? AND job_type = 'article_generate'`,
      { replacements: [jobId, articleId], type: QueryTypes.SELECT },
    );
    const job = rows[0];
    if (!job) {
      send(res, 'error', { message: 'job not found' });
      break;
    }
    if (job.status_text && job.status_text !== lastStatus) {
      lastStatus = job.status_text;
      send(res, 'status', { text: job.status_text });
    }
    const delta = streamDelta(sentLength, job.stream_text ?? '');
    if (delta.chunk) {
      sentLength = delta.nextLength;
      send(res, 'content', { chunk: delta.chunk });
    }
    if (job.status === 'done') {
      send(res, 'done', { html: job.stream_text ?? '' });
      break;
    }
    if (job.status === 'finalizing' && job.updated_at) {
      const idleMs = Date.now() - new Date(job.updated_at).getTime();
      if (Number.isFinite(idleMs) && idleMs > FINALIZING_STALE_MS) {
        send(res, 'error', { message: 'Generation stalled while finalizing' });
        break;
      }
    }
    if (job.status === 'failed' || job.status === 'canceled') {
      // job.error carries sidecar/exception text — keep internals off the wire.
      send(res, 'error', { message: 'Generation failed' });
      break;
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => { setTimeout(resolve, TICK_MS); });
  }
  } catch (err) {
    // Headers are already flushed, so this can never surface as a 500 — the client would
    // otherwise sit on an open, silent connection until its own timeout.
    console.error('[generate-stream] tail failed:', err);
    send(res, 'error', { message: 'Generation stream failed' });
  } finally {
    clearInterval(heartbeat);
  }
  return res.end();
}

export default handler;
