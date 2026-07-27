import type { NextApiRequest } from 'next';
import type { Transaction } from 'sequelize';
import db from '../database/database';
import { ensureTenancyTables } from './ensureTenancyTables';
import { getArticleIdSql } from './articleSql';

import type { DbRow, SqlReplacements } from './types/db';

type Row = DbRow;
async function select(sql: string, replacements: SqlReplacements): Promise<Row[]> {
   const [rows] = await db.query(sql, { replacements }) as [Row[], unknown];
   return rows;
}

const MEMBERSHIP_SQL = "SELECT org_id, role, workspace_ids FROM organization_members WHERE user_id = ? AND status = 'active' ORDER BY id ASC LIMIT 1";

// Short-lived memo of the provisioning+migration result, so the several helper
// calls in one request (verifyDomainOwnership → getDomains → articles → …) don't
// each re-run the membership read + migrate scans. Disabled under test so the
// existing per-call mocked-DB sequences stay deterministic.
const TENANCY_CACHE_MS = 5000;
const cacheEnabled = process.env.NODE_ENV !== 'test';
const tenancyCache = new Map<string, { orgId: number; ts: number }>();

/** Inserts a workspace and returns its id; tolerant of the UNIQUE(org_id,name) race (re-reads by name). */
async function createWorkspace(orgId: number, name: string): Promise<number> {
   try {
      await db.query('INSERT INTO workspaces (org_id, name) VALUES (?, ?)', { replacements: [orgId, name] });
   } catch { /* possible UNIQUE(org_id,name) race — fall through and re-read the winner */ }
   const back = await select('SELECT id FROM workspaces WHERE org_id = ? AND name = ? ORDER BY id DESC LIMIT 1', [orgId, name]);
   return Number(back[0].id);
}

/**
 * Workspace = domain (1:1). Splits any legacy multi-domain workspace into one
 * workspace per domain (first domain keeps + renames the workspace; the rest get
 * fresh ones), and claims the user's unassigned domains into their own workspace.
 * Idempotent: a no-op once every domain is alone in an org workspace.
 */
async function migrateDomainsToWorkspaces(orgId: number, userId: string, isOwner: boolean): Promise<void> {
   const shared = await select(
      `SELECT workspace_id AS ws FROM domain
        WHERE workspace_id IN (SELECT id FROM workspaces WHERE org_id = ?)
        GROUP BY workspace_id HAVING COUNT(*) > 1`,
      [orgId],
   );
   for (const s of shared) {
      const wsId = Number(s.ws);
      const domains = await select('SELECT "ID" AS id, domain FROM domain WHERE workspace_id = ? ORDER BY "ID" ASC', [wsId]);
      await db.query('UPDATE workspaces SET name = ? WHERE id = ?', { replacements: [String(domains[0].domain ?? ''), wsId] });
      for (let i = 1; i < domains.length; i += 1) {
         const newWs = await createWorkspace(orgId, String(domains[i].domain ?? ''));
         await db.query('UPDATE domain SET workspace_id = ? WHERE "ID" = ?', { replacements: [newWs, domains[i].id] });
      }
   }
   const ownerLegacy = isOwner ? ' OR "userId" IS NULL' : '';
   const orphans = await select(
      `SELECT "ID" AS id, domain FROM domain
        WHERE ("userId" = ?${ownerLegacy})
          AND (workspace_id IS NULL OR workspace_id NOT IN (SELECT id FROM workspaces WHERE org_id = ?))
        ORDER BY "ID" ASC`,
      [userId, orgId],
   );
   for (const d of orphans) {
      const newWs = await createWorkspace(orgId, String(d.domain ?? ''));
      await db.query('UPDATE domain SET workspace_id = ? WHERE "ID" = ?', { replacements: [newWs, d.id] });
   }
}

