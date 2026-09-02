/**
 * The token endpoint — `authorization_code` (with PKCE) and `refresh_token` grants.
 *
 * Public clients only (`token_endpoint_auth_method: none`), so the code verifier is the
 * proof of possession. Accepts form-encoded (the spec's default) or JSON bodies.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { redeemCode, redeemRefreshToken } from '@/src/infrastructure/mcp/oauthStore';
import { oauthCors } from '@/src/infrastructure/mcp/cors';
import { getErrorMessage } from '@/src/core/shared/errors';

function field(body: unknown, name: string): string {
   if (!body || typeof body !== 'object') return '';
   const v = (body as Record<string, unknown>)[name];
   return typeof v === 'string' ? v : '';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   oauthCors(res, 'POST');
   if (req.method === 'OPTIONS') return res.status(204).end();
   if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS');
      return res.status(405).json({ error: 'invalid_request' });
   }
   res.setHeader('Cache-Control', 'no-store');
   res.setHeader('Pragma', 'no-cache');

   let body: unknown = req.body;
   if (typeof body === 'string') {
      // Next only auto-parses when it recognises the content type; a raw string here is
      // either JSON or the form encoding.
      const raw = body;
      try { body = JSON.parse(raw); } catch { body = Object.fromEntries(new URLSearchParams(raw)); }
   }

   const grantType = field(body, 'grant_type');

   try {
      if (grantType === 'authorization_code') {
         const tokens = await redeemCode({
            code: field(body, 'code'),
            clientId: field(body, 'client_id'),
            redirectUri: field(body, 'redirect_uri'),
            codeVerifier: field(body, 'code_verifier'),
            resource: field(body, 'resource') || undefined,
         });
         // One message for every failure mode: an expired code, a wrong verifier and a
         // mismatched client must not be distinguishable to a guesser.
         if (!tokens) return res.status(400).json({ error: 'invalid_grant' });
         return res.status(200).json({ token_type: 'Bearer', ...tokens });
      }

      if (grantType === 'refresh_token') {
         const tokens = await redeemRefreshToken({
            refreshToken: field(body, 'refresh_token'),
            clientId: field(body, 'client_id'),
         });
         if (!tokens) return res.status(400).json({ error: 'invalid_grant' });
         return res.status(200).json({ token_type: 'Bearer', ...tokens });
      }

      return res.status(400).json({ error: 'unsupported_grant_type' });
   } catch (err) {
      console.error('[mcp-oauth] token exchange failed:', err);
      return res.status(500).json({ error: 'server_error', error_description: getErrorMessage(err) });
   }
}
