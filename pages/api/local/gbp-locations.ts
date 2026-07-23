import type { NextApiRequest, NextApiResponse } from 'next';
import { getErrorMessage } from '../../../lib/errors';
import { getGbpAccessTokenForUser } from '../../../lib/gscAccounts';
import {
  isGbpApiError,
  listAllGbpLocationsCached,
} from '../../../lib/local/googleBusinessProfile';
import type { GbpProfile } from '../../../lib/local/types';
import db from '../../../database/database';
import { getCurrentUserId } from '../../../utils/getUser';
import verifyUser from '../../../utils/verifyUser';

type GbpLocationsResponse =
  | { locations: GbpProfile[] }
  | {
    error: string;
    code?: 'no_account' | 'needs_reconnect' | 'token_error' | 'forbidden' | 'rate_limit' | 'upstream';
  };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GbpLocationsResponse>,
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
    const locations = await listAllGbpLocationsCached(userId, token.accessToken);
    return res.status(200).json({ locations });
  } catch (err) {
    if (isGbpApiError(err)) {
      if (err.code === 'rate_limit') {
        res.setHeader('Retry-After', '90');
        const googleMsg = err.message || '';
        // Google returns 429 both for temporary RPM and for projects with 0 QPM (not allowlisted).
        const likelyNotApproved = /quota.*0|not.*approv|allowlist|access.*denied|PERMISSION_DENIED/i.test(googleMsg)
          || /Quota exceeded/i.test(googleMsg);
        return res.status(429).json({
          error: likelyNotApproved
            ? 'Google Business Profile API quota blocked this request. In Google Cloud Console check APIs → My Business Account Management → Quotas: if Requests per minute is 0, the project is not approved yet — enabling the API is not enough. Apply via “Application for Basic API Access” (GBP API contact form). Approved projects show ~300 QPM.'
            : 'Google API quota exceeded. Wait about a minute, then retry.',
          code: 'rate_limit',
          detail: googleMsg || undefined,
        });
      }
      const status = err.code === 'forbidden' ? 403 : 502;
      return res.status(status).json({
        error: err.message,
        code: err.code === 'forbidden' ? 'forbidden' : 'upstream',
      });
    }
    console.error('[local/gbp-locations]', getErrorMessage(err));
    return res.status(500).json({ error: getErrorMessage(err), code: 'upstream' });
  }
}