/** Provisions the caller's org + owner membership (no default workspace), then migrates domains→workspaces. */
export async function ensureUserTenancy(userId: string): Promise<{ orgId: number }> {
   if (!userId) throw new Error('ensureUserTenancy requires a non-empty userId');
   if (cacheEnabled) {
      const c = tenancyCache.get(userId);
      if (c && Date.now() - c.ts < TENANCY_CACHE_MS) return { orgId: c.orgId };
   }
   await ensureTenancyTables();

   let member = await select(MEMBERSHIP_SQL, [userId]);
   if (!member.length) {
      try {
         await db.transaction(async (t: Transaction) => {
            const opt = (r: SqlReplacements) => ({ replacements: r, transaction: t });
            await db.query('INSERT INTO organizations (owner_user_id, name) VALUES (?, ?)', opt([userId, 'My organization']));
            const [orgs] = await db.query('SELECT id FROM organizations WHERE owner_user_id = ? ORDER BY id DESC LIMIT 1', opt([userId])) as unknown as [Row[], unknown];
            const newOrgId = Number(orgs[0].id);
            await db.query("INSERT INTO organization_members (org_id, user_id, role, status) VALUES (?, ?, 'owner', 'active')", opt([newOrgId, userId]));
            const { ensureOrgQuotaBalances } = await import('./quota/ensureBalances');
            await ensureOrgQuotaBalances(newOrgId, { transaction: t, seedFromCounts: false });
         });
      } catch { /* concurrent winner — re-read below */ }
      member = await select(MEMBERSHIP_SQL, [userId]);
      if (!member.length) throw new Error('tenancy provisioning failed');
   }
   const orgId = Number(member[0].org_id);
   await migrateDomainsToWorkspaces(orgId, userId, member[0].role === 'owner');
   if (cacheEnabled) tenancyCache.set(userId, { orgId, ts: Date.now() });
   return { orgId };
}

/** Workspace ids the user may access. Owner/Admin → all org workspaces; Member → their workspace_ids (NULL = all). */
export async function getAccessibleWorkspaceIds(userId: string | null | undefined): Promise<number[]> {
   if (!userId) return [];
   await ensureUserTenancy(userId);
   const member = await select(MEMBERSHIP_SQL, [userId]);
   if (!member.length) return [];
   const orgId = Number(member[0].org_id);
   const all = (await select('SELECT id FROM workspaces WHERE org_id = ?', [orgId])).map((r) => Number(r.id));
   const role = member[0].role;
   const wsIdsRaw = member[0].workspace_ids;
   if (role === 'owner' || role === 'admin' || wsIdsRaw == null) return all;
   let allowed: number[] = [];
   try { allowed = (JSON.parse(String(wsIdsRaw)) as unknown[]).map((n) => Number(n)); } catch { allowed = []; }
   return all.filter((id) => allowed.includes(id));
}

/** The active workspace: a valid `active_workspace` cookie, else the first accessible workspace, else 0 (none → create-workspace flow).
 *  Present-but-invalid cookie → throws ForbiddenWorkspaceError (callers map to 403). */
export class ForbiddenWorkspaceError extends Error {
   constructor() {
      super('FORBIDDEN_WORKSPACE');
      this.name = 'ForbiddenWorkspaceError';
   }
}

export async function getActiveWorkspaceId(req: NextApiRequest, userId: string): Promise<number> {
   const accessible = await getAccessibleWorkspaceIds(userId);
   const raw = req.cookies?.active_workspace;
   if (raw != null && String(raw).trim() !== '') {
      const id = Number(raw);
      if (!Number.isInteger(id) || id <= 0 || !accessible.includes(id)) {
         throw new ForbiddenWorkspaceError();
      }
      return id;
   }
   return accessible.length ? accessible[0] : 0;
}

/** List-query scope: only the active workspace (cookie-enforced). */
export async function getScopedWorkspaceIds(req: NextApiRequest, userId: string): Promise<number[]> {
   const id = await getActiveWorkspaceId(req, userId);
   return id > 0 ? [id] : [];
}

/**
 * The article id an opaque share token unlocks, or null if the token matches nothing.
 */
export async function articleIdForShareToken(token: string | null | undefined): Promise<number | null> {
   if (!token || typeof token !== 'string') return null;
   const idCol = await getArticleIdSql();
   const rows = await select(`SELECT ${idCol} AS id FROM articles WHERE share_token = ? LIMIT 1`, [token]);
   return rows.length ? Number(rows[0].id) : null;
}

/** True if the article's domain belongs to a workspace the caller can access. */
export async function assertArticleAccess(userId: string | null | undefined, articleId: number): Promise<boolean> {
   if (!userId || !Number.isInteger(articleId)) return false;
   const accessible = await getAccessibleWorkspaceIds(userId);
   if (!accessible.length) return false;
   const idCol = await getArticleIdSql();
   const placeholders = accessible.map(() => '?').join(',');
   const rows = await select(
      `SELECT 1 AS ok FROM articles a
          JOIN domain d ON d."ID" = a.domain_id
        WHERE a.${idCol} = ? AND d.workspace_id IN (${placeholders}) LIMIT 1`,
      [articleId, ...accessible],
   );
   return rows.length > 0;
}
