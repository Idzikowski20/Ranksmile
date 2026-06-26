import type { NextApiRequest } from 'next';
import type { Transaction } from 'sequelize';
import db from '../database/database';
import { ensureTenancyTables } from './ensureTenancyTables';
import { getArticleIdSql } from './articleSql';

type Row = Record<string, any>;
async function select(sql: string, replacements: any[]): Promise<Row[]> {
   const [rows] = await db.query(sql, { replacements }) as [Row[], unknown];
   return rows;
}

const MEMBERSHIP_SQL = "SELECT org_id FROM organization_members WHERE user_id = ? AND status = 'active' ORDER BY id ASC LIMIT 1";

/**
 * Idempotently provisions exactly one organization, one "Default" workspace and one
 * "owner" membership for the user, then claims their domains into that workspace.
 *
 * Concurrency-safe: the create runs inside a transaction, and the UNIQUE index on
 * organizations(owner_user_id) serializes concurrent first-requests — the loser's
 * INSERT throws, its transaction rolls back, and it re-reads the winner's org.
 * Returns the user's org id and default workspace id.
 */
export async function ensureUserTenancy(userId: string): Promise<{ orgId: number; defaultWorkspaceId: number }> {
   if (!userId) throw new Error('ensureUserTenancy requires a non-empty userId');
   await ensureTenancyTables();

   const existing = await select(MEMBERSHIP_SQL, [userId]);
   let orgId: number | undefined = existing.length ? Number(existing[0].org_id) : undefined;

   if (orgId === undefined) {
      try {
         await db.transaction(async (t: Transaction) => {
            const opt = (replacements: any[]) => ({ replacements, transaction: t });
            await db.query('INSERT INTO organizations (owner_user_id, name) VALUES (?, ?)', opt([userId, 'My organization']));
            const [orgs] = (await db.query('SELECT id FROM organizations WHERE owner_user_id = ? ORDER BY id DESC LIMIT 1', opt([userId]))) as unknown as [Row[], unknown];
            const newOrgId = Number(orgs[0].id);
            await db.query("INSERT INTO workspaces (org_id, name) VALUES (?, 'Default')", opt([newOrgId]));
            await db.query("INSERT INTO organization_members (org_id, user_id, role, status) VALUES (?, ?, 'owner', 'active')", opt([newOrgId, userId]));
            const [ws0] = (await db.query('SELECT id FROM workspaces WHERE org_id = ? ORDER BY id ASC LIMIT 1', opt([newOrgId]))) as unknown as [Row[], unknown];
            const wsId = Number(ws0[0].id);
            // Claim this user's existing domains (camelCase column → must be quoted).
            await db.query('UPDATE domain SET workspace_id = ? WHERE "userId" = ? AND workspace_id IS NULL', opt([wsId, userId]));
            // Owner-only: absorb legacy (pre-tenancy, userId NULL) domains.
            if (userId === process.env.TENANCY_OWNER_USER_ID) {
               await db.query('UPDATE domain SET workspace_id = ? WHERE "userId" IS NULL AND workspace_id IS NULL', opt([wsId]));
            }
         });
      } catch {
         // A concurrent request won the UNIQUE(owner_user_id) race — re-read the winner below.
      }
      const after = await select(MEMBERSHIP_SQL, [userId]);
      if (!after.length) throw new Error('tenancy provisioning failed');
      orgId = Number(after[0].org_id);
   }

   const ws = await select('SELECT id FROM workspaces WHERE org_id = ? ORDER BY id ASC LIMIT 1', [orgId]);
   return { orgId, defaultWorkspaceId: Number(ws[0].id) };
}

/** Workspace ids in every org where the user is an active member. [] for a falsy user. */
export async function getAccessibleWorkspaceIds(userId: string | null | undefined): Promise<number[]> {
   if (!userId) return [];
   await ensureUserTenancy(userId);
   const rows = await select(
      "SELECT w.id AS id FROM workspaces w JOIN organization_members m ON m.org_id = w.org_id WHERE m.user_id = ? AND m.status = 'active'",
      [userId],
   );
   return rows.map((r) => Number(r.id));
}

/** The active workspace: a valid `active_workspace` cookie, else the user's default workspace. */
export async function getActiveWorkspaceId(req: NextApiRequest, userId: string): Promise<number> {
   const { defaultWorkspaceId } = await ensureUserTenancy(userId);
   const raw = req.cookies?.active_workspace;
   if (raw) {
      const id = Number(raw);
      if (Number.isInteger(id) && id > 0) {
         const accessible = await getAccessibleWorkspaceIds(userId);
         if (accessible.includes(id)) return id;
      }
   }
   return defaultWorkspaceId;
}

/**
 * True if the article's domain belongs to a workspace the user can access. Guards
 * article-by-id routes, which otherwise expose data by raw id regardless of tenant.
 * Provisions first so the user's freshly-claimed domains are visible to the join.
 */
export async function assertArticleAccess(userId: string | null | undefined, articleId: number): Promise<boolean> {
   if (!userId || !Number.isInteger(articleId)) return false;
   await ensureUserTenancy(userId);
   const idCol = await getArticleIdSql();
   const rows = await select(
      `SELECT 1 AS ok FROM articles a
          JOIN domain d ON d."ID" = a.domain_id
          JOIN workspaces w ON w.id = d.workspace_id
          JOIN organization_members m ON m.org_id = w.org_id
        WHERE a.${idCol} = ? AND m.user_id = ? AND m.status = 'active' LIMIT 1`,
      [articleId, userId],
   );
   return rows.length > 0;
}
