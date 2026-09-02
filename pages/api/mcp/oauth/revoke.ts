/**
 * RFC 7009 token revocation, served at /token/revocation.
 *
 * Always answers 200, even for an unknown token: the RFC requires it, and a distinct
 * error would turn this endpoint into a token oracle.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { revokeToken } from '@/src/infrastructure/mcp/oauthStore';
import { oauthCors } from '@/src/infrastructure/mcp/cors';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   oauthCors(res, 'POST');
   if (req.method === 'OPTIONS') return res.status(204).end();
   if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS');
      return res.status(405).json({ error: 'invalid_request' });
   }
   res.setHeader('Cache-Control', 'no-store');

   let body: unknown = req.body;
   if (typeof body === 'string') {
      const raw = body;
      try { body = JSON.parse(raw); } catch { body = Object.fromEntries(new URLSearchParams(raw)); }
   }
   const token = body && typeof body === 'object' ? (body as Record<string, unknown>).token : undefined;

   try {
      if (typeof token === 'string' && token) await revokeToken(token);
   } catch (err) {
      console.error('[mcp-oauth] revocation failed:', err);
   }
   return res.status(200).end();
}
