import type { NextApiResponse } from 'next';

/**
 * The OAuth discovery/registration/token endpoints are called by third-party MCP hosts
 * from their own origin. None of them read a cookie, so a wildcard origin without
 * credentials grants nothing that the caller did not already hold.
 */
export function oauthCors(res: NextApiResponse, methods: string): void {
   res.setHeader('Access-Control-Allow-Origin', '*');
   res.setHeader('Access-Control-Allow-Methods', `${methods}, OPTIONS`);
   res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
   res.setHeader('Access-Control-Max-Age', '86400');
}
