# P3a — Create-workspace flow foundation Implementation Plan

> First slice of P3 (create-workspace wizard, option A: workspace created upfront → `/workspace/[id]/setup`). Branch: `feature/tenancy-foundation`. Backend scaffolding only — the wizard UI + the "finish" (attach domain/GSC/URL/brand + pipeline) endpoint are P3b.

**Goal:** A workspace can exist in a `setup` state (created empty, before a domain is attached). A dedicated endpoint creates one and returns its id (so the client can redirect to `/workspace/<id>/setup`). The workspace switcher shows only `ready` workspaces, so a half-finished setup workspace never clutters it.

**Architecture:** Add `workspaces.status` (`'ready'` default; existing rows stay ready). `lib/workspaces.ts` gains `createSetupWorkspace`, `markWorkspaceReady`, `getWorkspace`, and `listWorkspaces` is filtered to `ready`. A `POST /api/workspaces/setup` route creates the empty setup workspace. (The new-user redirect into the wizard is done separately by the controller in `pages/index.tsx`, which is intertwined with WIP.)

**Conventions:** TDD with mocked DB. `cd /c/Users/patry/Desktop/serpbear && ...`; `npx jest <path> --ci`; `npx tsc --noEmit` clean. Commit specific files; trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: `workspaces.status` + helpers + setup endpoint

**Files:** Modify `lib/ensureTenancyTables.ts`, `lib/workspaces.ts`; Create `pages/api/workspaces/setup.ts`; Tests: extend `__tests__/lib/workspaces.test.ts`, extend `__tests__/api/workspaces.test.ts`.

- [ ] **Step 1 — schema.** In `lib/ensureTenancyTables.ts`, before `tablesChecked = true;`, add:
```ts
   try { await db.query("ALTER TABLE workspaces ADD COLUMN status TEXT DEFAULT 'ready'"); } catch { /* exists */ }
```

- [ ] **Step 2 — helpers.** In `lib/workspaces.ts`:
  - Change `listWorkspaces` to return only ready workspaces: the SELECT becomes `SELECT id, name FROM workspaces WHERE org_id = ? AND status = 'ready' ORDER BY id ASC`.
  - Add:
```ts
/** Creates an empty workspace in the 'setup' state and returns its id. */
export async function createSetupWorkspace(userId: string): Promise<number> {
   const { orgId } = await ensureUserTenancy(userId);
   await db.query("INSERT INTO workspaces (org_id, name, status) VALUES (?, '', 'setup')", { replacements: [orgId] });
   const back = await select('SELECT id FROM workspaces WHERE org_id = ? ORDER BY id DESC LIMIT 1', [orgId]);
   return Number(back[0].id);
}

/** Returns a workspace (any status) if it belongs to the caller's org, else null. */
export async function getWorkspace(userId: string, wsId: number): Promise<(Workspace & { status: string }) | null> {
   const { orgId } = await ensureUserTenancy(userId);
   const rows = await select('SELECT id, name, status FROM workspaces WHERE id = ? AND org_id = ? LIMIT 1', [wsId, orgId]);
   if (!rows.length) return null;
   return { id: Number(rows[0].id), name: String(rows[0].name ?? ''), status: String(rows[0].status ?? 'ready') };
}

/** Names a setup workspace and flips it to 'ready'. */
export async function markWorkspaceReady(userId: string, wsId: number, name: string): Promise<void> {
   const { orgId } = await ensureUserTenancy(userId);
   await assertInOrg(orgId, wsId);
   const clean = (name || '').trim().slice(0, 60) || 'Untitled';
   await db.query("UPDATE workspaces SET name = ?, status = 'ready' WHERE id = ? AND org_id = ?", { replacements: [clean, wsId, orgId] });
}
```
  (`assertInOrg` already exists in the file.)

- [ ] **Step 3 — tests** (`__tests__/lib/workspaces.test.ts`): add cases —
  - `createSetupWorkspace` issues an INSERT with `'setup'` and returns the new id (mock INSERT + SELECT-back).
  - `listWorkspaces` SQL contains `status = 'ready'`.
  - `markWorkspaceReady` UPDATE sets `status = 'ready'` after the ownership SELECT.
  Follow the existing mocked-db pattern in that file.

- [ ] **Step 4 — setup route** `pages/api/workspaces/setup.ts`:
```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUserId } from '../../../utils/getUser';
import { createSetupWorkspace } from '../../../lib/workspaces';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const userId = await getCurrentUserId(req, res);
   if (!userId) return res.status(401).json({ error: 'Not authenticated' });
   if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
   const id = await createSetupWorkspace(userId);
   return res.status(201).json({ id });
}
```

- [ ] **Step 5 — route test** (`__tests__/api/workspaces.test.ts`): add a case mocking `getCurrentUserId` → 'u1' and `createSetupWorkspace` → 7; assert `POST` returns 201 `{ id: 7 }`. (Add `createSetupWorkspace: jest.fn()...` to the existing `jest.mock('../../lib/workspaces', ...)`.)

- [ ] **Step 6 — verify + commit:** `npx jest __tests__/lib/workspaces.test.ts __tests__/api/workspaces.test.ts --ci` (all pass) + `npx tsc --noEmit` (clean) + commit `lib/ensureTenancyTables.ts lib/workspaces.ts pages/api/workspaces/setup.ts __tests__/lib/workspaces.test.ts __tests__/api/workspaces.test.ts` — `feat(workspaces): setup-state workspaces + create-setup endpoint`.

---

## Controller-handled (not this task): new-user redirect
`pages/index.tsx` (intertwined with WIP) will be edited by the controller: when onboarding is complete (`GET /api/onboarding`) and the user has **0 ready workspaces**, `POST /api/workspaces/setup` then `router.replace('/workspace/<id>/setup')`. With ready workspaces → `/workspace/<firstId>/dashboard` (already in place). Kept out of the subagent task because it touches the user's uncommitted `index.tsx`.

## Out of scope (P3b): the wizard UI at `/workspace/[id]/setup` (GSC site / URL + location + name → brand knowledge), the `finish` endpoint that attaches the domain (reusing `configure.ts`) + runs the deep-analysis pipeline, and `markWorkspaceReady` wiring.

## Self-Review
- setup-state workspace + create endpoint → Task 1. ✅
- switcher hides setup workspaces (listWorkspaces filtered to ready) → Task 1 Step 2. ✅
- getWorkspace returns any status (the wizard reads its setup workspace) → Task 1. ✅
- existing workspaces unaffected (status defaults to 'ready') → Task 1 Step 1. ✅
- new-user redirect → controller (index.tsx). Wizard UI + finish/pipeline → P3b.
