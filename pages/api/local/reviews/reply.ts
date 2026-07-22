import type { NextApiRequest, NextApiResponse } from 'next';
import { getErrorMessage } from '../../../../lib/errors';
import { getGbpAccessTokenForUser } from '../../../../lib/gscAccounts';
import {
  deleteReviewReply,
  isGbpApiError,
  updateReviewReply,
} from '../../../../lib/local/googleBusinessProfile';
import db from '../../../../database/database';
import { getCurrentUserId } from '../../../../utils/getUser';
import verifyUser from '../../../../utils/verifyUser';

type ReplyBody = {
  accountId?: unknown;
  locationId?: unknown;
  reviewId?: unknown;
  comment?: unknown;
};

type ReplyResponse =
  | { ok: true; comment?: string; updateTime?: string }
  | { error: string; code?: 'no_account' | 'needs_reconnect' | 'token_error' | 'forbidden' | 'not_found' | 'upstream' };

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseBody(req: NextApiRequest): ReplyBody {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    return req.body as ReplyBody;
  }
  return {};
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ReplyResponse>,
) {
  res.setHeader('Cache-Control', 'no-store');
  await db.sync();

  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') {
    return res.status(401).json({ error: authorized });
  }

  if (req.method !== 'PUT' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = parseBody(req);
  const accountId = asString(body.accountId) || asString(req.query.accountId);
  const locationId = asString(body.locationId) || asString(req.query.locationId);
  const reviewId = asString(body.reviewId) || asString(req.query.reviewId);
  const comment = asString(body.comment);

  if (!accountId || !locationId || !reviewId) {
    return res.status(400).json({ error: 'accountId, locationId and reviewId are required' });
  }

  if (req.method === 'PUT' && !comment) {
    return res.status(400).json({ error: 'comment is required' });
  }

  const userId = await getCurrentUserId(req, res);
  if (!userId) {
    return res.status(401).json({ error: 'Missing user session.' });
  }

  const token = await getGbpAccessTokenForUser(userId);
  if (!token.ok) {
    const status = token.code === 'no_account' || token.code === 'needs_reconnect' ? 401 : 502;
    return res.status(status).json({ error: token.reason || token.code, code: token.code });
  }

  try {
    if (req.method === 'PUT') {
      const updated = await updateReviewReply(
        token.accessToken,
        accountId,
        locationId,
        reviewId,
        comment,
      );
      return res.status(200).json({ ok: true, comment: updated.comment, updateTime: updated.updateTime });
    }

    await deleteReviewReply(token.accessToken, accountId, locationId, reviewId);
    return res.status(200).json({ ok: true });
  } catch (err) {
    if (isGbpApiError(err)) {
      const status = err.code === 'forbidden' ? 403 : err.code === 'not_found' ? 404 : 502;
      return res.status(status).json({
        error: err.message,
        code: err.code === 'forbidden' ? 'forbidden'
          : err.code === 'not_found' ? 'not_found'
            : 'upstream',
      });
    }
    console.error('[local/reviews/reply]', getErrorMessage(err));
    return res.status(500).json({ error: getErrorMessage(err), code: 'upstream' });
  }
}
