# ④a — Invitations + accept flow Implementation Plan

> Phase a of sub-project ④ (members). Builds on ①②③. Branch: `feature/tenancy-foundation`. Faithful SurferSEO reproduction (CLAUDE.md §6 overrides any "bold redesign").

**Goal:** Invite people to the org by email, send a Surfer-style invitation email with an accept link, and let the invitee accept it on `/invite/[token]` (3 states: wrong-email, matching-email-accept, not-logged-in→login→back). Membership is created with the invited role + workspace access.

**Architecture:** `invitations` table holds pending invites (token, email, role, workspace_ids JSON, status, expiry). `getCurrentUser` exposes the session email so accept can match the logged-in user to the invited email. `lib/invitations.ts` does the org-scoped logic; thin API routes wrap it; `lib/sendMail.ts` (extracted from `pages/api/notify.ts`) sends the email. The `/invite/[token]` page uses `authClient` (better-auth) for the client session + sign-out.

**Conventions:** `cd /c/Users/patry/Desktop/serpbear && ...`; test `npx jest <path> --ci`; tsc clean. Tests mock DB/tenancy/sequelize LOCALLY. UI uses the project's existing Tailwind tokens (`bg-gray-base`, `px-lg`, `rounded-lg`, …) which match Surfer's — reproduce the provided markup 1:1, do NOT invent styling. Commit specific files; trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: Schema + `getCurrentUser` (email)

**Files:** Modify `lib/ensureTenancyTables.ts`, `utils/getUser.ts`; Test: extend `__tests__/lib/ensureTenancyTables.test.ts`.

- [ ] **Step 1 — extend the ensureTenancyTables test** — add to the existing assertions in `__tests__/lib/ensureTenancyTables.test.ts`:
```ts
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS invitations');
    expect(sql).toContain('ALTER TABLE organization_members ADD COLUMN workspace_ids');
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_token');
```
- [ ] **Step 2 — run → fail.** **Step 3 — implement** in `lib/ensureTenancyTables.ts`, before `tablesChecked = true;`, add:
```ts
   await db.query(`
      CREATE TABLE IF NOT EXISTS invitations (
         id            ${PK},
         org_id        INTEGER NOT NULL,
         email         TEXT NOT NULL,
         role          TEXT NOT NULL DEFAULT 'member',
         workspace_ids TEXT,                       -- JSON array of workspace ids; NULL = all
         token         TEXT NOT NULL,
         status        TEXT NOT NULL DEFAULT 'pending',  -- pending | accepted | revoked
         invited_by    TEXT,
         expires_at    TIMESTAMP,
         created_at    TIMESTAMP DEFAULT ${NOW}
      )
   `);
   // Per-workspace member access (JSON array of workspace ids; NULL = all workspaces in the org).
   try { await db.query('ALTER TABLE organization_members ADD COLUMN workspace_ids TEXT'); } catch { /* exists */ }
   try { await db.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token)'); } catch { /* noop */ }
   try { await db.query('CREATE INDEX IF NOT EXISTS idx_invitations_org ON invitations(org_id)'); } catch { /* noop */ }
   try { await db.query('CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email)'); } catch { /* noop */ }
```
- [ ] **Step 4 — refactor `utils/getUser.ts`** to cache the full user and expose email. Replace the file body with:
```ts
import type { NextApiRequest, NextApiResponse } from 'next';

const NEON_AUTH_BASE_URL = process.env.NEON_AUTH_BASE_URL!;
const SESSION_COOKIE = '__Secure-neon-auth.session_token';

export type SessionUser = { id: string; email: string | null };
const sessionCache = new WeakMap<NextApiRequest, Promise<SessionUser | null>>();

export const getCurrentUser = async (req: NextApiRequest, _res: NextApiResponse): Promise<SessionUser | null> => {
   const cached = sessionCache.get(req);
   if (cached) return cached;
   const promise = (async (): Promise<SessionUser | null> => {
      const sessionToken = req.cookies?.[SESSION_COOKIE];
      if (!sessionToken || !NEON_AUTH_BASE_URL) return null;
      try {
         const response = await fetch(`${NEON_AUTH_BASE_URL}/get-session`, {
            method: 'GET', headers: { cookie: `${SESSION_COOKIE}=${sessionToken}` },
         });
         if (!response.ok) return null;
         const data = await response.json() as { user?: { id?: string; email?: string } };
         if (!data?.user?.id) return null;
         return { id: data.user.id, email: data.user.email ?? null };
      } catch {
         return null;
      }
   })();
   sessionCache.set(req, promise);
   return promise;
};

export const getCurrentUserId = async (req: NextApiRequest, res: NextApiResponse): Promise<string | null> => {
   const u = await getCurrentUser(req, res);
   return u?.id ?? null;
};
```
- [ ] **Step 5 — run the ensureTenancyTables test → pass; tsc clean; commit** `lib/ensureTenancyTables.ts utils/getUser.ts __tests__/lib/ensureTenancyTables.test.ts` — `feat(members): invitations schema + session email`.

---

### Task 2: `lib/invitations.ts` + `lib/members.ts`

