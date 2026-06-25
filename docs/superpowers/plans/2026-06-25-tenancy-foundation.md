# Tenancy Foundation (①) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce Organizations / Workspaces / Members data backbone and isolate domain & article data per workspace, with auto-provisioning and migration of existing domains — no UI.

**Architecture:** New raw-SQL tables (`organizations`, `workspaces`, `organization_members`) + a `workspace_id` column on the existing Sequelize `domain` table. A `lib/tenancy.ts` module provisions one org/workspace/owner per user on first access and resolves the active/accessible workspaces. The existing centralized ownership helper (`utils/verifyDomainOwnership.ts`) and the handful of inline `{userId OR null}` filters are switched from user-scoping to **workspace-scoping**, which covers every domain/article route.

**Tech Stack:** Next.js 12 API routes, TypeScript, Sequelize (`db.query` raw + models), Postgres (Neon) / SQLite, Jest (jsdom) with mocked DB.

**Spec:** `docs/superpowers/specs/2026-06-25-tenancy-foundation-design.md`

**Conventions for every task:**
- Verify types after code changes: `npx tsc --noEmit` (must be clean).
- Run a single test file with: `npx jest <path> --ci` (the `test` npm script is watch-mode; use `npx jest … --ci` for one-shot).
- After code changes, refresh the graph: `graphify update .`
- DB column on `domain` is camelCase `"userId"` — in raw SQL it MUST be quoted (Postgres folds unquoted identifiers to lowercase). `workspace_id` is lowercase/snake — no quoting needed.
- Raw upserts are dialect-agnostic (select-then-insert, **never** `ON CONFLICT`) — same pattern as `pages/api/onboarding.ts`.
- `db.query(sql, { replacements: [...] })` returns `[rows, meta]`; destructure `const [rows] = await db.query(...)`.

---

### Task 1: Tenancy tables + `domain.workspace_id` column (`lib/ensureTenancyTables.ts`)

Mirror `lib/ensureArticlesTables.ts`: dialect-aware raw SQL, idempotent, guarded by a module flag.

**Files:**
- Create: `lib/ensureTenancyTables.ts`
- Test: `__tests__/lib/ensureTenancyTables.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/ensureTenancyTables.test.ts
jest.mock('../../database/database', () => ({
  __esModule: true,
  default: { query: jest.fn().mockResolvedValue([[], {}]) },
}));

import db from '../../database/database';
import { ensureTenancyTables } from '../../lib/ensureTenancyTables';

const mockQuery = db.query as jest.Mock;

describe('ensureTenancyTables', () => {
  beforeEach(() => mockQuery.mockClear());

  it('issues DDL for the three tenancy tables and the domain column', async () => {
    await ensureTenancyTables();
    const sql = mockQuery.mock.calls.map((c) => String(c[0])).join('\n');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS organizations');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS workspaces');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS organization_members');
    expect(sql).toContain('ALTER TABLE domain ADD COLUMN workspace_id');
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_org_owner');
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_org_members_unique');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/ensureTenancyTables.test.ts --ci`
Expected: FAIL — `Cannot find module '../../lib/ensureTenancyTables'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/ensureTenancyTables.ts
import db from '../database/database';

let tablesChecked = false;
const isPostgres = !!process.env.DATABASE_URL;
const PK = isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
const NOW = 'CURRENT_TIMESTAMP';

/** Creates the org/workspace/member tables and the domain.workspace_id column. Idempotent. */
export async function ensureTenancyTables(): Promise<void> {
   if (tablesChecked) return;

   await db.query(`
      CREATE TABLE IF NOT EXISTS organizations (
         id            ${PK},
         owner_user_id TEXT NOT NULL,
         name          TEXT,
         logo_url      TEXT,
         created_at    TIMESTAMP DEFAULT ${NOW},
         updated_at    TIMESTAMP DEFAULT ${NOW}
      )
   `);

   await db.query(`
      CREATE TABLE IF NOT EXISTS workspaces (
         id         ${PK},
         org_id     INTEGER NOT NULL,
         name       TEXT NOT NULL DEFAULT 'Default',
         created_at TIMESTAMP DEFAULT ${NOW}
      )
   `);

   await db.query(`
      CREATE TABLE IF NOT EXISTS organization_members (
         id         ${PK},
         org_id     INTEGER NOT NULL,
         user_id    TEXT NOT NULL,
         role       TEXT NOT NULL DEFAULT 'owner',
         status     TEXT NOT NULL DEFAULT 'active',
         created_at TIMESTAMP DEFAULT ${NOW}
      )
   `);

   // domain.workspace_id — tenancy scope key. Harmless failure if it already exists.
   try { await db.query('ALTER TABLE domain ADD COLUMN workspace_id INTEGER'); } catch { /* exists */ }

   // UNIQUE on owner_user_id enforces one org per owner (① invariant) AND serves as
   // the lookup index — it is the serialization point that prevents the provisioning
   // race (two concurrent first-requests can't both INSERT an org for the same user).
   try { await db.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_org_owner ON organizations(owner_user_id)'); } catch { /* noop */ }
   try { await db.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_org_members_unique ON organization_members(org_id, user_id)'); } catch { /* noop */ }
   try { await db.query('CREATE INDEX IF NOT EXISTS idx_workspaces_org ON workspaces(org_id)'); } catch { /* noop */ }
   try { await db.query('CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id)'); } catch { /* noop */ }
   try { await db.query('CREATE INDEX IF NOT EXISTS idx_domain_workspace ON domain(workspace_id)'); } catch { /* noop */ }

   if (!process.env.TENANCY_OWNER_USER_ID) {
      console.warn('[tenancy] TENANCY_OWNER_USER_ID is unset — legacy (NULL workspace) domains stay hidden until claimed.');
   }

   tablesChecked = true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/ensureTenancyTables.test.ts --ci`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add lib/ensureTenancyTables.ts __tests__/lib/ensureTenancyTables.test.ts
