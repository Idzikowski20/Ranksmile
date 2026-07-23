import type { NextApiRequest, NextApiResponse } from 'next';
import { getErrorMessage } from '../../../../lib/errors';
import { getGbpAccessTokenForUser } from '../../../../lib/gscAccounts';
import {
  isGbpApiError,
  listGbpReviews,
} from '../../../../lib/local/googleBusinessProfile';
import type { ReviewItem, ReviewProgressMonth } from '../../../../lib/local/reviewsData';
import db from '../../../../database/database';
import { getCurrentUserId } from '../../../../utils/getUser';
import verifyUser from '../../../../utils/verifyUser';

type ReviewsResponse = {
  reviews: ReviewItem[];
  totalReviews: number;
  averageRating: number;
  progress: ReviewProgressMonth[];
  source: 'gbp';
  businessTitle?: string;
} | { error: string; code?: 'no_account' | 'needs_reconnect' | 'token_error' | 'forbidden' | 'not_found' | 'upstream' };

function asQueryString(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ReviewsResponse>,
) {
  res.setHeader('Cache-Control', 'no-store');
  await db.sync();

  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') {
    return res.status(401).json({ error: authorized });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accountId = asQueryString(req.query.accountId);
  const locationId = asQueryString(req.query.locationId);
  const businessName = asQueryString(req.query.businessName) || 'Business';

  if (!accountId || !locationId) {
    return res.status(400).json({ error: 'accountId and locationId are required' });
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
    const result = await listGbpReviews(token.accessToken, accountId, locationId, businessName);
    return res.status(200).json(result);
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
    console.error('[local/reviews]', getErrorMessage(err));
    return res.status(500).json({ error: getErrorMessage(err), code: 'upstream' });
  }
}
