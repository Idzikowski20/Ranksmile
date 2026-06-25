# ① Tenancy Foundation — Design

**Status:** approved (brainstorming) — pending plan
**Date:** 2026-06-25
**Parent feature:** Workspace/Organization (SurferSEO-style multi-tenancy), decomposed into 4 sub-projects. This spec covers **only sub-project ① (Foundation)**.

## Goal

Introduce the data backbone for SurferSEO-style multi-tenancy — Organizations, Workspaces, and Organization Members — and isolate domain/article data per workspace. **No UI.** After ①, the app behaves exactly as today for the end user, but every user's data is scoped to their own organization's workspace instead of being globally shared.

## Why now / context

- Auth is Neon Auth: a session cookie resolves to an opaque `user_id` string (`utils/getUser.ts`, `getCurrentUserId`).
- The `domain` table (Sequelize model `database/models/domain.ts`) already has a `userId` column (`NULL` = legacy/shared). `GET /api/domains` currently returns `{ userId } OR { userId: NULL }`, so every user sees their own domains **plus all legacy domains**. ~18–32 API routes reference domain/user scoping.
- `articles` (and `article_*` tables) hang off `domain_id`; they have no `userId` of their own — tenancy is derived through the domain.
- Per-user data already exists for `user_onboarding` and `content_settings` (keyed by `user_id`, raw SQL via `ensureArticlesTables` / `lib/contentSettings.ts`).
- There is no `organizations` / `workspaces` / `members` concept yet.

## Target hierarchy (matches SurferSEO)

```
Organization (tenant: name, logo, members, billing)
  └── Workspace (container: name)
        └── Domain (gains workspace_id)
              └── Article (tenancy via domain_id)
```

Members belong to an **organization** with a role (owner/admin/member) and have access to all or specific **workspaces**. (Roles/invites/multi-workspace access are sub-projects ③④; ① creates exactly one org, one "Default" workspace, and one `owner` member per user.)

## Decisions (locked during brainstorming)

