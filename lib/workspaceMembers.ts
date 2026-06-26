import db from '../database/database';
import { assertCanManage } from './members';
import { ensureUserTenancy } from './tenancy';
import { assertInOrg } from './workspaces';

type Row = Record<string, any>;
const select = async (sql: string, r: any[]): Promise<Row[]> => {
   const [rows] = await db.query(sql, { replacements: r }) as [Row[], unknown];
   return rows;
};

/** Parses a member's workspace_ids JSON column into a number[], tolerating malformed values. */
function parseWsIds(raw: unknown): number[] {
   if (raw == null || raw === '') return [];
   try { return (JSON.parse(String(raw)) as any[]).map((n) => Number(n)); } catch { return []; }
}

export type WorkspaceAccessRow = { id: number; email: string | null; role: string; hasAccess: boolean };

/** Owner/Admin only. Lists every active org member with whether they can access workspace `wsId`.
 * Owners/admins always have access (shown disabled in the UI); a member has access if their
 * workspace_ids is NULL/empty (all) or includes `wsId`. */
export async function listWorkspaceAccess(callerId: string, wsId: number): Promise<WorkspaceAccessRow[]> {
   await assertCanManage(callerId);
   const { orgId } = await ensureUserTenancy(callerId);
   await assertInOrg(orgId, wsId);
   const rows = await select(
      "SELECT id, email, role, workspace_ids FROM organization_members WHERE org_id = ? AND status = 'active' ORDER BY id ASC",
      [orgId],
   );
   return rows.map((r) => {
      const role = String(r.role);
      const all = r.workspace_ids == null || r.workspace_ids === '';
      const hasAccess = role === 'owner' || role === 'admin' ? true : (all || parseWsIds(r.workspace_ids).includes(wsId));
      return { id: Number(r.id), email: r.email == null ? null : String(r.email), role, hasAccess };
   });
}

/** Owner/Admin only. Sets the exact set of members (role 'member' only) who may access `wsId`.
 * Owners/admins are never touched. A member granted access whose set then covers all ready
 * workspaces is normalized back to NULL (= all); revoking from a NULL member materializes their
 * set to all-ready-except-`wsId`. */
export async function setWorkspaceAccess(callerId: string, wsId: number, memberIds: number[]): Promise<void> {
   await assertCanManage(callerId);
   const { orgId } = await ensureUserTenancy(callerId);
   await assertInOrg(orgId, wsId);

   const members = await select('SELECT id, role, workspace_ids FROM organization_members WHERE org_id = ?', [orgId]);
   const allWsIds = (await select("SELECT id FROM workspaces WHERE org_id = ? AND status = 'ready'", [orgId])).map((r) => Number(r.id));
   const allSet = new Set(allWsIds);

   for (const m of members) {
      if (String(m.role) !== 'member') continue;
      const memberId = Number(m.id);
      const shouldHave = memberIds.includes(memberId);
      const current = m.workspace_ids == null || m.workspace_ids === '' ? allWsIds : parseWsIds(m.workspace_ids);
      const next = shouldHave ? Array.from(new Set([...current, wsId])) : current.filter((x) => x !== wsId);
      const coversAll = next.length === allSet.size && next.every((x) => allSet.has(x));
      const json = coversAll ? null : JSON.stringify(next);
      await db.query('UPDATE organization_members SET workspace_ids = ? WHERE id = ? AND org_id = ?', { replacements: [json, memberId, orgId] });
   }
}
