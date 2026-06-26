# P1 — Workspace = Domain pivot Implementation Plan

> Phase P1 of the workspace=domain reframe (SurferSEO model). Branch: `feature/tenancy-foundation`. Reworks the ① tenancy helpers so each domain is its own workspace (1:1), migrates existing data, and enforces per-workspace member access.

**Goal:** Make `lib/tenancy.ts` implement workspace=domain (1:1): provision org+owner-membership (no single "Default"), migrate every existing domain into its own per-domain workspace, and have `getAccessibleWorkspaceIds` respect each member's role + `workspace_ids` (Owner/Admin → all org workspaces; Member → only assigned ones).

**Architecture:** `ensureUserTenancy` creates the org + owner membership only, then runs an idempotent `migrateDomainsToWorkspaces` that (a) splits any legacy multi-domain workspace into one-workspace-per-domain (first domain keeps + renames the workspace, the rest get fresh ones named after their domain) and (b) claims the user's still-unassigned domains into their own workspace. Access helpers read the caller's membership row (role + `workspace_ids`) and scope accordingly. `assertArticleAccess` is rewritten to gate on `getAccessibleWorkspaceIds`.

**Tech/conventions:** TDD with mocked DB (`jest.mock('../../database/database')`, `jest.mock('../../lib/ensureTenancyTables')`, `jest.mock('../../lib/articleSql')`). `db.query(sql,{replacements})` → `[rows,meta]`. `cd /c/Users/patry/Desktop/serpbear && ...` prefix; `npx jest <path> --ci`; `npx tsc --noEmit`. Commit specific files; trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: Rework `lib/tenancy.ts` (workspace=domain) + rewrite its tests

**Files:** Rewrite `lib/tenancy.ts`; rewrite `__tests__/lib/tenancy.test.ts`.

The full new `lib/tenancy.ts`:

```ts
import type { NextApiRequest } from 'next';
import db from '../database/database';
import { ensureTenancyTables } from './ensureTenancyTables';
import { getArticleIdSql } from './articleSql';

type Row = Record<string, any>;
async function select(sql: string, replacements: any[]): Promise<Row[]> {
   const [rows] = await db.query(sql, { replacements }) as [Row[], unknown];
   return rows;
}

const MEMBERSHIP_SQL = "SELECT org_id, role, workspace_ids FROM organization_members WHERE user_id = ? AND status = 'active' ORDER BY id ASC LIMIT 1";

async function createWorkspace(orgId: number, name: string): Promise<number> {
   await db.query('INSERT INTO workspaces (org_id, name) VALUES (?, ?)', { replacements: [orgId, name] });
   const back = await select('SELECT id FROM workspaces WHERE org_id = ? ORDER BY id DESC LIMIT 1', [orgId]);
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
      const domains = await select('SELECT id, domain FROM domain WHERE workspace_id = ? ORDER BY id ASC', [wsId]);
      await db.query('UPDATE workspaces SET name = ? WHERE id = ?', { replacements: [domains[0].domain, wsId] });
      for (let i = 1; i < domains.length; i += 1) {
         const newWs = await createWorkspace(orgId, domains[i].domain);
         await db.query('UPDATE domain SET workspace_id = ? WHERE id = ?', { replacements: [newWs, domains[i].id] });
      }
   }
   const ownerLegacy = isOwner ? ' OR "userId" IS NULL' : '';
   const orphans = await select(
      `SELECT id, domain FROM domain
        WHERE ("userId" = ?${ownerLegacy})
          AND (workspace_id IS NULL OR workspace_id NOT IN (SELECT id FROM workspaces WHERE org_id = ?))
        ORDER BY id ASC`,
      [userId, orgId],
   );
   for (const d of orphans) {
      const newWs = await createWorkspace(orgId, d.domain);
      await db.query('UPDATE domain SET workspace_id = ? WHERE id = ?', { replacements: [newWs, d.id] });
   }
}

/** Provisions the caller's org + owner membership (no default workspace), then migrates domains→workspaces. */
export async function ensureUserTenancy(userId: string): Promise<{ orgId: number }> {
   if (!userId) throw new Error('ensureUserTenancy requires a non-empty userId');
   await ensureTenancyTables();

   let member = await select(MEMBERSHIP_SQL, [userId]);
   if (!member.length) {
      try {
         await db.transaction(async (t: unknown) => {
            const opt = (r: any[]) => ({ replacements: r, transaction: t });
            await db.query('INSERT INTO organizations (owner_user_id, name) VALUES (?, ?)', opt([userId, 'My organization']));
            const [orgs] = await db.query('SELECT id FROM organizations WHERE owner_user_id = ? ORDER BY id DESC LIMIT 1', opt([userId])) as [Row[], unknown];
            const newOrgId = Number(orgs[0].id);
            await db.query("INSERT INTO organization_members (org_id, user_id, role, status) VALUES (?, ?, 'owner', 'active')", opt([newOrgId, userId]));
         });
      } catch { /* concurrent winner — re-read below */ }
      member = await select(MEMBERSHIP_SQL, [userId]);
      if (!member.length) throw new Error('tenancy provisioning failed');
   }
   const orgId = Number(member[0].org_id);
   await migrateDomainsToWorkspaces(orgId, userId, member[0].role === 'owner');
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
   try { allowed = (JSON.parse(wsIdsRaw) as any[]).map((n) => Number(n)); } catch { allowed = []; }
   return all.filter((id) => allowed.includes(id));
}

/** The active workspace: a valid `active_workspace` cookie, else the first accessible workspace, else 0 (none → create-workspace flow). */
export async function getActiveWorkspaceId(req: NextApiRequest, userId: string): Promise<number> {
   const accessible = await getAccessibleWorkspaceIds(userId);
   const raw = req.cookies?.active_workspace;
   if (raw) {
      const id = Number(raw);
      if (Number.isInteger(id) && id > 0 && accessible.includes(id)) return id;
   }
   return accessible.length ? accessible[0] : 0;
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
```

