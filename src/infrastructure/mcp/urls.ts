import type { NextApiRequest } from 'next';
import { getAppOrigin } from '@/src/infrastructure/config/appOrigin';

/**
 * The canonical URLs of the MCP deployment, in one place so the endpoint, the two
 * discovery documents and the `WWW-Authenticate` challenge cannot drift apart.
 *
 * `/mcp` (not `/api/mcp`) is the advertised resource: it is the path MCP hosts expect,
 * and next.config.js rewrites it onto the API route that implements it.
 */
export function mcpUrls(req?: NextApiRequest) {
   const origin = getAppOrigin(req);
   return {
      origin,
      /** RFC 8707 resource indicator / RFC 9728 `resource`. */
      resource: `${origin}/mcp`,
      /** RFC 9728 path-inserted metadata location for that resource. */
      protectedResourceMetadata: `${origin}/.well-known/oauth-protected-resource/mcp`,
      authorizationEndpoint: `${origin}/auth`,
      tokenEndpoint: `${origin}/token`,
      registrationEndpoint: `${origin}/reg`,
      revocationEndpoint: `${origin}/token/revocation`,
   };
}

/**
 * RFC 6750 challenge, in the shape MCP hosts parse: the `resource_metadata` pointer is
 * what turns a 401 into a discoverable authorization flow.
 */
export function bearerChallenge(metadataUrl: string, description: string): string {
   return `Bearer error="invalid_token", error_description="${description}", resource_metadata="${metadataUrl}"`;
}
