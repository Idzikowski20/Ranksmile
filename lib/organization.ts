import db from '../database/database';
import { ensureUserTenancy } from './tenancy';

export type OrganizationProfile = { name: string | null; logoUrl: string | null };
type Row = Record<string, any>;

async function select(sql: string, replacements: any[]): Promise<Row[]> {
   const [rows] = await db.query(sql, { replacements }) as [Row[], unknown];
   return rows;
}

export async function readOrganization(userId: string): Promise<OrganizationProfile> {
   const { orgId } = await ensureUserTenancy(userId);
   const rows = await select('SELECT name, logo_url FROM organizations WHERE id = ? LIMIT 1', [orgId]);
   const r = rows[0] || {};
   return { name: r.name ?? null, logoUrl: r.logo_url ?? null };
}

export async function writeOrganization(
   userId: string,
   patch: { name?: string; logoUrl?: string },
): Promise<OrganizationProfile> {
   const { orgId } = await ensureUserTenancy(userId);
   const sets: string[] = [];
   const vals: any[] = [];
   if (patch.name !== undefined) { sets.push('name = ?'); vals.push(patch.name); }
   if (patch.logoUrl !== undefined) { sets.push('logo_url = ?'); vals.push(patch.logoUrl); }
   if (sets.length) {
      sets.push('updated_at = CURRENT_TIMESTAMP');
      await db.query(`UPDATE organizations SET ${sets.join(', ')} WHERE id = ?`, { replacements: [...vals, orgId] });
   }
   return readOrganization(userId);
}
