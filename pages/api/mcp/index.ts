/**
 * The Ranksmile MCP endpoint — Streamable HTTP, served at `/mcp` (rewritten here).
 *
 *   POST   JSON-RPC messages, answered with `application/json`
 *   GET    405 — this server opens no server-to-client stream (permitted by the
 *          Streamable HTTP spec, which requires exactly 405 when SSE is not offered)
 *   DELETE 204 — no session to terminate; the server is stateless by design
 *
 * Authorization runs before method handling, so every verb answers an unauthenticated
 * call with the same 401 + `WWW-Authenticate` pointing at the protected-resource
 * metadata. That pointer is how an MCP host discovers the consent flow.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import {
   handleRpc,
   invalidRequest,
   isJsonRpcMessage,
   isSupportedProtocolVersion,
   messageId,
   SUPPORTED_PROTOCOL_VERSIONS,
   type JsonRpcResponse,
} from '@/src/infrastructure/mcp/rpc';
import { MCP_SCOPE, verifyAccessToken } from '@/src/infrastructure/mcp/oauthStore';
import { checkUserPaymentAccess } from '@/src/infrastructure/billing/requireOrgPaymentAccess';
import { bearerChallenge, mcpUrls } from '@/src/infrastructure/mcp/urls';

export const config = { api: { bodyParser: { sizeLimit: '1mb' }, responseLimit: '10mb' } };

/**
 * MCP hosts are third-party origins (claude.ai, an IDE webview, a CLI). The endpoint
 * reads no cookie and carries no ambient authority — only a bearer token the caller had
 * to be granted — so a wildcard origin is safe and credentials stay off. That absence of
 * cookie auth is also what defuses DNS rebinding here: a rebound page still has no token.
 */
function cors(res: NextApiResponse): void {
   res.setHeader('Access-Control-Allow-Origin', '*');
   res.setHeader('Access-Control-Allow-Methods', 'POST, GET, DELETE, OPTIONS');
   res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type, mcp-protocol-version, mcp-session-id, last-event-id');
   res.setHeader('Access-Control-Expose-Headers', 'www-authenticate, mcp-protocol-version');
   res.setHeader('Access-Control-Max-Age', '86400');
}

function bearer(req: NextApiRequest): string {
   const h = req.headers.authorization;
   if (typeof h !== 'string') return '';
   const m = /^Bearer\s+(.+)$/i.exec(h.trim());
   return m ? m[1].trim() : '';
}

function safeParse(s: string): unknown {
   try { return JSON.parse(s); } catch { return undefined; }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   cors(res);
   if (req.method === 'OPTIONS') return res.status(204).end();

   const urls = mcpUrls(req);
   const token = bearer(req);
   if (!token) {
      res.setHeader('WWW-Authenticate', bearerChallenge(urls.protectedResourceMetadata, 'Missing Authorization header'));
      return res.status(401).json({ error: 'invalid_token', error_description: 'Missing Authorization header' });
   }

   const claims = await verifyAccessToken(token);
   if (!claims) {
      res.setHeader('WWW-Authenticate', bearerChallenge(urls.protectedResourceMetadata, 'Invalid or expired token'));
      return res.status(401).json({ error: 'invalid_token', error_description: 'Invalid or expired token' });
   }

   // RFC 8707 audience check. A token minted for another resource must not be replayable
   // here — this is the "token passthrough" anti-pattern the spec forbids.
   if (claims.resource && claims.resource.replace(/\/$/, '') !== urls.resource.replace(/\/$/, '')) {
      res.setHeader('WWW-Authenticate', bearerChallenge(urls.protectedResourceMetadata, 'Token audience does not match this resource'));
      return res.status(401).json({ error: 'invalid_token', error_description: 'Token audience does not match this resource' });
   }

   // The token has to carry the scope the tools live behind. Without this the scope in
   // the token response is decoration: anything the client asked for would work.
   if (!(claims.scope || '').split(/\s+/).filter(Boolean).includes(MCP_SCOPE)) {
      res.setHeader(
         'WWW-Authenticate',
         `Bearer error="insufficient_scope", scope="${MCP_SCOPE}", resource_metadata="${urls.protectedResourceMetadata}"`,
      );
      return res.status(403).json({ error: 'insufficient_scope', error_description: `Scope ${MCP_SCOPE} is required` });
   }

   // The tools serve the same workspace and article data the session routes do, so a
   // payment-blocked org must not reach them through an agent either. The session
   // wrapper cannot run here — there is no cookie to resolve an org from — so the same
   // decision is taken on the token's user.
   const access = await checkUserPaymentAccess(claims.userId, `${req.method ?? 'POST'}:/api/mcp`);
   if (!access.allowed) return res.status(access.status).json(access.body);

   if (req.method === 'GET') {
      // Spec: a server that does not offer an SSE stream on GET MUST answer 405.
      // ponytail: no server-initiated messages exist yet; add the stream when sampling,
      // elicitation or progress notifications need one.
      res.setHeader('Allow', 'POST, DELETE, OPTIONS');
      return res.status(405).json({ error: 'method_not_allowed', error_description: 'This server does not offer an SSE stream' });
   }

   if (req.method === 'DELETE') {
      // No session state is kept, so termination is a no-op rather than an error.
      return res.status(204).end();
   }

   if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, GET, DELETE, OPTIONS');
      return res.status(405).json({ error: 'method_not_allowed' });
   }

   // Spec (2025-06-18+): the negotiated version is echoed on every later request and the
   // server rejects one it cannot speak, rather than guessing.
   const declared = req.headers['mcp-protocol-version'];
   const declaredVersion = Array.isArray(declared) ? declared[0] : declared;
   if (declaredVersion && !isSupportedProtocolVersion(declaredVersion)) {
      return res.status(400).json({
         error: 'unsupported_protocol_version',
         error_description: `Unsupported MCP-Protocol-Version: ${declaredVersion}`,
         supported: [...SUPPORTED_PROTOCOL_VERSIONS],
      });
   }

   const body: unknown = typeof req.body === 'string' ? safeParse(req.body) : req.body;
   if (body === undefined || body === null) {
      return res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
   }

   try {
      if (Array.isArray(body)) {
         // An empty array is not a batch of notifications, it is an invalid request.
         if (!body.length) return res.status(400).json(invalidRequest());

         const out: JsonRpcResponse[] = [];
         for (const msg of body) {
            if (!isJsonRpcMessage(msg)) {
               out.push(invalidRequest(messageId(msg)));
               continue;
            }
            const r = await handleRpc(claims.userId, msg);
            if (r) out.push(r);
         }
         // A batch of nothing but notifications owes no response body.
         if (!out.length) return res.status(202).end();
         return res.status(200).json(out);
      }

      if (!isJsonRpcMessage(body)) return res.status(400).json(invalidRequest(messageId(body)));

      const response = await handleRpc(claims.userId, body);
      if (!response) return res.status(202).end();
      return res.status(200).json(response);
   } catch (err) {
      console.error('[mcp] request failed:', err);
      return res.status(500).json({
         jsonrpc: '2.0',
         id: null,
         error: { code: -32603, message: 'Internal error' },
      });
   }
}
