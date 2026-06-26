# ④b — People per-workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Wire the People settings to real data: invite members with a Role + per-workspace access (Member → pick workspaces; Owner/Admin → all), a real members table (Role / Joined / Workspaces) with role-edit + remove, and a pending-invitations table. Enforcement reuses `member.workspace_ids` (already in `getAccessibleWorkspaceIds`).

**Architecture:** The invite/list/revoke/accept backend already exists (④a: `lib/members.ts`, `lib/invitations.ts`, `POST /api/members`, `DELETE /api/members/invitations/[id]`, accept routes). This adds the missing mutations (change role, remove member, edit workspace access), a member-identity (`email`) column, a caller-role signal, and replaces the static `PeopleSettings.tsx` mockup with wired UI.

**Tech Stack:** Next.js 12 pages-router + TS, Sequelize (Postgres/SQLite), react-query, jest. Branch `feature/tenancy-foundation`.

**Conventions:** `cd /c/Users/patry/Desktop/serpbear && ...`. TDD; mock DB; LOCAL `jest.mock('sequelize', ...)` per file. **No new TS `any`** (user preference) — precise types / `unknown`+narrowing. `db.query`; no `ON CONFLICT`. NEW UI = inline styles + `var(--font-family-primary)` (CLAUDE.md §6); `PeopleSettings.tsx` already uses inline styles — match it. Commit only listed files; trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## Member identity (decision)
`organization_members` stores `user_id` (Neon id), not email. Add an `email` column: written at `acceptInvitation` (the invite's email), and self-healed for the caller's own row in `GET /api/members` when blank (from `getCurrentUser(req).email`). This covers the owner (provisioned before this column) and every invited member, without a users table.

## Authorization model
- Only Owner/Admin manage people (`assertCanManage` throws `FORBIDDEN` for others) — already enforced in `POST /api/members`; apply to every new mutation.
- An Owner cannot be removed or demoted by an Admin; an Owner can't remove themselves if they're the last owner. Guard with `WORKSPACE`/`OWNER_LAST`-style errors.
- Role values: `owner | admin | member`. The UI shows `Member` → workspace multiselect; `Owner`/`Admin` → "All workspaces" (workspace_ids = NULL).

---

### Task 1 — Backend: identity, role/remove/access mutations, caller role

**Files:** Modify `lib/ensureTenancyTables.ts`, `lib/members.ts`, `lib/invitations.ts`, `pages/api/members/index.ts`; Create `pages/api/members/[id].ts`, `pages/api/members/[id]/workspaces.ts`; Tests: extend `__tests__/lib/members.test.ts`, add `__tests__/api/members-mutations.test.ts`.

- [ ] **Step 1 — schema.** In `lib/ensureTenancyTables.ts`, beside the other ALTERs (using the `ignoreExisting` helper already there):
  ```ts
  try { await db.query('ALTER TABLE organization_members ADD COLUMN email TEXT'); } catch (e) { ignoreExisting('add organization_members.email', e); }
  ```

- [ ] **Step 2 — `lib/members.ts` helpers.** Update `listMembers` to also select `email, created_at`. Add:
  ```ts
  /** Owner/Admin only. Changes a member's role. An Admin may NOT touch an Owner; nobody may demote the last owner. */
  export async function changeMemberRole(callerId: string, memberId: number, role: 'owner' | 'admin' | 'member'): Promise<void> {
     await assertCanManage(callerId);
     const { orgId } = await ensureUserTenancy(callerId);
     const callerRole = await getCallerRole(callerId);
     const rows = await select('SELECT role FROM organization_members WHERE id = ? AND org_id = ?', [memberId, orgId]);
     if (!rows.length) throw new Error('MEMBER_NOT_FOUND');
     if (rows[0].role === 'owner' && callerRole !== 'owner') throw new Error('FORBIDDEN');
     if (rows[0].role === 'owner' && role !== 'owner') {
        const owners = await select("SELECT COUNT(*) AS n FROM organization_members WHERE org_id = ? AND role = 'owner'", [orgId]);
        if (Number(owners[0].n) <= 1) throw new Error('OWNER_LAST');
     }
     await db.query('UPDATE organization_members SET role = ? WHERE id = ? AND org_id = ?', { replacements: [role, memberId, orgId] });
  }

  /** Owner/Admin only. Removes a member. Can't remove an Owner (unless caller is Owner and it's not the last owner). */
  export async function removeMember(callerId: string, memberId: number): Promise<void> {
     await assertCanManage(callerId);
     const { orgId } = await ensureUserTenancy(callerId);
     const callerRole = await getCallerRole(callerId);
     const rows = await select('SELECT role FROM organization_members WHERE id = ? AND org_id = ?', [memberId, orgId]);
     if (!rows.length) throw new Error('MEMBER_NOT_FOUND');
     if (rows[0].role === 'owner') {
        if (callerRole !== 'owner') throw new Error('FORBIDDEN');
        const owners = await select("SELECT COUNT(*) AS n FROM organization_members WHERE org_id = ? AND role = 'owner'", [orgId]);
        if (Number(owners[0].n) <= 1) throw new Error('OWNER_LAST');
     }
     await db.query('DELETE FROM organization_members WHERE id = ? AND org_id = ?', { replacements: [memberId, orgId] });
  }

  /** Owner/Admin only. Sets a member's per-workspace access (NULL = all). */
  export async function setMemberWorkspaces(callerId: string, memberId: number, workspaceIds: number[] | null): Promise<void> {
     await assertCanManage(callerId);
     const { orgId } = await ensureUserTenancy(callerId);
     const json = workspaceIds && workspaceIds.length ? JSON.stringify(workspaceIds) : null;
     await db.query('UPDATE organization_members SET workspace_ids = ? WHERE id = ? AND org_id = ?', { replacements: [json, memberId, orgId] });
  }
  ```
  (Confirm `select`, `ensureUserTenancy`, `getCallerRole`, `assertCanManage`, `db` are already imported/defined in `lib/members.ts`; reuse them.)
  Tests (`__tests__/lib/members.test.ts`): role change happy path issues the UPDATE; admin-touching-owner throws FORBIDDEN; demoting last owner throws OWNER_LAST; removeMember deletes; removing last owner throws OWNER_LAST; setMemberWorkspaces writes JSON / NULL.

- [ ] **Step 3 — `acceptInvitation` writes email.** In `lib/invitations.ts` `acceptInvitation(sessionUserId, sessionEmail, token)`, when inserting/activating the membership, set `email = sessionEmail`. (Read the function; add `email` to its INSERT/UPDATE of `organization_members`.) Test: accept inserts the member row with the session email.

- [ ] **Step 4 — `GET /api/members` adds caller role + self-heal email.** In `pages/api/members/index.ts` GET: after fetching members, (a) if the caller's own member row has a blank `email`, `UPDATE organization_members SET email = ? WHERE org_id=? AND user_id=?` with `getCurrentUser(req).email`; (b) include `role: await getCallerRole(userId)` in the response so the UI can gate. New response: `{ members, invitations, role }`.

- [ ] **Step 5 — `PATCH/DELETE /api/members/[id]`** (`pages/api/members/[id].ts`):
  ```ts
  import type { NextApiRequest, NextApiResponse } from 'next';
  import { getCurrentUserId } from '../../../utils/getUser';
  import { changeMemberRole, removeMember } from '../../../lib/members';

  export default async function handler(req: NextApiRequest, res: NextApiResponse) {
     const userId = await getCurrentUserId(req, res);
     if (!userId) return res.status(401).json({ error: 'Not authenticated' });
     const id = Number(req.query.id);
     if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
     try {
        if (req.method === 'PATCH') {
           const role = (req.body || {}).role;
           if (!['owner', 'admin', 'member'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
           await changeMemberRole(userId, id, role);
           return res.status(200).json({ ok: true });
        }
        if (req.method === 'DELETE') {
           await removeMember(userId, id);
           return res.status(200).json({ ok: true });
        }
        res.setHeader('Allow', 'PATCH, DELETE');
        return res.status(405).json({ error: 'Method not allowed' });
     } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        if (m === 'FORBIDDEN') return res.status(403).json({ error: 'Not allowed' });
        if (m === 'MEMBER_NOT_FOUND') return res.status(404).json({ error: 'Not found' });
        if (m === 'OWNER_LAST') return res.status(409).json({ error: 'You must keep at least one owner' });
        throw e;
     }
  }
  ```
  (Verify import depth `../../../` against `pages/api/members/invitations/[id].ts`.)

- [ ] **Step 6 — `PATCH /api/members/[id]/workspaces.ts`**: same auth + error mapping; body `{ workspaceIds: number[] | null }` → `setMemberWorkspaces(userId, id, workspaceIds)` → 200.

- [ ] **Step 7 — tests** (`__tests__/api/members-mutations.test.ts`): mock the lib fns; PATCH valid role → 200; invalid role → 400; FORBIDDEN → 403; OWNER_LAST → 409; DELETE → 200; 401 unauth; 405 other method.

- [ ] **Step 8 — verify + commit.** `npx jest __tests__/lib/members.test.ts __tests__/api/members-mutations.test.ts --ci` PASS; `npx tsc --noEmit` clean. Commit the Task-1 files — `feat(people): member email + role/remove/workspace-access mutations + caller role`.

---

### Task 2 — Frontend: wire PeopleSettings + role gating

**Files:** Create `services/people.tsx`; Modify `components/settings/PeopleSettings.tsx`. (Reuse `useWorkspaces` from `services/workspaces.tsx`, `Modal` + `SelectField` from `components/common/`.)

- [ ] **Step 1 — `services/people.tsx`:** `usePeople()` (GET `/api/members` → `{ members, invitations, role }`, query key `'people'`); `useInviteMember()` (POST `/api/members` `{ email, role, workspaceIds }`, invalidate `'people'`); `useChangeRole()` (PATCH `/api/members/${id}` `{ role }`); `useRemoveMember()` (DELETE `/api/members/${id}`); `useRevokeInvitation()` (DELETE `/api/members/invitations/${id}`); `useSetMemberWorkspaces()` (PATCH `/api/members/${id}/workspaces`). Each mutation invalidates `'people'`. Use precise types for the member/invitation shapes (`{ id; email; role; status; workspace_ids: string | null; created_at }`).

- [ ] **Step 2 — wire `PeopleSettings.tsx`:** replace `STATIC_MEMBER`/`STATIC_PENDING` with `usePeople()` data.
  - **Invite form:** email input + role `SelectField` + **workspace multiselect** (from `useWorkspaces`) shown ONLY when role === 'Member' (Owner/Admin → render a disabled "All workspaces" + send `workspaceIds: null`). Send → `useInviteMember`; toast on success/error; clear inputs.
  - **Members table:** rows from `members` — avatar (first letter of email), email, role (a `SelectField`/dropdown that calls `useChangeRole` when role is editable), Joined (`created_at` formatted), Workspaces (Owner/Admin → "All"; Member → names resolved from `useWorkspaces` by id, or "All" when `workspace_ids` null), and a "…"/trash action → `useRemoveMember` behind a confirm.
  - **Pending invitations table:** rows from `invitations` — email, role, expires (`expires_at`), workspace count, Revoke → `useRevokeInvitation`.
  - **Role gating:** if `role` (caller) is not `owner`/`admin`, render the tables READ-ONLY (no invite form, no edit/remove controls) — or a "You don't have access to manage people" note. Owner rows show no remove/demote control for non-owner callers.
  - Map backend error messages to friendly toasts (FORBIDDEN → "Not allowed", OWNER_LAST → "You must keep at least one owner").

- [ ] **Step 3 — "no access" screen (removed / lost-access member).** When a signed-in user has ZERO accessible workspaces (removed, or a Member whose workspaces were all revoked), the app should show a clear "You don't have access to any workspace — contact your admin" screen instead of a broken dashboard. Implement minimally: in `pages/index.tsx`, the existing redirect already routes 0-ready-workspace users; extend it so that a user who IS onboarded AND is a Member (not owner) with 0 accessible workspaces lands on a small static `/no-access` page (new `pages/no-access.tsx`) rather than the workspace creator. (Owners/Admins always have access.) Keep this minimal.

- [ ] **Step 4 — verify + commit.** `npx tsc --noEmit` clean. Reason through: invite Member with 2 workspaces → appears in pending; accept → appears in members with those workspaces; change role to Admin → workspaces become "All"; remove → row gone. Commit `services/people.tsx components/settings/PeopleSettings.tsx pages/no-access.tsx pages/index.tsx` — `feat(people): wire People settings (members table, invite w/ workspaces, role edit, remove)`.

---

## Self-Review
- Invite with Role + per-workspace multiselect (Member) / All (Owner/Admin) → T2 Step 2. ✅
- Members table Role/Joined/Workspaces + role edit + remove → T1 (mutations) + T2 Step 2. ✅
- Pending invitations + revoke → existing API + T2. ✅
- Enforcement via `member.workspace_ids` → already in `getAccessibleWorkspaceIds`; mutations write it (T1 Step 2/6). ✅
- Member identity (email) → T1 Steps 1/3/4. ✅
- Caller-role gating → T1 Step 4 + T2 Step 2. ✅
- Removed/lost-access "no access" screen → T2 Step 3. ✅
- Owner-protection invariants (last owner, admin-can't-touch-owner) → T1 Step 2.
- No new `any`; reuse existing UI components.
