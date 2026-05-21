// GET /api/gsc/callback?code=...&state=...
// Handles Google OAuth2 callback: exchanges code for tokens and stores refresh_token.
import type { NextApiRequest, NextApiResponse } from 'next';
import { auth } from '@googleapis/searchconsole';
import Cryptr from 'cryptr';
import db from '../../../database/database';
import Domain from '../../../database/models/domain';

function parseState(state: string): { domain: string; redirect: string | null } {
  // New format: JSON with domain + optional redirect
  try {
    const parsed = JSON.parse(state);
    if (parsed.domain) return parsed;
  } catch { /* fall through */ }
  // Legacy format: plain domain string
  return { domain: state, redirect: null };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, state, error: oauthError } = req.query;

  if (oauthError) {
    console.error('[GSC OAuth] Error from Google:', oauthError);
    return res.redirect(302, `/domains?gsc_error=${encodeURIComponent(oauthError as string)}`);
  }

  if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
    return res.status(400).json({ error: 'Missing code or state parameter.' });
  }

  const { domain, redirect } = parseState(state);

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const baseUrl = process.env.AUTH0_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUri = `${baseUrl}/api/gsc/callback`;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Google OAuth credentials not configured.' });
  }

  try {
    const oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUri);
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      const connectParams = new URLSearchParams({ domain });
      if (redirect) connectParams.set('redirect', redirect);
      return res.redirect(302, `/api/gsc/connect?${connectParams.toString()}`);
    }

    const cryptr = new Cryptr(process.env.SECRET as string);
    const encryptedToken = cryptr.encrypt(tokens.refresh_token);

    await db.sync();
    const domainRecord = await Domain.findOne({ where: { domain } });
    if (!domainRecord) {
      return res.status(404).json({ error: `Domain "${domain}" not found.` });
    }

    const currentSC = domainRecord.search_console ? JSON.parse(domainRecord.search_console) : {};
    await domainRecord.update({
      search_console: JSON.stringify({
        ...currentSC,
        auth_type: 'oauth',
        oauth_refresh_token: encryptedToken,
        client_email: '',
        private_key: '',
      }),
    });

    console.log(`[GSC OAuth] Connected Google Search Console for domain: ${domain}`);

    // Redirect back to the caller's page
    if (redirect) {
      return res.redirect(302, `${redirect}?gsc_connected=1`);
    }
    const slug = domain.replace(/\./g, '-');
    return res.redirect(302, `/domain/${slug}?gsc_connected=1`);
  } catch (err: any) {
    console.error('[GSC OAuth] Token exchange failed:', err?.message || err);
    return res.redirect(302, `/domains?gsc_error=${encodeURIComponent('Token exchange failed')}`);
  }
}
