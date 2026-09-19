/**
 * POST /api/mcp/oauth/register — RFC 7591 dynamic client registration.
 *
 * Open by design: MCP hosts register themselves before a human has approved anything, and
 * a client_id alone grants nothing — every token still requires the consent screen and a
 * PKCE exchange. Registration only records where a code may be delivered, so the
 * redirect_uri validation below is the part that matters.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { registerClient } from '@/src/infrastructure/mcp/oauthStore';
import { oauthCors } from '@/src/infrastructure/mcp/cors';
import { getErrorMessage } from '@/src/core/shared/errors';

const MAX_REDIRECT_URIS = 10;

/**
 * Accept https, loopback http (native clients open a local port), and app schemes such as
 * `cursor://`. Everything else — javascript:, data:, file: — is rejected: a redirect target
 * is a place we hand an authorization code to.
 */
export function isAllowedRedirectUri(raw: unknown): boolean {
   if (typeof raw !== 'string' || raw.length > 2048) return false;
   let url: URL;
   try { url = new URL(raw); } catch { return false; }
   if (url.protocol === 'https:') return true;
   if (url.protocol === 'http:') return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
   // eslint-disable-next-line no-script-url -- this is the allowlist that rejects them
   if (url.protocol === 'javascript:' || url.protocol === 'data:' || url.protocol === 'file:' || url.protocol === 'vbscript:') return false;
   // A custom app scheme: require a scheme longer than one character (no drive letters)
   // and some opaque body, so `foo:` alone cannot be registered.
   return /^[a-z][a-z0-9+.-]+:$/i.test(url.protocol) && raw.length > url.protocol.length + 1;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   oauthCors(res, 'POST');
   if (req.method === 'OPTIONS') return res.status(204).end();
   if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS');
      return res.status(405).json({ error: 'method_not_allowed' });
   }

   const body = (typeof req.body === 'string' ? safeParse(req.body) : req.body) as Record<string, unknown> | undefined;
   const uris = body?.redirect_uris;
   if (!Array.isArray(uris) || uris.length === 0 || uris.length > MAX_REDIRECT_URIS) {
      return res.status(400).json({ error: 'invalid_redirect_uri', error_description: 'redirect_uris must be a non-empty array' });
   }
   if (!uris.every(isAllowedRedirectUri)) {
      return res.status(400).json({ error: 'invalid_redirect_uri', error_description: 'redirect_uris must be https, loopback http, or an app scheme' });
   }

   const name = typeof body?.client_name === 'string' ? body.client_name.slice(0, 120) : '';
   const uri = typeof body?.client_uri === 'string' ? body.client_uri.slice(0, 2048) : '';

   try {
      const client = await registerClient({ name, uri, redirectUris: uris as string[] });
      return res.status(201).json({
         client_id: client.client_id,
         client_id_issued_at: Math.floor(Date.now() / 1000),
         client_name: client.client_name,
         client_uri: client.client_uri,
         redirect_uris: client.redirect_uris,
         grant_types: ['authorization_code', 'refresh_token'],
         response_types: ['code'],
         token_endpoint_auth_method: 'none',
      });
   } catch (err) {
      console.error('[mcp-oauth] registration failed:', err);
      return res.status(500).json({ error: 'server_error', error_description: getErrorMessage(err) });
   }
}

function safeParse(s: string): unknown {
   try { return JSON.parse(s); } catch { return undefined; }
}
