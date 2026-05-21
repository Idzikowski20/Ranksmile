// GET /api/gsc/connect?domain=example.com&redirect=/settings
// Redirects the user to Google OAuth2 consent screen for Search Console access.
import type { NextApiRequest, NextApiResponse } from 'next';
import { auth } from '@googleapis/searchconsole';
import verifyUser from '../../../utils/verifyUser';
import db from '../../../database/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await db.sync();
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') {
    return res.status(401).json({ error: authorized });
  }

  const { domain, redirect } = req.query;
  if (!domain || typeof domain !== 'string') {
    return res.status(400).json({ error: 'domain is required' });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const baseUrl = process.env.AUTH0_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUri = `${baseUrl}/api/gsc/callback`;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in environment variables.' });
  }

  const oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUri);

  // Encode domain + optional return redirect in state
  const state = JSON.stringify({
    domain,
    redirect: typeof redirect === 'string' ? redirect : null,
  });

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/webmasters.readonly'],
    state,
    prompt: 'consent',
  });

  return res.redirect(302, authUrl);
}
