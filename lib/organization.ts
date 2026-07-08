import db from '../database/database';
import { ensureUserTenancy } from './tenancy';
import type { DbRow, SqlReplacements } from './types/db';

export type OrganizationProfile = { name: string | null; logoUrl: string | null };

type Row = DbRow;

async function select(sql: string, replacements: SqlReplacements): Promise<Row[]> {
   const [rows] = await db.query(sql, { replacements }) as [Row[], unknown];
   return rows;
}

const strOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null);

export async function readOrganization(userId: string): Promise<OrganizationProfile> {
   const { orgId } = await ensureUserTenancy(userId);
   const rows = await select('SELECT name, logo_url FROM organizations WHERE id = ? LIMIT 1', [orgId]);
   const r = rows[0] || {};
   return { name: strOrNull(r.name), logoUrl: strOrNull(r.logo_url) };
}

export async function writeOrganization(
   userId: string,
   patch: { name?: string; logoUrl?: string },
): Promise<OrganizationProfile> {
   const { orgId } = await ensureUserTenancy(userId);
   const sets: string[] = [];
   const vals: SqlReplacements = [];
   if (patch.name !== undefined) { sets.push('name = ?'); vals.push(patch.name); }
   if (patch.logoUrl !== undefined) { sets.push('logo_url = ?'); vals.push(patch.logoUrl); }
   if (sets.length) {
      vals.push(orgId);
      await db.query(`UPDATE organizations SET ${sets.join(', ')} WHERE id = ?`, { replacements: vals });
   }
   return readOrganization(userId);
}
