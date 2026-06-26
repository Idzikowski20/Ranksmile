import db from '../database/database';
import { ensureUserTenancy } from './tenancy';

export type Workspace = { id: number; name: string; domain?: string | null };
type Row = Record<string, any>;

async function select(sql: string, replacements: any[]): Promise<Row[]> {
   const [rows] = await db.query(sql, { replacements }) as [Row[], unknown];
   return rows;
}

/** Throws WORKSPACE_NOT_FOUND if the workspace doesn't belong to the user's org. */
export async function assertInOrg(orgId: number, wsId: number): Promise<void> {
   const found = await select('SELECT id FROM workspaces WHERE id = ? AND org_id = ? LIMIT 1', [wsId, orgId]);
   if (!found.length) throw new Error('WORKSPACE_NOT_FOUND');
}

export async function listWorkspaces(userId: string): Promise<Workspace[]> {
   const { orgId } = await ensureUserTenancy(userId);
   const rows = await select(
      `SELECT w.id, w.name, (SELECT d.domain FROM domain d WHERE d.workspace_id = w.id LIMIT 1) AS domain
       FROM workspaces w WHERE w.org_id = ? AND w.status = 'ready' ORDER BY w.id ASC`,
      [orgId],
   );
   return rows.map((r) => ({ id: Number(r.id), name: String(r.name ?? ''), domain: r.domain ? String(r.domain) : null }));
}

/**
 * Returns the org's in-progress setup workspace, creating one if none exists.
 * Reuse keeps a user who reloads or re-enters the wizard on the SAME workspace
 * instead of spawning a fresh orphan setup workspace on every entry.
 */
export async function createSetupWorkspace(userId: string): Promise<number> {
   const { orgId } = await ensureUserTenancy(userId);
   const existing = await select("SELECT id FROM workspaces WHERE org_id = ? AND status = 'setup' ORDER BY id DESC LIMIT 1", [orgId]);
   if (existing.length) return Number(existing[0].id);
   try {
      await db.query("INSERT INTO workspaces (org_id, name, status) VALUES (?, '', 'setup')", { replacements: [orgId] });
   } catch { /* UNIQUE(org_id,'') race with a concurrent setup-create — re-read the winner below */ }
   const back = await select("SELECT id FROM workspaces WHERE org_id = ? AND status = 'setup' ORDER BY id DESC LIMIT 1", [orgId]);
   return Number(back[0].id);
}

/** Returns a workspace (any status) if it belongs to the caller's org, else null. */
export async function getWorkspace(userId: string, wsId: number): Promise<(Workspace & { status: string }) | null> {
   const { orgId } = await ensureUserTenancy(userId);
   const rows = await select('SELECT id, name, status FROM workspaces WHERE id = ? AND org_id = ? LIMIT 1', [wsId, orgId]);
   if (!rows.length) return null;
   return { id: Number(rows[0].id), name: String(rows[0].name ?? ''), status: String(rows[0].status ?? 'ready') };
}

/** Names a setup workspace and flips it to 'ready'. */
export async function markWorkspaceReady(userId: string, wsId: number, name: string): Promise<void> {
   const { orgId } = await ensureUserTenancy(userId);
   await assertInOrg(orgId, wsId);
   const clean = (name || '').trim().slice(0, 60) || 'Untitled';
   await db.query("UPDATE workspaces SET name = ?, status = 'ready' WHERE id = ? AND org_id = ?", { replacements: [clean, wsId, orgId] });
}

/** Persists brand knowledge onto the workspace's domain and flips the workspace to 'ready'. */
export async function finishWorkspaceSetup(userId: string, wsId: number, brandName: string, brandKnowledge: string): Promise<void> {
   const { orgId } = await ensureUserTenancy(userId);
   await assertInOrg(orgId, wsId);
   await db.query('UPDATE domain SET brand_knowledge = ? WHERE workspace_id = ?', { replacements: [brandKnowledge || '', wsId] });
   await markWorkspaceReady(userId, wsId, brandName);
}

export async function createWorkspace(userId: string, name: string): Promise<Workspace> {
   const { orgId } = await ensureUserTenancy(userId);
   const clean = (name || '').trim().slice(0, 60) || 'Untitled';
   try {
      await db.query('INSERT INTO workspaces (org_id, name) VALUES (?, ?)', { replacements: [orgId, clean] });
   } catch { /* UNIQUE(org_id,name) race — re-read the winner below */ }
   const back = await select('SELECT id, name FROM workspaces WHERE org_id = ? AND name = ? ORDER BY id DESC LIMIT 1', [orgId, clean]);
   return { id: Number(back[0].id), name: String(back[0].name) };
}

export async function renameWorkspace(userId: string, wsId: number, name: string): Promise<void> {
   const { orgId } = await ensureUserTenancy(userId);
   await assertInOrg(orgId, wsId);
   const clean = (name || '').trim().slice(0, 60) || 'Untitled';
   await db.query('UPDATE workspaces SET name = ? WHERE id = ? AND org_id = ?', { replacements: [clean, wsId, orgId] });
}

/**
 * Removes a workspace and — since workspace == domain — its domain(s) and their data
 * (keywords, articles, site_context). Throws WORKSPACE_LAST when it's the only workspace.
 */
export async function deleteWorkspace(userId: string, wsId: number): Promise<void> {
   const { orgId } = await ensureUserTenancy(userId);
   await assertInOrg(orgId, wsId);
   const [{ n: wsCount }] = await select('SELECT COUNT(*) AS n FROM workspaces WHERE org_id = ?', [orgId]) as Array<{ n: number }>;
   if (Number(wsCount) <= 1) throw new Error('WORKSPACE_LAST');

   const domains = await select('SELECT "ID" AS id, domain FROM domain WHERE workspace_id = ?', [wsId]) as Array<{ id: number; domain: string }>;
   await db.transaction(async (tx: import('sequelize').Transaction) => {
      const q = (sql: string, repl: unknown[]) => db.query(sql, { replacements: repl, transaction: tx });
      for (const d of domains) {
         await q('DELETE FROM keyword WHERE domain = ?', [d.domain]);
         await q('DELETE FROM articles WHERE domain_id = ?', [d.id]);
         await q('DELETE FROM site_context WHERE domain_id = ?', [d.id]);
         await q('DELETE FROM domain WHERE "ID" = ?', [d.id]);
      }
      await q('DELETE FROM workspaces WHERE id = ? AND org_id = ?', [wsId, orgId]);
   });
}