Org-scoped logic. Token = `crypto.randomBytes(24).toString('base64url')`. Role rank: owner>admin>member; only owner/admin manage.

**Files:** Create `lib/invitations.ts`, `lib/members.ts`; Tests `__tests__/lib/invitations.test.ts`, `__tests__/lib/members.test.ts`.

- [ ] **invitations.test.ts** (mock `database/database`, `lib/tenancy.ensureUserTenancy → {orgId:5}`, and `crypto`’s randomBytes is real). Cover: `createInvitation` inserts pending row with token+role+workspace_ids+expiry under the org; `getInvitationByToken` returns the row or null; `acceptInvitation` throws `INVITE_EMAIL_MISMATCH` when the session email ≠ invite email, throws `INVITE_NOT_PENDING` when status≠pending, and on success inserts an `organization_members` row (role + workspace_ids) and marks the invite `accepted`; `revokeInvitation` sets status=revoked scoped to the org.
- [ ] **lib/invitations.ts** (sketch — implement fully):
```ts
import crypto from 'crypto';
import db from '../database/database';
import { ensureUserTenancy } from './tenancy';

export type Invitation = { id: number; org_id: number; email: string; role: string; workspace_ids: string | null; token: string; status: string; expires_at: string | null };
type Row = Record<string, any>;
const select = async (sql: string, r: any[]): Promise<Row[]> => { const [rows] = await db.query(sql, { replacements: r }) as [Row[], unknown]; return rows; };

export async function createInvitation(userId: string, p: { email: string; role: string; workspaceIds: number[] | null }): Promise<Invitation> {
   const { orgId } = await ensureUserTenancy(userId);
   const token = crypto.randomBytes(24).toString('base64url');
   const role = ['admin', 'member'].includes(p.role) ? p.role : 'member';
   const ws = p.workspaceIds && p.workspaceIds.length ? JSON.stringify(p.workspaceIds) : null;
   // 7-day expiry; computed in JS and stored as ISO (node-pg/SQLite both accept it).
   const expires = new Date(Date.now() + 7 * 864e5).toISOString();
   await db.query('INSERT INTO invitations (org_id, email, role, workspace_ids, token, status, invited_by, expires_at) VALUES (?, ?, ?, ?, ?, \'pending\', ?, ?)',
      { replacements: [orgId, p.email.trim().toLowerCase(), role, ws, token, userId, expires] });
   const back = await select('SELECT * FROM invitations WHERE token = ? LIMIT 1', [token]);
   return back[0] as Invitation;
}

export async function getInvitationByToken(token: string): Promise<Invitation | null> {
   const rows = await select('SELECT * FROM invitations WHERE token = ? LIMIT 1', [token]);
   return (rows[0] as Invitation) || null;
}

export async function listInvitations(userId: string): Promise<Invitation[]> {
   const { orgId } = await ensureUserTenancy(userId);
   return await select("SELECT * FROM invitations WHERE org_id = ? AND status = 'pending' ORDER BY id DESC", [orgId]) as Invitation[];
}

export async function revokeInvitation(userId: string, id: number): Promise<void> {
   const { orgId } = await ensureUserTenancy(userId);
   await db.query("UPDATE invitations SET status = 'revoked' WHERE id = ? AND org_id = ?", { replacements: [id, orgId] });
}

/** Accepts: validates email match + pending status, creates membership, marks accepted. */
export async function acceptInvitation(sessionUserId: string, sessionEmail: string | null, token: string): Promise<void> {
   const inv = await getInvitationByToken(token);
   if (!inv || inv.status !== 'pending') throw new Error('INVITE_NOT_PENDING');
   if (!sessionEmail || sessionEmail.trim().toLowerCase() !== inv.email) throw new Error('INVITE_EMAIL_MISMATCH');
   // Idempotent membership: select-then-insert (UNIQUE(org_id,user_id) guards races).
   const existing = await select('SELECT id FROM organization_members WHERE org_id = ? AND user_id = ? LIMIT 1', [inv.org_id, sessionUserId]);
   if (!existing.length) {
      await db.query("INSERT INTO organization_members (org_id, user_id, role, status, workspace_ids) VALUES (?, ?, ?, 'active', ?)",
         { replacements: [inv.org_id, sessionUserId, inv.role, inv.workspace_ids] });
   }
   await db.query("UPDATE invitations SET status = 'accepted' WHERE id = ?", { replacements: [inv.id] });
}
```
- [ ] **members.test.ts** + **lib/members.ts**: `listMembers(userId)` → rows from `organization_members` for the org (id/user_id/role/status/workspace_ids); `getCallerRole(userId)` → the caller's role; `assertCanManage(userId)` → throws `FORBIDDEN` unless role ∈ {owner, admin}. (Member email/display is the user_id for now; resolving emails from Neon Auth is ④b.)
- [ ] tsc clean; commit each lib + its test — `feat(members): invitations + members helpers`.

---

### Task 3: `lib/sendMail.ts` + invitation email

