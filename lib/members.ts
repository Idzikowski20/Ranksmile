import db from '../database/database';
import { ensureUserTenancy } from './tenancy';

export type MemberRole = 'owner' | 'admin' | 'member';
export type Member = { id: number; user_id: string; email: string | null; role: string; status: string; workspace_ids: string | null; created_at: string | null };
type Row = Record<string, any>;
const select = async (sql: string, r: any[]): Promise<Row[]> => { const [rows] = await db.query(sql, { replacements: r }) as [Row[], unknown]; return rows; };

export async function listMembers(userId: string): Promise<Member[]> {
   const { orgId } = await ensureUserTenancy(userId);
   return await select('SELECT id, user_id, email, role, status, workspace_ids, created_at FROM organization_members WHERE org_id = ? ORDER BY id ASC', [orgId]) as Member[];
}

export async function getCallerRole(userId: string): Promise<string | null> {
   const { orgId } = await ensureUserTenancy(userId);
   const rows = await select("SELECT role FROM organization_members WHERE org_id = ? AND user_id = ? AND status = 'active' LIMIT 1", [orgId, userId]);
   return (rows[0]?.role as string) ?? null;
}

export async function assertCanManage(userId: string): Promise<void> {
   const role = await getCallerRole(userId);
   if (role !== 'owner' && role !== 'admin') throw new Error('FORBIDDEN');
}

/** Owner/Admin only. Changes a member's role. An Admin may NOT touch an Owner; nobody may demote the last owner. */
export async function changeMemberRole(callerId: string, memberId: number, role: MemberRole): Promise<void> {
   const callerRole = await getCallerRole(callerId);
   if (callerRole !== 'owner' && callerRole !== 'admin') throw new Error('FORBIDDEN');
   const { orgId } = await ensureUserTenancy(callerId);
   const rows = await select('SELECT role FROM organization_members WHERE id = ? AND org_id = ?', [memberId, orgId]);
   if (!rows.length) throw new Error('MEMBER_NOT_FOUND');
   if (rows[0].role === 'owner' && callerRole !== 'owner') throw new Error('FORBIDDEN');
   if (rows[0].role === 'owner' && role !== 'owner') {
      const owners = await select("SELECT COUNT(*) AS n FROM organization_members WHERE org_id = ? AND role = 'owner'", [orgId]);
      if (Number(owners[0].n) <= 1) throw new Error('OWNER_LAST');
   }
   await db.query('UPDATE organization_members SET role = ? WHERE id = ? AND org_id = ?', { replacements: [role, memberId, orgId] });
}

/** Owner/Admin only. Removes a member. Only an Owner may remove an Owner, and never the last one. */
export async function removeMember(callerId: string, memberId: number): Promise<void> {
   const callerRole = await getCallerRole(callerId);
   if (callerRole !== 'owner' && callerRole !== 'admin') throw new Error('FORBIDDEN');
   const { orgId } = await ensureUserTenancy(callerId);
   const rows = await select('SELECT role FROM organization_members WHERE id = ? AND org_id = ?', [memberId, orgId]);
   if (!rows.length) throw new Error('MEMBER_NOT_FOUND');
   if (rows[0].role === 'owner') {
      if (callerRole !== 'owner') throw new Error('FORBIDDEN');
      const owners = await select("SELECT COUNT(*) AS n FROM organization_members WHERE org_id = ? AND role = 'owner'", [orgId]);
      if (Number(owners[0].n) <= 1) throw new Error('OWNER_LAST');
   }
   await db.query('DELETE FROM organization_members WHERE id = ? AND org_id = ?', { replacements: [memberId, orgId] });
}

/** Owner/Admin only. Sets a member's per-workspace access (NULL = all workspaces). */
export async function setMemberWorkspaces(callerId: string, memberId: number, workspaceIds: number[] | null): Promise<void> {
   await assertCanManage(callerId);
   const { orgId } = await ensureUserTenancy(callerId);
   const json = workspaceIds && workspaceIds.length ? JSON.stringify(workspaceIds) : null;
   await db.query('UPDATE organization_members SET workspace_ids = ? WHERE id = ? AND org_id = ?', { replacements: [json, memberId, orgId] });
}

/** Self-heals a blank email on the caller's own membership row (e.g. the owner provisioned before the column existed). */
export async function backfillCallerEmail(userId: string, email: string | null): Promise<void> {
   if (!email) return;
   const { orgId } = await ensureUserTenancy(userId);
   await db.query("UPDATE organization_members SET email = ? WHERE org_id = ? AND user_id = ? AND (email IS NULL OR email = '')",
      { replacements: [email, orgId, userId] });
}