The new `__tests__/lib/tenancy.test.ts` (covers: provisioning, idempotent/no-op migrate, split, per-workspace access, active fallback, article gate):

```ts
jest.mock('../../database/database', () => ({
  __esModule: true,
  default: { query: jest.fn(), transaction: jest.fn(async (cb: any) => cb('TX')) },
}));
jest.mock('../../lib/ensureTenancyTables', () => ({ ensureTenancyTables: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../lib/articleSql', () => ({ getArticleIdSql: jest.fn().mockResolvedValue('id') }));

import db from '../../database/database';
import { ensureUserTenancy, getAccessibleWorkspaceIds, getActiveWorkspaceId, assertArticleAccess } from '../../lib/tenancy';

const mockQuery = db.query as jest.Mock;
const rows = (r: unknown[]) => [r, {}];
const owner = (extra: any = {}) => rows([{ org_id: 5, role: 'owner', workspace_ids: null, ...extra }]);

describe('ensureUserTenancy', () => {
  beforeEach(() => mockQuery.mockReset());

  it('returns the org and runs a no-op migration when nothing is shared/orphaned', async () => {
    mockQuery
      .mockResolvedValueOnce(owner())     // membership
      .mockResolvedValueOnce(rows([]))    // migrate: shared -> none
      .mockResolvedValueOnce(rows([]));   // migrate: orphans -> none
    expect(await ensureUserTenancy('u1')).toEqual({ orgId: 5 });
    const calls = mockQuery.mock.calls.map((c) => String(c[0]));
    expect(calls.some((s) => s.includes('INSERT INTO workspaces'))).toBe(false);
  });

  it('splits a legacy multi-domain workspace into one per domain', async () => {
    mockQuery
      .mockResolvedValueOnce(owner())                                  // membership
      .mockResolvedValueOnce(rows([{ ws: 9 }]))                        // shared workspaces
      .mockResolvedValueOnce(rows([{ id: 1, domain: 'a.com' }, { id: 2, domain: 'b.com' }])) // domains in ws 9
      .mockResolvedValueOnce(rows([]))                                 // UPDATE rename ws 9 -> a.com
      .mockResolvedValueOnce(rows([]))                                 // INSERT workspace for b.com
      .mockResolvedValueOnce(rows([{ id: 20 }]))                       // SELECT new ws id
      .mockResolvedValueOnce(rows([]))                                 // UPDATE domain 2 -> ws 20
      .mockResolvedValueOnce(rows([]));                                // orphans -> none
    await ensureUserTenancy('u1');
    const calls = mockQuery.mock.calls.map((c) => String(c[0]));
    expect(calls.some((s) => s.includes('INSERT INTO workspaces'))).toBe(true);
    expect(calls.some((s) => s.includes('UPDATE workspaces SET name'))).toBe(true);
    expect(calls.some((s) => s.includes('UPDATE domain SET workspace_id'))).toBe(true);
  });
});

describe('getAccessibleWorkspaceIds', () => {
  beforeEach(() => mockQuery.mockReset());

  it('returns [] for a falsy user', async () => {
    expect(await getAccessibleWorkspaceIds('')).toEqual([]);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('returns ALL org workspaces for an owner', async () => {
    mockQuery
      .mockResolvedValueOnce(owner())                 // ensure: membership
      .mockResolvedValueOnce(rows([]))                // ensure: shared
      .mockResolvedValueOnce(rows([]))                // ensure: orphans
      .mockResolvedValueOnce(owner())                 // own membership
      .mockResolvedValueOnce(rows([{ id: 9 }, { id: 10 }])); // workspaces
    expect(await getAccessibleWorkspaceIds('u1')).toEqual([9, 10]);
  });

  it('restricts a Member to their workspace_ids', async () => {
    const member = () => rows([{ org_id: 5, role: 'member', workspace_ids: '[9]' }]);
    mockQuery
      .mockResolvedValueOnce(member())                // ensure: membership
      .mockResolvedValueOnce(rows([]))                // ensure: shared
      .mockResolvedValueOnce(rows([]))                // ensure: orphans
      .mockResolvedValueOnce(member())                // own membership
      .mockResolvedValueOnce(rows([{ id: 9 }, { id: 10 }])); // workspaces
    expect(await getAccessibleWorkspaceIds('u1')).toEqual([9]);
  });
});

describe('getActiveWorkspaceId', () => {
  beforeEach(() => mockQuery.mockReset());
  const accessibleOwner = () => {
    mockQuery
      .mockResolvedValueOnce(owner())                 // ensure: membership
      .mockResolvedValueOnce(rows([]))                // ensure: shared
      .mockResolvedValueOnce(rows([]))                // ensure: orphans
      .mockResolvedValueOnce(owner())                 // own membership
      .mockResolvedValueOnce(rows([{ id: 9 }, { id: 10 }])); // workspaces
  };

  it('uses a valid cookie', async () => {
    accessibleOwner();
    expect(await getActiveWorkspaceId({ cookies: { active_workspace: '10' } } as any, 'u1')).toBe(10);
  });
  it('falls back to the first accessible workspace', async () => {
    accessibleOwner();
    expect(await getActiveWorkspaceId({ cookies: {} } as any, 'u1')).toBe(9);
  });
  it('returns 0 when the user has no workspaces', async () => {
    mockQuery
      .mockResolvedValueOnce(owner())                 // ensure: membership
      .mockResolvedValueOnce(rows([]))                // ensure: shared
      .mockResolvedValueOnce(rows([]))                // ensure: orphans
      .mockResolvedValueOnce(owner())                 // own membership
      .mockResolvedValueOnce(rows([]));               // workspaces -> none
    expect(await getActiveWorkspaceId({ cookies: {} } as any, 'u1')).toBe(0);
  });
});

describe('assertArticleAccess', () => {
  beforeEach(() => mockQuery.mockReset());
  it('returns false for a falsy user', async () => {
    expect(await assertArticleAccess('', 1)).toBe(false);
  });
  it('passes when the article workspace is accessible', async () => {
    mockQuery
      .mockResolvedValueOnce(owner())                 // ensure: membership
      .mockResolvedValueOnce(rows([]))                // ensure: shared
      .mockResolvedValueOnce(rows([]))                // ensure: orphans
      .mockResolvedValueOnce(owner())                 // own membership (getAccessible)
      .mockResolvedValueOnce(rows([{ id: 9 }]))       // workspaces
      .mockResolvedValueOnce(rows([{ ok: 1 }]));      // join hit
    expect(await assertArticleAccess('u1', 123)).toBe(true);
  });
});
```

