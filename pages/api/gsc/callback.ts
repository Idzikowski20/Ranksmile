// GET /api/gsc/callback?code=...&state=...
// Handles Google OAuth2 callback: exchanges code for tokens and stores a per-user GSC account.
import type { NextApiRequest, NextApiResponse } from 'next';
import { auth } from '@googleapis/searchconsole';
import { getCurrentUserId } from '../../../utils/getUser';
import db from '../../../database/database';
import { GOOGLE_OAUTH_SCOPES, upsertAccountForUser } from '../../../lib/gscAccounts';

function parseState(state: string): { domain?: string; redirect: string | null; userId?: string | null; nonce?: string } {
  try {
    const parsed = JSON.parse(state);
    return { domain: parsed.domain || undefined, redirect: parsed.redirect || null, userId: parsed.userId || null, nonce: parsed.nonce };
  } catch { /* fall through */ }
  return { redirect: null };
}

/** Only same-origin relative redirect targets (the state value is already validated on connect, but
 *  re-check here so a tampered/legacy state can't open-redirect). */
const safeRelative = (r: string | null): string => (r && r.startsWith('/') && !r.startsWith('//') ? r : '/settings/google_search_console');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, state, error: oauthError } = req.query;

  await db.sync();
  const sessionUserId = await getCurrentUserId(req, res);

  if (oauthError) {
    console.error('[GSC OAuth] Error from Google:', oauthError);
    return res.redirect(302, `/settings/google_search_console?gsc_error=${encodeURIComponent(oauthError as string)}`);
  }

  if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
    return res.status(400).json({ error: 'Missing code or state parameter.' });
  }

  // CSRF: the state nonce must match the httpOnly cookie set on /connect. Clear the cookie either way.
  res.setHeader('Set-Cookie', 'gsc_oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  const { nonce: stateNonce } = parseState(state);
  if (!stateNonce || req.cookies.gsc_oauth_state !== stateNonce) {
    console.error('[GSC OAuth] state nonce mismatch (possible CSRF)');
    return res.redirect(302, '/settings/google_search_console?gsc_error=invalid_state');
  }

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
      const { redirect } = parseState(state);
      const connectParams = new URLSearchParams({
        redirect: redirect || '/settings/google_search_console',
      });
      return res.redirect(302, `/api/gsc/connect?${connectParams.toString()}`);
    }

    // Decode id_token to get Google account info
    let email = '';
    let picture = '';
    let googleSub = '';
    if (tokens.id_token) {
      try {
        const payloadPart = tokens.id_token.split('.')[1] || '';
        const normalizedPayload = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
        const paddedPayload = normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '=');
        const payload = JSON.parse(Buffer.from(paddedPayload, 'base64').toString('utf-8'));
        email = payload.email || '';
        picture = payload.picture || '';
        googleSub = payload.sub || '';
      } catch { /* ignore decode errors */ }
    }

    if (!email || !picture) {
      try {
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
          },
        });
        if (userInfoRes.ok) {
          const userInfo = await userInfoRes.json();
          email = email || userInfo.email || '';
          picture = picture || userInfo.picture || '';
          googleSub = googleSub || userInfo.sub || '';
        }
      } catch { /* ignore userinfo failures */ }
    }

    const { redirect } = parseState(state);
    const ownerUserId = sessionUserId;
    if (!ownerUserId) {
      return res.status(401).json({ error: 'Missing Neon Auth user session.' });
    }

    await upsertAccountForUser({
      userId: ownerUserId,
      googleSub: googleSub || `email:${email || Date.now()}`,
      email: email || 'Google Account',
      picture,
      refreshToken: tokens.refresh_token,
      scopes: GOOGLE_OAUTH_SCOPES.join(' '),
    });

    console.log('[GSC OAuth] Connected Google (GSC) for user', ownerUserId);

    return res.redirect(302, `${safeRelative(redirect)}?gsc_connected=1`);
  } catch (err) {
    // The try also covers the DB write, so a Sequelize "Validation error" lands here too.
    // Dig out the specific field / constraint / underlying Google error.
    const e = err as {
      name?: string;
      message?: string;
      errors?: Array<{ message?: string; path?: string; value?: unknown }>;
      parent?: { message?: string };
      response?: { data?: { error?: string; error_description?: string } };
    };
    const fieldMsgs = Array.isArray(e.errors) ? e.errors.map((x) => x.message || x.path).filter(Boolean).join('; ') : '';
    const googleErr = e.response?.data?.error_description || e.response?.data?.error;
    const detail = fieldMsgs || googleErr || e.parent?.message || e.message || String(err);
    // Log the specifics server-side; surface only a generic code to the client (was leaking DB
    // field/constraint names + provider errors into the redirect URL).
    console.error('[GSC OAuth] connect failed:', e.name || 'Error', '|', detail);
    return res.redirect(302, '/settings/google_search_console?gsc_error=connect_failed');
  }
}
