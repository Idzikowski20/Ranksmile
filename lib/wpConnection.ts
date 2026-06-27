import crypto from 'crypto';
import type { NextApiRequest } from 'next';
import db from '../database/database';
import { ensureWpTables } from './ensureWpTables';

export type WpConnection = {
   id: number;
   workspace_id: number;
   user_id: string;
   site_url: string;
   api_key: string;
   org_name: string | null;
};

/** Random shared secret minted at connect time and stored on both sides. */
export function mintApiKey(): string {
   return crypto.randomBytes(32).toString('hex');
}

const stripSlash = (u: string) => u.replace(/\/+$/, '');

/** One connection per (workspace, site) — replace any existing for that pair. */
export async function createConnection(p: { workspaceId: number; userId: string; siteUrl: string; apiKey: string; orgName: string | null }): Promise<void> {
   await ensureWpTables();
   const site = stripSlash(p.siteUrl);
   await db.query('DELETE FROM wp_connections WHERE workspace_id = ? AND site_url = ?', { replacements: [p.workspaceId, site] }).catch(() => {});
   await db.query(
      'INSERT INTO wp_connections (workspace_id, user_id, site_url, api_key, org_name) VALUES (?, ?, ?, ?, ?)',
      { replacements: [p.workspaceId, p.userId, site, p.apiKey, p.orgName] },
   );
}

/** Resolve the connection (→ workspace + site) from the plugin's `api-key` header. */
export async function resolveByApiKey(apiKey: string | undefined | null): Promise<WpConnection | null> {
   if (!apiKey) return null;
   await ensureWpTables();
   const [rows] = await db.query(
      'SELECT id, workspace_id, user_id, site_url, api_key, org_name FROM wp_connections WHERE api_key = ? LIMIT 1',
      { replacements: [apiKey] },
   );
   return (rows as WpConnection[])[0] || null;
}

/** Auth gate for `/api/v1/wordpress/*` — the plugin sends the shared secret as `api-key`. */
export async function authPluginRequest(req: NextApiRequest): Promise<WpConnection | null> {
   const header = (req.headers['api-key'] || req.headers['x-api-key']) as string | undefined;
   return resolveByApiKey(header);
}

/** The active connection for a workspace (used when WE call the plugin's REST routes). */
export async function getConnectionForWorkspace(workspaceId: number): Promise<WpConnection | null> {
   await ensureWpTables();
   const [rows] = await db.query(
      'SELECT id, workspace_id, user_id, site_url, api_key, org_name FROM wp_connections WHERE workspace_id = ? ORDER BY id DESC LIMIT 1',
      { replacements: [workspaceId] },
   );
   return (rows as WpConnection[])[0] || null;
}
