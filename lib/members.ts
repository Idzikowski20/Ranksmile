import db from '../database/database';
import { ensureUserTenancy } from './tenancy';

export type Member = { id: number; user_id: string; role: string; status: string; workspace_ids: string | null };
type Row = Record<string, any>;
const select = async (sql: string, r: any[]): Promise<Row[]> => { const [rows] = await db.query(sql, { replacements: r }) as [Row[], unknown]; return rows; };

export async function listMembers(userId: string): Promise<Member[]> {
   const { orgId } = await ensureUserTenancy(userId);
   return await select('SELECT id, user_id, role, status, workspace_ids FROM organization_members WHERE org_id = ? ORDER BY id ASC', [orgId]) as Member[];
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
