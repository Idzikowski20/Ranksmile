// GET/POST/PUT /api/confirm-account — status, (re)send, and verify for the confirm-account flow.
// GET/POST require a session (never trust a client-supplied email/user id). PUT does not: the
// confirmation link may be opened in a fresh browser with no session cookie.
import type { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUser } from '../../utils/getUser';
import { getConfirmationStatus, issueConfirmationToken, confirmEmailToken } from '../../lib/emailConfirmation';
import { sendConfirmationEmail } from '../../lib/confirmEmail';
import { getErrorMessage } from '../../lib/errors';

function buildOrigin(req: NextApiRequest): string {
  return (req.headers.origin as string | undefined)
    || process.env.NEXT_PUBLIC_APP_URL
    || `https://${req.headers.host}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'PUT') {
    const { token } = req.body || {};
    if (typeof token !== 'string' || token.length !== 64) {
      return res.status(400).json({ error: 'Invalid token.' });
    }
    try {
      const result = await confirmEmailToken(token);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({ error: getErrorMessage(error) });
    }
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, PUT');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getCurrentUser(req, res);
  if (!user) return res.status(401).json({ error: 'Unauthorized.' });

  if (req.method === 'GET') {
    try {
      const status = await getConfirmationStatus(user.id);
      return res.status(200).json({ confirmed: status.confirmed, email: status.email ?? user.email });
    } catch (error) {
      return res.status(500).json({ error: getErrorMessage(error) });
    }
  }

  if (req.method === 'POST') {
    try {
      const result = await issueConfirmationToken(user.id, user.email ?? '');
      if (result.cooldownMs !== undefined) {
        return res.status(429).json({ cooldownMs: result.cooldownMs });
      }
      if (result.alreadyConfirmed) {
        return res.status(200).json({ confirmed: true });
      }
      if (result.token) {
        const origin = buildOrigin(req);
        const confirmUrl = `${origin}/auth/confirm-email?token=${result.token}`;
        const { sent } = await sendConfirmationEmail(user.email ?? '', confirmUrl);
        return res.status(200).json({ sent });
      }
      return res.status(500).json({ error: 'Unexpected response from issueConfirmationToken.' });
    } catch (error) {
      return res.status(500).json({ error: getErrorMessage(error) });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
