// SSE stream of comment changes for one article. The editor and the preview keep
// an EventSource open here; when a comment is added/edited/resolved/deleted the
// in-process bus pushes an event and the client refetches. No polling.
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import { ensureArticlesTables } from '../../../../lib/ensureArticlesTables';
import { onCommentChange } from '../../../../lib/commentBus';
import { assertCommentAccess } from '../../../../lib/commentAccess';
import { withOrgPaymentAccess } from '../../../../lib/requireOrgPaymentAccess';

async function handler(req: NextApiRequest, res: NextApiResponse) {
   const { id } = req.query;
   if (!id) { res.status(400).end(); return; }

   await db.sync();
   await ensureArticlesTables();
   // Same gate as the comments REST endpoint: a valid share token or owner access.
   const articleId = parseInt(String(id), 10);
   if (!(await assertCommentAccess(req, res, articleId))) { res.status(403).end(); return; }

   res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // disable proxy buffering so events flush immediately
   });
   res.write('retry: 5000\n\n');

   const send = (payload: Record<string, unknown>) => {
      try { res.write(`data: ${JSON.stringify(payload)}\n\n`); } catch { /* connection gone */ }
   };

   const off = onCommentChange(String(id), (payload) => send(payload));
   // Heartbeat keeps the connection alive through idle timeouts / proxies.
   const heartbeat = setInterval(() => { try { res.write(': ping\n\n'); } catch { /* ignore */ } }, 25000);

   req.on('close', () => { clearInterval(heartbeat); off(); res.end(); });
}

export default withOrgPaymentAccess(handler);
