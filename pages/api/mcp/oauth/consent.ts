/**
 * The consent screen's backend. Same-origin only — it authenticates with the app
 * session, not a bearer token.
 *
 *   GET  ?client_id&redirect_uri  → who is asking, and is this a redirect we registered
 *   POST { …authorize params }    → mint an authorization code and return where to send it
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { getClient, issueCode, MCP_SCOPE } from '@/src/infrastructure/mcp/oauthStore';
import { mcpUrls } from '@/src/infrastructure/mcp/urls';
import { getErrorMessage } from '@/src/core/shared/errors';
import { getCurrentUserId } from '../../../../utils/getUser';

const first = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] ?? '' : v ?? '');

/**
 * Approving consent mints a credential, so the POST must have come from our own page.
 * A cross-site form post carries the session cookie but never a same-origin `Origin`,
 * so this is what stops an attacker silently minting a code for their own client.
 */
function isSameOrigin(req: NextApiRequest, appOrigin: string): boolean {
   const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
   if (origin) return origin.replace(/\/$/, '') === appOrigin.replace(/\/$/, '');
   const fetchSite = req.headers['sec-fetch-site'];
   return fetchSite === 'same-origin';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const userId = await getCurrentUserId(req, res);
   if (!userId) return res.status(401).json({ error: 'not_authenticated' });

   const urls = mcpUrls(req);

   try {
      if (req.method === 'GET') {
         const clientId = first(req.query.client_id as string | string[] | undefined);
         const redirectUri = first(req.query.redirect_uri as string | string[] | undefined);
         const client = await getClient(clientId);
         if (!client) return res.status(404).json({ error: 'unknown_client' });
         if (!client.redirect_uris.includes(redirectUri)) return res.status(400).json({ error: 'redirect_uri_mismatch' });
         return res.status(200).json({
            client_id: client.client_id,
            client_name: client.client_name,
            client_uri: client.client_uri,
            resource: urls.resource,
         });
      }

      if (req.method === 'POST') {
         if (!isSameOrigin(req, urls.origin)) return res.status(403).json({ error: 'cross_origin_request' });

         const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Record<string, unknown>;
         const clientId = String(body?.client_id ?? '');
         const redirectUri = String(body?.redirect_uri ?? '');
         const codeChallenge = String(body?.code_challenge ?? '');
         const method = String(body?.code_challenge_method ?? '');
         const state = typeof body?.state === 'string' ? body.state : '';
         // Discovery advertises exactly one scope, so exactly one is grantable. Echoing
         // back whatever was asked for would tell the client it holds something it does not.
         const requestedScope = typeof body?.scope === 'string' ? body.scope.trim() : '';
         const granted = requestedScope
            ? requestedScope.split(/\s+/).filter((s) => s === MCP_SCOPE)
            : [MCP_SCOPE];
         if (!granted.length) {
            return res.status(400).json({
               error: 'invalid_scope',
               error_description: `The only supported scope is ${MCP_SCOPE}`,
            });
         }
         const scope = granted.join(' ');
         const requestedResource = typeof body?.resource === 'string' ? body.resource : '';

         const client = await getClient(clientId);
         if (!client) return res.status(404).json({ error: 'unknown_client' });
         // The registered list is the whole defence against a code being delivered to an
         // attacker's URL, so this is an exact match, never a prefix one.
         if (!client.redirect_uris.includes(redirectUri)) return res.status(400).json({ error: 'redirect_uri_mismatch' });
         if (method !== 'S256' || !codeChallenge) {
            return res.status(400).json({ error: 'invalid_request', error_description: 'PKCE S256 is required' });
         }
         // RFC 8707: a client may only ask for a token scoped to this resource. Anything
         // else would make us mint a token for an audience we do not control.
         if (requestedResource && requestedResource.replace(/\/$/, '') !== urls.resource.replace(/\/$/, '')) {
            return res.status(400).json({ error: 'invalid_target', error_description: 'Unknown resource indicator' });
         }

         const code = await issueCode({
            clientId, userId, redirectUri, codeChallenge, scope, resource: urls.resource,
         });
         const url = new URL(redirectUri);
         url.searchParams.set('code', code);
         if (state) url.searchParams.set('state', state);
         // RFC 9207 — lets the client verify which authorization server answered.
         url.searchParams.set('iss', urls.origin);
         return res.status(200).json({ redirect: url.toString() });
      }

      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'method_not_allowed' });
   } catch (err) {
      console.error('[mcp-oauth] consent failed:', err);
      return res.status(500).json({ error: 'server_error', error_description: getErrorMessage(err) });
   }
}