- [ ] **Step 1:** Replace `__tests__/lib/tenancy.test.ts` with the version above. Run `cd /c/Users/patry/Desktop/serpbear && npx jest __tests__/lib/tenancy.test.ts --ci` → it FAILS against the current implementation.
- [ ] **Step 2:** Replace `lib/tenancy.ts` with the version above.
- [ ] **Step 3:** Run `cd /c/Users/patry/Desktop/serpbear && npx jest __tests__/lib/tenancy.test.ts --ci` → all pass.
- [ ] **Step 4:** `cd /c/Users/patry/Desktop/serpbear && npx tsc --noEmit` → clean. (Note: `getActiveWorkspaceId` no longer needs `ensureUserTenancy`'s `defaultWorkspaceId`; callers that destructured `{ orgId, defaultWorkspaceId }` from `ensureUserTenancy` — search `grep -rn "defaultWorkspaceId" lib pages` — must be updated to drop it. `lib/organization.ts`, `lib/workspaces.ts`, `lib/invitations.ts`, `lib/members.ts` use only `orgId`, so they are unaffected; fix any that aren't.)
- [ ] **Step 5:** Run the FULL suite `cd /c/Users/patry/Desktop/serpbear && npx jest --ci` — expect the same ~7 pre-existing UI failures and NO new ones. Then commit `lib/tenancy.ts __tests__/lib/tenancy.test.ts` — `feat(tenancy): workspace=domain model + per-workspace access`.

---

## Self-Review
- workspace=domain 1:1 via per-domain migration (split + claim) → Task 1 `migrateDomainsToWorkspaces`. ✅
- No single "Default"; new users get 0 workspaces → `getActiveWorkspaceId` returns 0 (→ wizard in P3). ✅
- Per-workspace member access (Owner/Admin all, Member subset) → `getAccessibleWorkspaceIds` + `assertArticleAccess`. ✅
- Race-safe org provisioning retained (transaction + re-read). ✅
- Idempotent migration (guarded by "shared HAVING COUNT>1" + "orphans only") — re-run is a no-op and won't touch wizard-created empty workspaces (P3). ✅
- `ensureUserTenancy` now returns `{ orgId }` only — Step 4 audits `defaultWorkspaceId` consumers. ✅
- Out of scope (P1): nav/sidebar (P2), create-workspace wizard (P3), People per-workspace UI (④b).
