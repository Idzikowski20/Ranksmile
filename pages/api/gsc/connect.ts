// GET /api/gsc/connect?redirect=/settings
// Redirects the user to Google OAuth2 consent screen for Search Console access (account-level).
import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { auth } from '@googleapis/searchconsole';
import verifyUser from '../../../utils/verifyUser';
import db from '../../../database/database';
import { getCurrentUserId } from '../../../utils/getUser';

/** Only allow same-origin relative redirect targets (blocks ?redirect=https://evil open-redirect). */
const safeRelative = (r: unknown): string | null => (typeof r === 'string' && r.startsWith('/') && !r.startsWith('//') ? r : null);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await db.sync();
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') {
    return res.status(401).json({ error: authorized });
  }
  const userId = await getCurrentUserId(req, res);

  const { redirect } = req.query;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const baseUrl = process.env.AUTH0_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUri = `${baseUrl}/api/gsc/callback`;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in environment variables.' });
  }

  const oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUri);

  // CSRF: bind the OAuth flow to a random nonce stored in an httpOnly cookie and echoed in `state`,
  // verified on callback. Without it the OAuth flow has no CSRF/forced-account-linking protection.
  const nonce = crypto.randomBytes(16).toString('hex');
  const secure = (process.env.NODE_ENV === 'production') ? '; Secure' : '';
  res.setHeader('Set-Cookie', `gsc_oauth_state=${nonce}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${secure}`);

  const state = JSON.stringify({
    redirect: safeRelative(redirect),
    userId,
    nonce,
  });

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/webmasters.readonly',
    ],
    state,
    prompt: 'consent select_account',
  });

  return res.redirect(302, authUrl);
}