git commit -m "feat(tenancy): org/workspace/member tables + domain.workspace_id"
```

---

### Task 2: Add `workspace_id` to the Sequelize `domain` model

So Sequelize SELECTs include the column and `addDomain`/`configure` can set it. No unit test — a Sequelize column declaration is verified by the type checker and by Task 1's runtime ALTER (the source of truth for existing DBs).

**Files:**
- Modify: `database/models/domain.ts` (after the `userId` column, ~line 62)

- [ ] **Step 1: Add the column**

In `database/models/domain.ts`, immediately after the `userId!: string | null;` column block, add:

```ts
   // Tenancy scope — FK to workspaces.id (null = unassigned/legacy, pre-tenancy)
   @Column({ type: DataType.INTEGER, allowNull: true, defaultValue: null })
   workspace_id!: number | null;
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean (no output).

- [ ] **Step 3: Commit**

```bash
git add database/models/domain.ts
git commit -m "feat(tenancy): add workspace_id to domain model"
```

---

### Task 3: Provisioning + workspace resolution (`lib/tenancy.ts`)

The core. `getAccessibleWorkspaceIds` calls `ensureUserTenancy` so provisioning happens on the first scoped request of any route.

**Files:**
- Create: `lib/tenancy.ts`
- Test: `__tests__/lib/tenancy.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/tenancy.test.ts
jest.mock('../../database/database', () => ({
  __esModule: true,
  default: { query: jest.fn(), transaction: jest.fn(async (cb: any) => cb('TX')) },
}));
jest.mock('../../lib/ensureTenancyTables', () => ({
  ensureTenancyTables: jest.fn().mockResolvedValue(undefined),
}));

import db from '../../database/database';
import { ensureUserTenancy, getAccessibleWorkspaceIds, getActiveWorkspaceId, assertArticleAccess } from '../../lib/tenancy';

const mockQuery = db.query as jest.Mock;
const mockTx = (db as any).transaction as jest.Mock;
const rows = (r: unknown[]) => [r, {}];

describe('ensureUserTenancy', () => {
  beforeEach(() => { mockQuery.mockReset(); mockTx.mockClear(); });

  it('returns existing org/workspace without creating anything when a membership exists', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([{ org_id: 7 }]))      // SELECT membership
      .mockResolvedValueOnce(rows([{ id: 12 }]));        // SELECT default workspace
    const res = await ensureUserTenancy('user-a');
    expect(res).toEqual({ orgId: 7, defaultWorkspaceId: 12 });
    const sql = mockQuery.mock.calls.map((c) => String(c[0]));
    expect(sql.some((s) => s.includes('INSERT INTO organizations'))).toBe(false);
  });

  it('provisions org, workspace, owner membership and claims the user own domains', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([]))                   // SELECT membership -> none
      .mockResolvedValueOnce(rows([]))                   // [tx] INSERT organizations
      .mockResolvedValueOnce(rows([{ id: 3 }]))          // [tx] SELECT org back
      .mockResolvedValueOnce(rows([]))                   // [tx] INSERT workspaces
      .mockResolvedValueOnce(rows([]))                   // [tx] INSERT membership
      .mockResolvedValueOnce(rows([{ id: 9 }]))          // [tx] SELECT workspace back (claim)
      .mockResolvedValueOnce(rows([]))                   // [tx] UPDATE domain (claim own)
      .mockResolvedValueOnce(rows([{ org_id: 3 }]))      // re-read membership (authoritative)
      .mockResolvedValueOnce(rows([{ id: 9 }]));         // SELECT default workspace
    const res = await ensureUserTenancy('user-b');
    expect(res).toEqual({ orgId: 3, defaultWorkspaceId: 9 });
    expect(mockTx).toHaveBeenCalledTimes(1);
    const calls = mockQuery.mock.calls.map((c) => String(c[0]));
    const idx = (sub: string) => calls.findIndex((s) => s.includes(sub));
    // Assert the actual SQL + ordering, so a later reorder of the inserts fails the test.
    expect(idx('INSERT INTO organizations')).toBeGreaterThanOrEqual(0);
    expect(idx('INSERT INTO organizations')).toBeLessThan(idx('INSERT INTO workspaces'));
    expect(idx('INSERT INTO workspaces')).toBeLessThan(idx('INSERT INTO organization_members'));
    expect(calls.some((s) => s.includes('UPDATE domain SET workspace_id') && s.includes('"userId" = ?'))).toBe(true);
  });

  it('falls back to the winner org when the provisioning insert conflicts (race)', async () => {
    mockTx.mockImplementationOnce(async () => { throw new Error('UNIQUE constraint failed: organizations.owner_user_id'); });
    mockQuery
      .mockResolvedValueOnce(rows([]))                   // SELECT membership -> none
      .mockResolvedValueOnce(rows([{ org_id: 42 }]))     // re-read membership -> winner exists
      .mockResolvedValueOnce(rows([{ id: 77 }]));        // SELECT default workspace
    const res = await ensureUserTenancy('user-race');
    expect(res).toEqual({ orgId: 42, defaultWorkspaceId: 77 });
  });

  it('claims legacy (userId NULL) domains only for the configured owner', async () => {
    process.env.TENANCY_OWNER_USER_ID = 'owner-1';
    mockQuery
      .mockResolvedValueOnce(rows([]))                   // membership none
      .mockResolvedValueOnce(rows([]))                   // [tx] INSERT org
      .mockResolvedValueOnce(rows([{ id: 1 }]))          // [tx] org back
      .mockResolvedValueOnce(rows([]))                   // [tx] INSERT workspace
      .mockResolvedValueOnce(rows([]))                   // [tx] INSERT membership
      .mockResolvedValueOnce(rows([{ id: 2 }]))          // [tx] workspace back
      .mockResolvedValueOnce(rows([]))                   // [tx] UPDATE own domains
      .mockResolvedValueOnce(rows([]))                   // [tx] UPDATE legacy domains
      .mockResolvedValueOnce(rows([{ org_id: 1 }]))      // re-read membership
      .mockResolvedValueOnce(rows([{ id: 2 }]));         // SELECT default ws
    await ensureUserTenancy('owner-1');
    const calls = mockQuery.mock.calls.map((c) => String(c[0]));
    expect(calls.some((s) => s.includes('"userId" IS NULL'))).toBe(true);
  });
});

describe('getAccessibleWorkspaceIds', () => {
  beforeEach(() => mockQuery.mockReset());
  it('returns [] for a falsy user without provisioning', async () => {
    const res = await getAccessibleWorkspaceIds('');
    expect(res).toEqual([]);
    expect(mockQuery).not.toHaveBeenCalled();
  });
  it('maps the SELECT rows to numeric workspace ids', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([{ org_id: 5 }]))      // ensureUserTenancy: membership
      .mockResolvedValueOnce(rows([{ id: 8 }]))          // ensureUserTenancy: default ws
      .mockResolvedValueOnce(rows([{ id: 8 }, { id: 9 }])); // accessible ws
    const res = await getAccessibleWorkspaceIds('user-c');
    expect(res).toEqual([8, 9]);
  });
});

describe('getActiveWorkspaceId', () => {
  beforeEach(() => mockQuery.mockReset());
  it('falls back to the default workspace when no cookie is set', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([{ org_id: 1 }]))      // membership
      .mockResolvedValueOnce(rows([{ id: 4 }]));         // default ws
    const req = { cookies: {} } as any;
    expect(await getActiveWorkspaceId(req, 'user-d')).toBe(4);
  });
  it('rejects a cookie pointing at a non-accessible workspace', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([{ org_id: 1 }]))      // ensureUserTenancy membership
      .mockResolvedValueOnce(rows([{ id: 4 }]))          // default ws
      .mockResolvedValueOnce(rows([{ org_id: 1 }]))      // getAccessible: ensureUserTenancy membership
      .mockResolvedValueOnce(rows([{ id: 4 }]))          // getAccessible: default ws
      .mockResolvedValueOnce(rows([{ id: 4 }]));         // getAccessible: accessible ws -> [4]
    const req = { cookies: { active_workspace: '999' } } as any;
    expect(await getActiveWorkspaceId(req, 'user-e')).toBe(4);
  });
  it('ignores a non-positive / non-integer cookie value and uses the default', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([{ org_id: 1 }]))      // ensureUserTenancy membership
      .mockResolvedValueOnce(rows([{ id: 4 }]));         // default ws
    const req = { cookies: { active_workspace: '-1' } } as any;
    expect(await getActiveWorkspaceId(req, 'user-f')).toBe(4);
  });
});

describe('assertArticleAccess', () => {
  beforeEach(() => mockQuery.mockReset());
  it('returns false for a falsy user without querying', async () => {
    expect(await assertArticleAccess('', 1)).toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });
  it('returns true when the article workspace is accessible', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([{ org_id: 1 }]))      // ensureUserTenancy membership
      .mockResolvedValueOnce(rows([{ id: 2 }]))          // default ws
      .mockResolvedValueOnce(rows([{ ok: 1 }]));         // join hit
    expect(await assertArticleAccess('u1', 123)).toBe(true);
  });
  it('returns false when the join finds no accessible article', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([{ org_id: 1 }]))      // ensureUserTenancy membership
      .mockResolvedValueOnce(rows([{ id: 2 }]))          // default ws
      .mockResolvedValueOnce(rows([]));                  // join miss
    expect(await assertArticleAccess('u1', 999)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/tenancy.test.ts --ci`