- **Isolation level: full (Variant A).** Domains with `userId` → that user's default workspace. Legacy domains (`userId IS NULL`) → the configured owner's default workspace. No more globally shared domains.
- **Scope by *active* workspace** (not by all accessible workspaces). In ① there is exactly one workspace per user, so active == default.
- **GSC accounts stay per-`userId`** in ① (personal OAuth integration; org/workspace-level integrations are a later sub-project, consistent with Surfer's "Integrations" settings section).
- **Owner identification for the legacy claim:** `process.env.TENANCY_OWNER_USER_ID` (the Neon Auth user id). Migration-only plumbing — Surfer has no "legacy" concept. If unset, legacy domains stay unassigned and can be claimed via the existing `pages/api/admin/claim-domains.ts`.

## Architecture

### New module: `lib/ensureTenancyTables.ts`

Raw SQL, dialect-aware (mirrors `lib/ensureArticlesTables.ts`: `isPostgres = !!process.env.DATABASE_URL`, `PK = isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'`, `NOW_DEFAULT = 'CURRENT_TIMESTAMP'`). Idempotent, guarded by a module-level `tablesChecked` flag.

```sql
CREATE TABLE IF NOT EXISTS organizations (
   id            <PK>,
   owner_user_id TEXT NOT NULL,
   name          TEXT,
   logo_url      TEXT,
   created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
   updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workspaces (
   id         <PK>,
   org_id     INTEGER NOT NULL,
   name       TEXT NOT NULL DEFAULT 'Default',
   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS organization_members (
   id         <PK>,
   org_id     INTEGER NOT NULL,
   user_id    TEXT NOT NULL,
   role       TEXT NOT NULL DEFAULT 'owner',
   status     TEXT NOT NULL DEFAULT 'active',
   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Indexes / constraints:
- `CREATE UNIQUE INDEX IF NOT EXISTS idx_org_members_unique ON organization_members(org_id, user_id)`
- `CREATE INDEX IF NOT EXISTS idx_workspaces_org ON workspaces(org_id)`
- `CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id)`
- `CREATE INDEX IF NOT EXISTS idx_domain_workspace ON domain(workspace_id)`

`domain.workspace_id`:
- Add `workspace_id` column to the Sequelize model `database/models/domain.ts` (`INTEGER`, `allowNull: true`, default `null`).
- Also add it via idempotent `ALTER TABLE domain ADD COLUMN workspace_id INTEGER` wrapped in try/catch inside `ensureTenancyTables` (so existing DBs get the column regardless of Sequelize sync behaviour).

### New module: `lib/tenancy.ts`

All functions call `ensureTenancyTables()` first. SQL uses raw `db.query(sql, { replacements: [...] })` with `?` placeholders and dialect-agnostic upserts (select-then-insert, **no `ON CONFLICT`** — same pattern as `pages/api/onboarding.ts`).

**`ensureUserTenancy(userId: string): Promise<{ orgId: number; defaultWorkspaceId: number }>`** — idempotent provisioning:
1. Look up an active membership for `userId`. If found, return its `org_id` + that org's default workspace (lowest `workspaces.id` for the org).
2. Otherwise create, in order: `organizations` (owner_user_id = userId, name = `'My organization'`), `workspaces` (org_id, name `'Default'`), `organization_members` (org_id, userId, role `'owner'`, status `'active'`).
3. Claim the user's own domains: `UPDATE domain SET workspace_id = ? WHERE userId = ? AND workspace_id IS NULL`.
4. Owner legacy claim: if `userId === process.env.TENANCY_OWNER_USER_ID`, also `UPDATE domain SET workspace_id = ? WHERE userId IS NULL AND workspace_id IS NULL`.
5. Return `{ orgId, defaultWorkspaceId }`.

Concurrency: a first-request race is bounded by `UNIQUE(org_id, user_id)`; on insert conflict, re-read the existing membership and return it.

**`getAccessibleWorkspaceIds(userId: string): Promise<number[]>`** — workspace ids in every org where the user is an `active` member. Calls `ensureUserTenancy` first so the set is never empty for an authenticated user. In ① this returns a single id.

**`getActiveWorkspaceId(req, userId: string): Promise<number>`**:
1. `{ defaultWorkspaceId }` = `ensureUserTenancy(userId)`.
2. If the `active_workspace` cookie is present and its value is in `getAccessibleWorkspaceIds(userId)`, return it; otherwise return `defaultWorkspaceId`. (The cookie is written by the workspace switcher in ③; ① only reads it, with a safe fallback, and never trusts a foreign id.)

### Enforcement across API routes

Rule: **a domain is accessible iff its `workspace_id` ∈ `getAccessibleWorkspaceIds(userId)`**; articles and keywords inherit tenancy through `domain_id` / domain name.

- `GET /api/domains` (`getDomains`): replace the `{ [Op.or]: [{ userId }, { userId: null }] }` filter with `{ workspace_id: activeWorkspaceId }`.
- `addDomain`: set `workspace_id = activeWorkspaceId` (keep `userId = creator`).
- `deleteDomain` / `pages/api/domains/configure.ts` / `pages/api/domains/goal.ts` / `pages/api/domain.ts`: verify the target domain's `workspace_id` ∈ accessible before mutating; otherwise 403.
- Articles list (`pages/api/articles/index.ts`) and per-article routes (`pages/api/articles/[id]/*`): resolve the article's `domain_id` → domain `workspace_id`; enforce membership; list is scoped to domains in the active workspace.
- `pages/api/keywords.ts`, `pages/api/audit.ts`, `pages/api/insight.ts`, `pages/api/sites.ts`, `pages/api/searchconsole.ts`: scope through the owning domain.
- `pages/api/gsc/*`: unchanged in ① (stay per-`userId`).

The implementation plan (writing-plans phase) will enumerate every affected route file with its exact before/after filter. Unauthenticated requests (`userId === null`) keep returning 401 as today.

## Non-goals (deferred to ②③④)

No settings UI, no org name/logo editing, no workspace switcher, no create/rename/delete workspace, no members list / invitations / email, no role enforcement beyond "is an active member". Each user gets one org (default name), one `Default` workspace, one `owner` membership.

## Error handling & edge cases

- Unauthenticated → 401 (unchanged).
- `active_workspace` cookie pointing at a workspace the user can't access → silently fall back to the default workspace (no error, no leak).
- Provisioning race on first concurrent requests → `UNIQUE(org_id, user_id)` + re-read on conflict.
- `TENANCY_OWNER_USER_ID` unset → legacy domains remain `workspace_id IS NULL` and invisible in the new model; recoverable via `admin/claim-domains`. Log a one-time warning.
- Both dialects: every `CREATE`/`ALTER` is `IF NOT EXISTS` / try-catch guarded so re-runs are safe on Postgres (Neon) and SQLite.

## Testing

- **Unit:** `ensureUserTenancy` idempotency (second call returns same ids, creates nothing); owner legacy-claim only fires for the configured owner; `getActiveWorkspaceId` returns default when cookie absent and rejects a non-accessible cookie value; `getAccessibleWorkspaceIds` returns exactly the user's workspaces.
- **Integration:** user A cannot read or mutate user B's domains/articles; a freshly added domain receives the active `workspace_id`; legacy (`userId NULL`) domains land in the owner's workspace after the owner's first authenticated request; non-owner users do not absorb legacy domains.
- **Migration safety:** running `ensureTenancyTables` twice is a no-op on both Postgres and SQLite; the `domain.workspace_id` ALTER is idempotent.

## Success criteria

1. New tenancy tables + `domain.workspace_id` exist on Postgres and SQLite.
2. Every authenticated user is auto-provisioned exactly one org / `Default` workspace / `owner` membership (idempotent).
3. Domain and article reads/writes are scoped to the caller's active workspace; cross-user access is impossible.
4. Existing per-user domains and (for the configured owner) legacy domains are migrated into the correct workspace with no data loss.
5. No visible change in app behaviour for a single user; `tsc --noEmit` clean.
