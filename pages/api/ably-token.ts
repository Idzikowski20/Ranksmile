// GET /api/ably-token?articleId=&token=&clientId=
// Mints a capability-scoped Ably TokenRequest for the article's realtime channel.
// Owner (session) → publish+subscribe+presence. Share-token viewer → subscribe+presence.
import type { NextApiRequest, NextApiResponse } from 'next';
import { getCommentAccessKind } from '../../lib/commentAccess';
import { isAblyConfigured, mintArticleToken } from '../../lib/ably/server';
import { getCurrentUserId } from '../../utils/getUser';
import { getErrorMessage } from '../../lib/errors';

function sanitizeClientId(raw: unknown): string {
  if (typeof raw !== 'string') return 'guest';
  // Ably clientIds must be printable; strip angle brackets, cap length.
  const cleaned = raw.replace(/[<>]/g, '').trim().slice(0, 64);
  return cleaned || 'guest';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const articleId = parseInt(String(req.query.articleId ?? ''), 10);
  if (!Number.isInteger(articleId)) return res.status(400).json({ error: 'articleId is required' });

  if (!isAblyConfigured()) {
    // 200 (not 503) — realtime is optional; client treats { disabled: true } as no-op.
    return res.status(200).json({ disabled: true });
  }

  try {
    const kind = await getCommentAccessKind(req, res, articleId);
    if (!kind) return res.status(403).json({ error: 'Access denied.' });

    let clientId: string;
    if (kind === 'owner') {
      const uid = await getCurrentUserId(req, res);
      clientId = `owner:${uid ?? 'unknown'}`;
    } else {
      clientId = `guest:${sanitizeClientId(req.query.clientId)}`;
    }

    const tokenRequest = await mintArticleToken({ articleId, kind, clientId });
    // Returned verbatim to the Ably client SDK (authUrl expects a TokenRequest JSON).
    return res.status(200).json(tokenRequest);
  } catch (error) {
    return res.status(500).json({ error: getErrorMessage(error) });
  }
}
