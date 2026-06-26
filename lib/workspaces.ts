import db from '../database/database';
import { ensureUserTenancy } from './tenancy';

export type Workspace = { id: number; name: string };
type Row = Record<string, any>;

async function select(sql: string, replacements: any[]): Promise<Row[]> {
   const [rows] = await db.query(sql, { replacements }) as [Row[], unknown];
   return rows;
}

/** Throws WORKSPACE_NOT_FOUND if the workspace doesn't belong to the user's org. */
async function assertInOrg(orgId: number, wsId: number): Promise<void> {
   const found = await select('SELECT id FROM workspaces WHERE id = ? AND org_id = ? LIMIT 1', [wsId, orgId]);
   if (!found.length) throw new Error('WORKSPACE_NOT_FOUND');
}

export async function listWorkspaces(userId: string): Promise<Workspace[]> {
   const { orgId } = await ensureUserTenancy(userId);
   const rows = await select('SELECT id, name FROM workspaces WHERE org_id = ? ORDER BY id ASC', [orgId]);
   return rows.map((r) => ({ id: Number(r.id), name: String(r.name ?? '') }));
}

export async function createWorkspace(userId: string, name: string): Promise<Workspace> {
   const { orgId } = await ensureUserTenancy(userId);
   const clean = (name || '').trim().slice(0, 60) || 'Untitled';
   await db.query('INSERT INTO workspaces (org_id, name) VALUES (?, ?)', { replacements: [orgId, clean] });
   const back = await select('SELECT id, name FROM workspaces WHERE org_id = ? ORDER BY id DESC LIMIT 1', [orgId]);
   return { id: Number(back[0].id), name: String(back[0].name) };
}

export async function renameWorkspace(userId: string, wsId: number, name: string): Promise<void> {
   const { orgId } = await ensureUserTenancy(userId);
   await assertInOrg(orgId, wsId);
   const clean = (name || '').trim().slice(0, 60) || 'Untitled';
   await db.query('UPDATE workspaces SET name = ? WHERE id = ? AND org_id = ?', { replacements: [clean, wsId, orgId] });
}

/** Throws WORKSPACE_NOT_FOUND / WORKSPACE_LAST / WORKSPACE_NOT_EMPTY. */
export async function deleteWorkspace(userId: string, wsId: number): Promise<void> {
   const { orgId } = await ensureUserTenancy(userId);
   await assertInOrg(orgId, wsId);
   const [{ n: wsCount }] = await select('SELECT COUNT(*) AS n FROM workspaces WHERE org_id = ?', [orgId]) as Array<{ n: number }>;
   if (Number(wsCount) <= 1) throw new Error('WORKSPACE_LAST');
   const [{ n: domCount }] = await select('SELECT COUNT(*) AS n FROM domain WHERE workspace_id = ?', [wsId]) as Array<{ n: number }>;
   if (Number(domCount) > 0) throw new Error('WORKSPACE_NOT_EMPTY');
   await db.query('DELETE FROM workspaces WHERE id = ? AND org_id = ?', { replacements: [wsId, orgId] });
}