**Files:** Create `lib/sendMail.ts` (extract the nodemailer transport from `pages/api/notify.ts` — read it first; build `sendMail({to, subject, html})` from the SMTP app settings; return `{ sent: boolean }`, never throw on missing SMTP — log + return `{sent:false}`). Add `lib/inviteEmail.ts` exporting `inviteEmailHtml({ orgName, role, acceptUrl, expiresAt })` returning the Surfer-style HTML ("You've been invited to {orgName}'s organization", a dark "Accept invitation" button linking `acceptUrl`, the raw URL fallback, "The link is valid until {date}."). Test `inviteEmailHtml` (pure) asserts it contains the acceptUrl + role. `acceptUrl = ${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`.

- [ ] tsc clean; commit — `feat(members): mail helper + invitation email template`.

---

### Task 4: API — invite/list/revoke + invitation info + accept

**Files:** Create `pages/api/members/index.ts` (GET list members+pending, POST invite), `pages/api/members/invitations/[id].ts` (DELETE revoke), `pages/api/invitations/[token]/index.ts` (GET public-ish info), `pages/api/invitations/[token]/accept.ts` (POST). Test `__tests__/api/invitations.test.ts` (mock getCurrentUser/getCurrentUserId, lib/members, lib/invitations, lib/sendMail).

- `members` GET → `{ members, invitations }` (via `listMembers` + `listInvitations`). POST `{ email, role, workspaceIds }` → `assertCanManage` (403 `FORBIDDEN`), `createInvitation`, then `sendMail(inviteEmailHtml(...))`; return `{ ok: true, sent }`. (401 if not authed.)
- `members/invitations/[id]` DELETE → `assertCanManage` + `revokeInvitation`.
- `invitations/[token]` GET → resolve via `getInvitationByToken`; return `{ status, email, role, orgName, workspaceCount }` (orgName from organizations.name; workspaceCount from workspace_ids length or total org workspaces when null). Does NOT require the caller to be a member (the invitee may not be yet) — but DO require an authenticated session (401 if none) so we can show the right state. Return `{ status: 'invalid' }` for unknown/expired tokens (do not leak details).
- `invitations/[token]/accept` POST → `getCurrentUser` (401 if none); `acceptInvitation(user.id, user.email, token)`; map `INVITE_EMAIL_MISMATCH`→409, `INVITE_NOT_PENDING`→410; 200 `{ ok: true }` on success.

Tests cover: POST invite by a member (403 FORBIDDEN), by an admin (201 + sendMail called), accept with mismatched email (409), accept success (200). tsc clean; commit the 4 routes + test — `feat(members): invitations + accept API`.

---

### Task 5: `/invite/[token]` page (3 Surfer states)

**Files:** Create `pages/invite/[token].tsx`. (tsc + manual smoke.)

Reproduce the provided Surfer markup 1:1 with the project's Tailwind tokens. Centered card on `bg-white-base`, Surfer logo at top. Logic:
1. Read `token` from `router.query`. Use `authClient` (better-auth, `import { authClient } from '../../lib/auth/client'`) — get the client session (`authClient.useSession()` or equivalent; check `lib/auth/client.ts` + existing usage in the codebase for the exact API). 
2. If NOT logged in → redirect to the app's login with a return path back to `/invite/${token}` (check how the rest of the app routes to login — reuse that; the token must survive the round-trip so the user lands back here after auth).
3. If logged in → `GET /api/invitations/${token}`:
   - `status === 'invalid'` / `revoked` / `accepted` (not by this user) → a neutral "This invitation is no longer valid" state with "‹ Go Back to the App".
   - session email ≠ invite email → the **wrong-email** state: text "This invitation was sent to a different email address. Sign out and sign in with the invited email to accept it.", "You are logged in as {email}", a **Sign out** button (`authClient.signOut()` then redirect to login), and "‹ Go Back to the App".
   - session email === invite email → the **accept** state: "You've been invited to join **a Surfer organization** as **{role}** with access to **{N} workspace}**", an **Accept invitation** button → `POST /api/invitations/${token}/accept` → on success `toast.success('Invitation accepted — you have been added to the organization')` then `router.push('/dashboard')`; "You are logged in as {email}", Sign out, Go Back.
4. Use the exact class strings from the provided Surfer markup where they map to existing project tokens; keep the dark primary button (`bg-gray-base text-white-base hover:bg-purple-base`), the light secondary (`bg-gray-10`), and the tertiary text-link styles.

- [ ] tsc clean; manual smoke; commit `pages/invite/[token].tsx` — `feat(members): invitation accept page`.

---

## Self-Review
- invite (email) → Task 3+4. accept page 3 states → Task 5. token round-trip through login → Task 5. ✅
- email↔user match on accept via session email → Task 1 (`getCurrentUser`) + Task 2 (`acceptInvitation` mismatch guard). ✅
- role + per-workspace access carried on the invite and written to membership → Tasks 2,4. (Enforcement of per-workspace access in scope queries = ④b.) ✅
- Admin+ gate on invite/revoke → Task 2 `assertCanManage` + Task 4. ✅
- Out of scope (this phase): People settings UI wiring, member removal + 404 screen, per-workspace scope enforcement (④b); @mentions + inbox (④c).
