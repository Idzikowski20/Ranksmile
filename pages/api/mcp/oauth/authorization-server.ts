/**
 * RFC 8414 authorization-server metadata, served at /.well-known/oauth-authorization-server
 * (see the rewrite in next.config.js). This is what tells an MCP host where the consent
 * screen lives, that PKCE S256 is mandatory, and that refresh tokens are available.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { oauthCors } from '@/src/infrastructure/mcp/cors';
import { mcpUrls } from '@/src/infrastructure/mcp/urls';
import { MCP_SCOPE } from '@/src/infrastructure/mcp/oauthStore';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
   oauthCors(res, 'GET');
   if (req.method === 'OPTIONS') return res.status(204).end();

   const urls = mcpUrls(req);
   return res.status(200).json({
      issuer: urls.origin,
      authorization_endpoint: urls.authorizationEndpoint,
      token_endpoint: urls.tokenEndpoint,
      registration_endpoint: urls.registrationEndpoint,
      revocation_endpoint: urls.revocationEndpoint,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      // OAuth 2.1: PKCE is mandatory, and only S256 is acceptable.
      code_challenge_methods_supported: ['S256'],
      // Public clients only — MCP hosts register dynamically and hold no secret.
      token_endpoint_auth_methods_supported: ['none'],
      revocation_endpoint_auth_methods_supported: ['none'],
      scopes_supported: [MCP_SCOPE],
      // RFC 8707: the client names the resource it wants a token for, and we bind it.
      resource_indicators_supported: true,
      // RFC 9207: the authorization response carries `iss`, which is what lets a client
      // detect a mix-up attack between several authorization servers.
      authorization_response_iss_parameter_supported: true,
   });
}
