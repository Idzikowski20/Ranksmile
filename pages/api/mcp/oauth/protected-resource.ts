/**
 * RFC 9728 protected-resource metadata. Served both at the bare
 * /.well-known/oauth-protected-resource and at the path-inserted
 * /.well-known/oauth-protected-resource/mcp that the 401 challenge points to.
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
      resource: urls.resource,
      authorization_servers: [urls.origin],
      scopes_supported: [MCP_SCOPE],
      bearer_methods_supported: ['header'],
      resource_documentation: `${urls.origin}/settings`,
   });
}