Expected: FAIL — `Cannot find module '../../lib/tenancy'`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/tenancy.ts
import type { NextApiRequest } from 'next';
import db from '../database/database';
import { ensureTenancyTables } from './ensureTenancyTables';

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
         await db.transaction(async (t: unknown) => {
            const opt = (replacements: any[]) => ({ replacements, transaction: t });
            await db.query('INSERT INTO organizations (owner_user_id, name) VALUES (?, ?)', opt([userId, 'My organization']));
            const [orgs] = await db.query('SELECT id FROM organizations WHERE owner_user_id = ? ORDER BY id DESC LIMIT 1', opt([userId])) as [Row[], unknown];
            const newOrgId = Number(orgs[0].id);
            await db.query("INSERT INTO workspaces (org_id, name) VALUES (?, 'Default')", opt([newOrgId]));
            await db.query("INSERT INTO organization_members (org_id, user_id, role, status) VALUES (?, ?, 'owner', 'active')", opt([newOrgId, userId]));
            const [ws0] = await db.query('SELECT id FROM workspaces WHERE org_id = ? ORDER BY id ASC LIMIT 1', opt([newOrgId])) as [Row[], unknown];
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
   const rows = await select(
      `SELECT 1 AS ok FROM articles a
          JOIN domain d ON d."ID" = a.domain_id
          JOIN workspaces w ON w.id = d.workspace_id
          JOIN organization_members m ON m.org_id = w.org_id
        WHERE a.id = ? AND m.user_id = ? AND m.status = 'active' LIMIT 1`,
      [articleId, userId],
   );
   return rows.length > 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/tenancy.test.ts --ci`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add lib/tenancy.ts __tests__/lib/tenancy.test.ts
git commit -m "feat(tenancy): ensureUserTenancy + workspace resolution helpers"
```

---

### Task 4: Switch ownership helper to workspace scope (`utils/verifyDomainOwnership.ts`)

This one change re-scopes every route that already uses the helper: `pages/api/domain.ts`, `pages/api/keywords.ts`, `pages/api/audit.ts`, `pages/api/domains/goal.ts`.

**Files:**
- Modify: `utils/verifyDomainOwnership.ts`
- Test: `__tests__/utils/verifyDomainOwnership.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/utils/verifyDomainOwnership.test.ts
jest.mock('../../database/models/domain', () => ({
  __esModule: true,
  default: { findOne: jest.fn() },
}));
jest.mock('../../lib/tenancy', () => ({
  getAccessibleWorkspaceIds: jest.fn(),
}));

import Domain from '../../database/models/domain';
import { getAccessibleWorkspaceIds } from '../../lib/tenancy';
import { verifyDomainOwnership } from '../../utils/verifyDomainOwnership';

const findOne = Domain.findOne as jest.Mock;
const accessible = getAccessibleWorkspaceIds as jest.Mock;

describe('verifyDomainOwnership (workspace-scoped)', () => {
  beforeEach(() => { findOne.mockReset(); accessible.mockReset(); });

  it('returns null when the domain does not exist', async () => {
    accessible.mockResolvedValue([5]);
    findOne.mockResolvedValueOnce(null)   // workspace-filtered lookup misses
           .mockResolvedValueOnce(null);  // existence check misses
    expect(await verifyDomainOwnership('x.com', 'u1')).toBeNull();
  });

  it('returns false when the domain exists but its workspace is not accessible', async () => {
    accessible.mockResolvedValue([5]);
    findOne.mockResolvedValueOnce(null)        // filtered lookup misses
           .mockResolvedValueOnce({ ID: 1 });  // existence check hits
    expect(await verifyDomainOwnership('x.com', 'u1')).toBe(false);
  });

  it('returns the domain when its workspace is accessible (single query)', async () => {
    accessible.mockResolvedValue([5, 6]);
    const rec = { ID: 1, workspace_id: 6 };
    findOne.mockResolvedValueOnce(rec);
    expect(await verifyDomainOwnership('x.com', 'u1')).toBe(rec);
    expect(findOne).toHaveBeenCalledTimes(1);
  });

  it('carries the accessible workspace ids in the query WHERE clause', async () => {
    accessible.mockResolvedValue([6]);
    findOne.mockResolvedValueOnce({ ID: 1 });
    await verifyDomainOwnership('x.com', 'u1');
    expect(JSON.stringify(findOne.mock.calls[0][0].where)).toContain('6');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/utils/verifyDomainOwnership.test.ts --ci`
Expected: FAIL — current helper checks `userId`, so the "not accessible" case returns the record instead of `false`.

- [ ] **Step 3: Rewrite the helper**

Replace the entire contents of `utils/verifyDomainOwnership.ts` with:

```ts
import { Op } from 'sequelize';
import Domain from '../database/models/domain';
import { getAccessibleWorkspaceIds } from '../lib/tenancy';

/**
 * Workspace-scoped access check. Authorization lives in the query WHERE clause (a
 * single point), so a row the user may not see is never loaded. Returns the domain
 * if its workspace is accessible, null if it doesn't exist, false if it exists but
 * is denied. The second (existence) query only runs on the deny/not-found path.
 */
export async function verifyDomainOwnership(
   domainName: string,
   userId: string | null,
): Promise<Domain | null | false> {
   const wsIds = await getAccessibleWorkspaceIds(userId);
   const owned = await Domain.findOne({ where: { domain: domainName, workspace_id: { [Op.in]: wsIds } } });
   if (owned) return owned;
   const exists = await Domain.findOne({ where: { domain: domainName }, attributes: ['ID'] });
   return exists ? false : null;
}

/** Same as `verifyDomainOwnership`, but looks the domain up by slug. */
export async function verifyDomainOwnershipBySlug(
   slug: string,
   userId: string | null,
): Promise<Domain | null | false> {
   const wsIds = await getAccessibleWorkspaceIds(userId);
   const owned = await Domain.findOne({ where: { slug, workspace_id: { [Op.in]: wsIds } } });
   if (owned) return owned;
   const exists = await Domain.findOne({ where: { slug }, attributes: ['ID'] });
   return exists ? false : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/utils/verifyDomainOwnership.test.ts --ci`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add utils/verifyDomainOwnership.ts __tests__/utils/verifyDomainOwnership.test.ts
git commit -m "feat(tenancy): scope domain ownership by workspace"
```

---

### Task 5: Scope the domains route (`pages/api/domains.ts`)

Replace the `{userId OR null}` list filter with a workspace filter, stamp new domains with the active workspace, and add a workspace guard to `updateDomain` (which currently has none).

**Files:**
- Modify: `pages/api/domains.ts` (`getDomains` ~56-77, `addDomain` ~79-104, `updateDomain` ~129-171)
- Test: `__tests__/api/domains-scope.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/api/domains-scope.test.ts
jest.mock('../../database/database', () => ({ __esModule: true, default: { sync: jest.fn(), query: jest.fn() } }));
jest.mock('../../database/models/domain', () => ({ __esModule: true, default: { findAll: jest.fn(), bulkCreate: jest.fn() } }));
jest.mock('../../lib/tenancy', () => ({
  getAccessibleWorkspaceIds: jest.fn(),
  getActiveWorkspaceId: jest.fn(),
}));
jest.mock('../../utils/domains', () => ({ __esModule: true, default: jest.fn(async (d) => d) }));

import Domain from '../../database/models/domain';
import { getAccessibleWorkspaceIds, getActiveWorkspaceId } from '../../lib/tenancy';
import { getDomains, addDomain } from '../../pages/api/domains';

const findAll = Domain.findAll as jest.Mock;
const bulkCreate = Domain.bulkCreate as jest.Mock;

const makeRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('domains route scoping', () => {
  beforeEach(() => { findAll.mockReset(); bulkCreate.mockReset(); (getAccessibleWorkspaceIds as jest.Mock).mockReset(); (getActiveWorkspaceId as jest.Mock).mockReset(); });

  it('getDomains filters Domain.findAll by accessible workspace ids', async () => {
    (getAccessibleWorkspaceIds as jest.Mock).mockResolvedValue([8]);
    findAll.mockResolvedValue([]);
    const res = makeRes();
    await getDomains({ query: {} } as any, res, 'user-a');
    const whereArg = findAll.mock.calls[0][0].where;
    expect(JSON.stringify(whereArg)).toContain('8');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('addDomain stamps the active workspace id on created domains', async () => {
    (getActiveWorkspaceId as jest.Mock).mockResolvedValue(8);
    bulkCreate.mockResolvedValue([{ get: () => ({ ID: 1 }) }]);
    const res = makeRes();
    await addDomain({ body: { domains: ['a.com'] } } as any, res, 'user-a');
    expect(bulkCreate.mock.calls[0][0][0].workspace_id).toBe(8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/api/domains-scope.test.ts --ci`
Expected: FAIL — `getDomains`/`addDomain` don't yet import the tenancy helpers (mock assertions unmet / `getActiveWorkspaceId` undefined).

- [ ] **Step 3: Edit `pages/api/domains.ts`**

3a. Add the import after line 8 (`import { getCurrentUserId } ...`):

```ts
import { getAccessibleWorkspaceIds, getActiveWorkspaceId } from '../../lib/tenancy';
```

3b. Replace the body of `getDomains` (the `try` block, lines ~58-73) so the where-clause uses workspaces:

```ts
   const withStats = !!req?.query?.withstats;
   try {
      const { Op } = await import('sequelize');
      const wsIds = await getAccessibleWorkspaceIds(userId);
      const allDomains: Domain[] = await Domain.findAll({ where: { workspace_id: { [Op.in]: wsIds } } });
      const formattedDomains: DomainType[] = allDomains.map((el) => {
         const domainItem:DomainType = el.get({ plain: true });
         const scData = domainItem?.search_console ? JSON.parse(domainItem.search_console) : {};
         const { client_email, private_key } = scData;
         const searchConsoleData = scData ? { ...scData, client_email: client_email ? 'true' : '', private_key: private_key ? 'true' : '' } : {};
         return { ...domainItem, search_console: JSON.stringify(searchConsoleData) };
      });
      const theDomains: DomainType[] = withStats ? await getdomainStats(formattedDomains) : formattedDomains;
      return res.status(200).json({ domains: theDomains });
   } catch (error) {
      return res.status(400).json({ domains: [], error: 'Error Getting Domains.' });
   }
```

3c. In `addDomain`, resolve the active workspace and add `workspace_id` to each row. Change the start of `addDomain` (lines ~79-92) to:

```ts
const addDomain = async (req: NextApiRequest, res: NextApiResponse<DomainsAddResponse>, userId?: string | null) => {
   const { domains } = req.body;
   if (domains && Array.isArray(domains) && domains.length > 0) {
      const domainsToAdd: any = [];
      const workspaceId = userId ? await getActiveWorkspaceId(req, userId) : null;

      domains.forEach((domain: string) => {
         domainsToAdd.push({
            domain: domain.trim(),
            slug: domain.trim().replaceAll('-', '_').replaceAll('.', '-').replaceAll('/', '-'),
            lastUpdated: new Date().toJSON(),
            added: new Date().toJSON(),
            userId: userId || null,
            workspace_id: workspaceId,
         });
      });
```

3d. Add a workspace guard to `updateDomain` (it currently checks nothing). After `const { domain } = req.query || {};` (line ~133) insert:

```ts
   const userId = await getCurrentUserId(req, res);
   const wsIds = await getAccessibleWorkspaceIds(userId);
   const existing = await Domain.findOne({ where: { domain } });
   if (existing) {
      const ws = (existing as unknown as { workspace_id: number | null }).workspace_id;
      if (ws == null || !wsIds.includes(Number(ws))) {
         return res.status(403).json({ domain: null, error: 'Access denied.' });
      }
   }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/api/domains-scope.test.ts --ci`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add pages/api/domains.ts __tests__/api/domains-scope.test.ts
git commit -m "feat(tenancy): scope /api/domains by workspace"
```

---

### Task 6: Scope the articles list (`pages/api/articles/index.ts`)

`getUserDomainIds` is the single scope point for every article query in this route. Switch it to workspace ids.

**Files:**
- Modify: `pages/api/articles/index.ts` (`getUserDomainIds` ~29-37)
- Test: `__tests__/api/articles-scope.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/api/articles-scope.test.ts
jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('../../database/models/domain', () => ({ __esModule: true, default: { findAll: jest.fn(), findOne: jest.fn() } }));
jest.mock('../../lib/tenancy', () => ({ getAccessibleWorkspaceIds: jest.fn() }));

import Domain from '../../database/models/domain';
import { getAccessibleWorkspaceIds } from '../../lib/tenancy';
import { getUserDomainIds } from '../../pages/api/articles/index';

const findAll = Domain.findAll as jest.Mock;

describe('articles getUserDomainIds (workspace-scoped)', () => {
  beforeEach(() => { findAll.mockReset(); (getAccessibleWorkspaceIds as jest.Mock).mockReset(); });

  it('queries domains by accessible workspace ids and returns their IDs', async () => {
    (getAccessibleWorkspaceIds as jest.Mock).mockResolvedValue([8]);
    findAll.mockResolvedValue([{ ID: 1 }, { ID: 2 }]);
    const ids = await getUserDomainIds('user-a');
    expect(JSON.stringify(findAll.mock.calls[0][0].where)).toContain('8');
    expect(ids).toEqual([1, 2]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/api/articles-scope.test.ts --ci`
Expected: FAIL — `getUserDomainIds` is not exported and still filters by `userId`.

- [ ] **Step 3: Edit `pages/api/articles/index.ts`**

3a. Add the import near the existing `getCurrentUserId` import (line ~7):

```ts
import { getAccessibleWorkspaceIds } from '../../../lib/tenancy';
```

3b. Replace the `getUserDomainIds` function (currently lines ~29-37) with an **exported**, workspace-scoped version:

```ts
/** Domain IDs in the user's accessible workspaces. */
export async function getUserDomainIds(userId: string | null): Promise<number[]> {
   const wsIds = await getAccessibleWorkspaceIds(userId);
   const domains = await Domain.findAll({ where: { workspace_id: { [Op.in]: wsIds } }, attributes: ['ID'] });
   return domains.map((d) => d.ID);
}
```

(`Op` is already imported in this file; if a lint error says it isn't, add `import { Op } from 'sequelize';` at the top.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/api/articles-scope.test.ts --ci`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add pages/api/articles/index.ts __tests__/api/articles-scope.test.ts
git commit -m "feat(tenancy): scope article queries by workspace"
```

---

### Task 7: Sweep remaining inline-scoped routes (`sites.ts`, `insight.ts`, `configure.ts`)

These three resolve domains with their own `{ userId }` filter or `findOrCreate` and must be switched to workspace scoping. (`domain.ts`, `keywords.ts`, `audit.ts`, `goal.ts` are already covered by Task 4's helper rewrite — no edits needed there.) No new unit test: the scoping logic lives in the already-tested `getAccessibleWorkspaceIds` / `getActiveWorkspaceId`; verify with `npx tsc --noEmit` and a manual smoke (Step 4).

**Files:**
- Modify: `pages/api/sites.ts`, `pages/api/insight.ts`, `pages/api/domains/configure.ts`

- [ ] **Step 1: `pages/api/sites.ts`** — add the import and replace the two `{ userId }` domain queries.

Add near the `getCurrentUserId` import (line ~5):
```ts
import { getAccessibleWorkspaceIds } from '../../lib/tenancy';
```
Before the first `Domain.findAll({ where: { userId } })` (line ~62), resolve workspace ids once at the top of the handler body (right after `const userId = await getCurrentUserId(req, res);`, line ~51):
```ts
   const { Op } = await import('sequelize');
   const wsIds = await getAccessibleWorkspaceIds(userId);
```
Then change both `Domain.findAll({ where: { userId } })` occurrences (lines ~62 and ~109) to:
```ts
Domain.findAll({ where: { workspace_id: { [Op.in]: wsIds } } })
```

- [ ] **Step 2: `pages/api/insight.ts`** — guard the domain lookup. Add the import (near line 6):
```ts
import { verifyDomainOwnership } from '../../utils/verifyDomainOwnership';
```
Replace the raw lookup (lines ~56-57):
```ts
      const query = { domain: domainname };
      const foundDomain:Domain| null = await Domain.findOne({ where: query });
```
with an ownership-checked lookup:
```ts
      const ownership = await verifyDomainOwnership(domainname, userId ?? null);
      if (ownership === false) return res.status(403).json({ data: null, error: 'Access denied.' });
      if (ownership === null) return res.status(404).json({ data: null, error: 'Domain not found.' });
      const foundDomain: Domain | null = ownership;
```

- [ ] **Step 3: `pages/api/domains/configure.ts`** — stamp `workspace_id` on create and reject **adopting** an existing domain you don't own (including unassigned/legacy `workspace_id IS NULL` — that's the owner's migration job, not arbitrary adoption). Add the import (near line 7):
```ts
import { getActiveWorkspaceId, getAccessibleWorkspaceIds } from '../../../lib/tenancy';
```
Resolve the active workspace before the `findOrCreate` (after `const slug = ...`, ~line 27):
```ts
      const workspaceId = userId ? await getActiveWorkspaceId(req, userId) : null;
```
Add `workspace_id: workspaceId,` to the `defaults` object of `findOrCreate` (alongside `userId: userId || null,`). Capture the `created` flag and guard a **pre-existing** domain — a freshly created one is fine; an existing `NULL`-workspace or other-workspace domain is rejected. Change `const [domain] = await Domain.findOrCreate({...})` to:
```ts
      const [domain, created] = await Domain.findOrCreate({
         // ...unchanged where/defaults (now including workspace_id)...
      });
      if (!created) {
         const existingWs = (domain as unknown as { workspace_id: number | null }).workspace_id;
         const wsIds = await getAccessibleWorkspaceIds(userId);
         if (existingWs == null || !wsIds.includes(Number(existingWs))) {
            return res.status(403).json({ error: 'Access denied.' });
         }
      }
```

- [ ] **Step 4: Typecheck + manual smoke**

```bash
npx tsc --noEmit
```
Manual smoke (with the dev server running, `npm run dev`): as a logged-in user, `GET /api/domains` returns only your domains; `GET /api/sites` lists only your domains; opening a domain you own works, and a domain id you don't own returns 403.
Expected: tsc clean; smoke behaves as described.

- [ ] **Step 5: Commit**

```bash
git add pages/api/sites.ts pages/api/insight.ts pages/api/domains/configure.ts
git commit -m "feat(tenancy): scope sites/insight/configure routes by workspace"
```

---

### Task 8: Harden article-by-id and keyword-mutation routes

Article and keyword routes that operate purely by **id** (not by domain) currently let any authenticated user read/mutate another tenant's data by guessing an id. Guard them with the already-tested `assertArticleAccess` (articles) and `verifyDomainOwnership` (keywords). This is a uniform sweep — the guard logic itself is unit-tested in Task 3; this task applies it and adds one representative route test.

**Files:**
- Modify: every handler under `pages/api/articles/[id]/` (e.g. `index.ts`, `generate.ts`, `comments.ts`, `comments-stream.ts`, `share-link.ts`, `debug-export.ts`, `wizard-state.ts`, `versions.ts`)
- Modify: `pages/api/keywords.ts` (PUT and DELETE branches)
- Test: `__tests__/api/article-id-guard.test.ts`

- [ ] **Step 1: Enumerate the article-by-id routes**

Run: `ls pages/api/articles/[id]`
Expected: a list of `*.ts` handlers. Every one of them must get the guard in Step 2.

- [ ] **Step 2: Add the tenant guard to each article-by-id handler**

In each `pages/api/articles/[id]/*.ts`, add the imports (depth is four levels up from this folder):

```ts
import { getCurrentUserId } from '../../../../utils/getUser';
import { assertArticleAccess } from '../../../../lib/tenancy';
```

At the very start of the handler body (before any DB read/write, after any existing auth/method check), insert:

```ts
   const userId = await getCurrentUserId(req, res);
   const articleId = parseInt((req.query.id ?? req.query.articleId) as string, 10);
   if (!(await assertArticleAccess(userId, articleId))) {
      return res.status(403).json({ error: 'Access denied.' });
   }
```

(If the handler already resolves `userId`, reuse it instead of redeclaring. The public read-only share routes under `pages/api/share/` and `/drafts/s/<token>` are token-gated, not session-gated — do **not** add this guard there.)

- [ ] **Step 3: Guard keyword mutations in `pages/api/keywords.ts`**

Both the PUT and DELETE branches already load the first target keyword (`Keyword.findOne({ where: { ID: ... } })`). Add the import near the other imports:

```ts
import { verifyDomainOwnership } from '../../utils/verifyDomainOwnership';
```

Immediately after `firstKeyword` is loaded in each branch, insert:

```ts
      if (firstKeyword) {
         const owns = await verifyDomainOwnership(firstKeyword.domain, userId);
         if (owns === false || owns === null) return res.status(403).json({ error: 'Access denied.' });
      }
```

(① has single-member orgs, so a batch's keywords share the caller's accessible domains; guarding the batch's first keyword's domain is sufficient. Cross-domain batches are a ④ concern.)

- [ ] **Step 4: Write the representative route test**

Pick the GET route `pages/api/articles/[id]/index.ts`. Mock the guard and assert a denied request gets 403.

```ts
// __tests__/api/article-id-guard.test.ts
jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('intruder') }));
jest.mock('../../lib/tenancy', () => ({ assertArticleAccess: jest.fn().mockResolvedValue(false) }));
jest.mock('../../lib/ensureArticlesTables', () => ({ ensureArticlesTables: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn() } }));

import handler from '../../pages/api/articles/[id]/index';

const makeRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  return res;
};

it('denies access to an article the caller cannot reach', async () => {
  const res = makeRes();
  await handler({ method: 'GET', query: { id: '123' }, cookies: {} } as any, res);
  expect(res.status).toHaveBeenCalledWith(403);
});
```

- [ ] **Step 5: Run the test + typecheck**

Run: `npx jest __tests__/api/article-id-guard.test.ts --ci`
Expected: PASS (the guard short-circuits to 403 before any data is returned).
Then: `npx tsc --noEmit` → clean.

- [ ] **Step 6: Commit**

```bash
git add pages/api/articles/[id] pages/api/keywords.ts __tests__/api/article-id-guard.test.ts
git commit -m "feat(tenancy): guard article-by-id and keyword-mutation routes"
```

---

### Task 9: Bootstrap + owner env + final verification

Ensure the tenancy tables exist early, document the owner env, and run the full suite + graph update.

**Files:**
- Modify: `.env.example`
- (No code test — this task wires config and runs the full verification.)

- [ ] **Step 1: Document the owner env**

Append to `.env.example`:
```
# Neon Auth user id whose default workspace absorbs legacy (pre-tenancy) domains
# on first login. Leave empty to keep legacy domains unassigned (claim via admin tools).
TENANCY_OWNER_USER_ID=
```

- [ ] **Step 2: Confirm provisioning runs on first scoped access**

No code needed: `getAccessibleWorkspaceIds` and `assertArticleAccess` (Task 3) call `ensureUserTenancy`, which calls `ensureTenancyTables`. Every scoped route (Tasks 4-8) goes through one of these, so the tables, the `domain.workspace_id` column, the org/workspace/membership rows, and the domain claim are all created on the user's first domain/article request. Verify by reading `lib/tenancy.ts` and confirming `getAccessibleWorkspaceIds` → `ensureUserTenancy` → `ensureTenancyTables` is the call chain.

- [ ] **Step 3: Run the full test suite**

Run: `npx jest --ci`
Expected: all suites pass (the new tenancy suites — ensureTenancyTables, tenancy, verifyDomainOwnership, domains-scope, articles-scope, article-id-guard — plus the pre-existing tests).

- [ ] **Step 4: Typecheck + graph update**

```bash
npx tsc --noEmit
graphify update .
```
Expected: tsc clean; graph rebuilt.

- [ ] **Step 5: Commit**

```bash
git add .env.example
git commit -m "chore(tenancy): document TENANCY_OWNER_USER_ID owner env"
```

---

## Self-Review

**Spec coverage:**
- New tables + `domain.workspace_id` → Tasks 1, 2. ✅
- `ensureUserTenancy` (provision + own-domain claim + owner legacy claim) → Task 3. ✅
- `getAccessibleWorkspaceIds` / `getActiveWorkspaceId` (cookie validation + fallback) → Task 3. ✅
- Full isolation (Variant A), no shared legacy → Task 4 (filtered query) + Tasks 5-8. ✅
- Enforcement across domain/article routes → Task 4 (domain/keywords/audit/goal via helper) + Task 5 (domains) + Task 6 (articles list) + Task 7 (sites/insight/configure) + Task 8 (article-by-id + keyword mutations). ✅
- GSC stays per-user in ① → no GSC route touched. ✅
- Owner env `TENANCY_OWNER_USER_ID` → Task 9. ✅
- Dialect-agnostic, no `ON CONFLICT` → Task 3 uses transaction + select-then-insert. ✅
- Tests: idempotency, provisioning race, owner-claim, cookie rejection, cross-workspace denial, article-by-id denial → Tasks 1,3,4,5,6,8. ✅

**Review fixes folded in (pre-implementation):**
1. **Provisioning race** → Task 3 wraps the create in `db.transaction`; Task 1 adds `UNIQUE(organizations.owner_user_id)` as the serialization point; the loser rolls back and re-reads the winner (test: "falls back to the winner org … (race)").
2. **Ordering not asserted** → Task 3 test now asserts the actual SQL and that `organizations` → `workspaces` → `organization_members` inserts run in order.
3. **Single authorization point** → Task 4 pushes `workspace_id IN (…)` into the query `WHERE` (the unauthorized row is never loaded), keeping 404-vs-403 via a cheap existence check only on the miss path.
4. **Legacy-hidden-when-owner-unset** → intended (Variant A); Task 1 now logs a one-time warning when `TENANCY_OWNER_USER_ID` is unset.
5. **configure.ts adoption hole** → Task 7 guards on the `created` flag and rejects existing `NULL`/foreign-workspace domains.
6. **article-by-id / keyword-mutation gap** → now Task 8 (`assertArticleAccess` + `verifyDomainOwnership`).
7. **Missing owner index** → Task 1's `UNIQUE(owner_user_id)` doubles as the lookup index.
8. **Cookie validation** → Task 3 uses `Number.isInteger(id) && id > 0`.

**Placeholder scan:** No TBD/TODO; every code step shows complete code. Task 8 is an explicit uniform sweep (concrete transformation + discovery command + representative test), not hand-waving. ✅

**Type/name consistency:** `ensureUserTenancy`, `getAccessibleWorkspaceIds`, `getActiveWorkspaceId`, `assertArticleAccess`, `ensureTenancyTables`, `getUserDomainIds`, `workspace_id`, `active_workspace`, `TENANCY_OWNER_USER_ID` — used identically across all tasks. ✅
