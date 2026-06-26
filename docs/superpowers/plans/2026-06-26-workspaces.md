# Workspaces — management + switcher (③) Implementation Plan

> Sub-project ③ of the workspace/org feature. Builds on ① (tenancy) + ② (org profile). Branch: `feature/tenancy-foundation`.

**Goal:** Make the topbar `WorkspaceSwitcher` real: list the org's workspaces, switch the active one (sets the `active_workspace` cookie that ① already reads), and create / rename / delete workspaces (delete blocked when the workspace is non-empty or the org's last one).

**Architecture:** `lib/workspaces.ts` resolves the caller's org via `ensureUserTenancy` and does all CRUD scoped to `org_id` (every mutation re-verifies the target workspace belongs to that org). Three thin API routes wrap it. Switching is a POST that validates membership then sets the `active_workspace` cookie; the client reloads so server-side scoping (①) re-runs. The active id is returned by the list endpoint (via `getActiveWorkspaceId`) so the client needn't read cookies.

**Conventions:** `cd /c/Users/patry/Desktop/serpbear && ...` prefix. Test `npx jest <path> --ci`; tsc must be clean. Tests mock DB/tenancy/sequelize LOCALLY (never a root `__mocks__/sequelize.ts`, never touch jest.config). UI = inline styles, wiring only (component already styled). Commit specific files; trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: `lib/workspaces.ts` CRUD helpers

**Files:** Create `lib/workspaces.ts`; Test `__tests__/lib/workspaces.test.ts`.

- [ ] **Step 1 — failing test** (`__tests__/lib/workspaces.test.ts`):
```ts
jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('../../lib/tenancy', () => ({ ensureUserTenancy: jest.fn().mockResolvedValue({ orgId: 5, defaultWorkspaceId: 9 }) }));

import db from '../../database/database';
import { listWorkspaces, createWorkspace, renameWorkspace, deleteWorkspace } from '../../lib/workspaces';

const mockQuery = db.query as jest.Mock;
const rows = (r: unknown[]) => [r, {}];

describe('workspaces helpers', () => {
  beforeEach(() => mockQuery.mockReset());

  it('listWorkspaces returns the org workspaces', async () => {
    mockQuery.mockResolvedValueOnce(rows([{ id: 9, name: 'Default' }, { id: 10, name: 'Blog' }]));
    expect(await listWorkspaces('u1')).toEqual([{ id: 9, name: 'Default' }, { id: 10, name: 'Blog' }]);
    expect(String(mockQuery.mock.calls[0][0])).toContain('FROM workspaces WHERE org_id = ?');
  });

  it('createWorkspace inserts under the org and returns the new row', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([]))                          // INSERT
      .mockResolvedValueOnce(rows([{ id: 11, name: 'New' }]));  // SELECT back
    expect(await createWorkspace('u1', 'New')).toEqual({ id: 11, name: 'New' });
    expect(String(mockQuery.mock.calls[0][0])).toContain('INSERT INTO workspaces');
  });

  it('renameWorkspace updates only when the workspace is in the org', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([{ id: 10 }]))   // ownership SELECT
      .mockResolvedValueOnce(rows([]));            // UPDATE
    await renameWorkspace('u1', 10, 'Renamed');
    expect(String(mockQuery.mock.calls[1][0])).toContain('UPDATE workspaces SET name = ?');
  });

  it('renameWorkspace throws WORKSPACE_NOT_FOUND when not in the org', async () => {
    mockQuery.mockResolvedValueOnce(rows([]));     // ownership SELECT -> none
    await expect(renameWorkspace('u1', 99, 'X')).rejects.toThrow('WORKSPACE_NOT_FOUND');
  });

  it('deleteWorkspace blocks deleting a non-empty workspace', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([{ id: 10 }]))   // ownership
      .mockResolvedValueOnce(rows([{ n: 3 }]))     // workspace count in org (>1)
      .mockResolvedValueOnce(rows([{ n: 2 }]));    // domain count (>0) -> block
    await expect(deleteWorkspace('u1', 10)).rejects.toThrow('WORKSPACE_NOT_EMPTY');
  });

  it('deleteWorkspace blocks deleting the last workspace', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([{ id: 9 }]))    // ownership
      .mockResolvedValueOnce(rows([{ n: 1 }]));    // only one workspace -> block
    await expect(deleteWorkspace('u1', 9)).rejects.toThrow('WORKSPACE_LAST');
  });

  it('deleteWorkspace deletes an empty non-last workspace', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([{ id: 10 }]))   // ownership
      .mockResolvedValueOnce(rows([{ n: 2 }]))     // workspace count >1
      .mockResolvedValueOnce(rows([{ n: 0 }]))     // domain count 0
      .mockResolvedValueOnce(rows([]));            // DELETE
    await deleteWorkspace('u1', 10);
    expect(String(mockQuery.mock.calls[3][0])).toContain('DELETE FROM workspaces');
  });
});
```

- [ ] **Step 2 — run → fail.** **Step 3 — implement** `lib/workspaces.ts`:
```ts
import db from '../database/database';
import { ensureUserTenancy } from './tenancy';

export type Workspace = { id: number; name: string };
type Row = Record<string, any>;
async function select(sql: string, replacements: any[]): Promise<Row[]> {
   const [rows] = await db.query(sql, { replacements }) as [Row[], unknown];
   return rows;
}

/** Throws WORKSPACE_NOT_FOUND if the workspace doesn't belong to the user's org. */
async function assertInOrg(orgId: number, wsId: number): Promise<void> {
   const found = await select('SELECT id FROM workspaces WHERE id = ? AND org_id = ? LIMIT 1', [wsId, orgId]);
   if (!found.length) throw new Error('WORKSPACE_NOT_FOUND');
}

export async function listWorkspaces(userId: string): Promise<Workspace[]> {
   const { orgId } = await ensureUserTenancy(userId);
   const rows = await select('SELECT id, name FROM workspaces WHERE org_id = ? ORDER BY id ASC', [orgId]);
   return rows.map((r) => ({ id: Number(r.id), name: String(r.name ?? '') }));
}

export async function createWorkspace(userId: string, name: string): Promise<Workspace> {
   const { orgId } = await ensureUserTenancy(userId);
   const clean = (name || '').trim().slice(0, 60) || 'Untitled';
   await db.query('INSERT INTO workspaces (org_id, name) VALUES (?, ?)', { replacements: [orgId, clean] });
   const back = await select('SELECT id, name FROM workspaces WHERE org_id = ? ORDER BY id DESC LIMIT 1', [orgId]);
   return { id: Number(back[0].id), name: String(back[0].name) };
}

export async function renameWorkspace(userId: string, wsId: number, name: string): Promise<void> {
   const { orgId } = await ensureUserTenancy(userId);
   await assertInOrg(orgId, wsId);
   const clean = (name || '').trim().slice(0, 60) || 'Untitled';
   await db.query('UPDATE workspaces SET name = ? WHERE id = ? AND org_id = ?', { replacements: [clean, wsId, orgId] });
}

/** Throws WORKSPACE_NOT_FOUND / WORKSPACE_LAST / WORKSPACE_NOT_EMPTY. */
export async function deleteWorkspace(userId: string, wsId: number): Promise<void> {
   const { orgId } = await ensureUserTenancy(userId);
   await assertInOrg(orgId, wsId);
   const [{ n: wsCount }] = await select('SELECT COUNT(*) AS n FROM workspaces WHERE org_id = ?', [orgId]) as Array<{ n: number }>;
   if (Number(wsCount) <= 1) throw new Error('WORKSPACE_LAST');
   const [{ n: domCount }] = await select('SELECT COUNT(*) AS n FROM domain WHERE workspace_id = ?', [wsId]) as Array<{ n: number }>;
   if (Number(domCount) > 0) throw new Error('WORKSPACE_NOT_EMPTY');
   await db.query('DELETE FROM workspaces WHERE id = ? AND org_id = ?', { replacements: [wsId, orgId] });
}
```
- [ ] **Step 4 — run → pass (7/7).** **Step 5 — tsc clean; commit** `lib/workspaces.ts __tests__/lib/workspaces.test.ts` — `feat(workspaces): org-scoped CRUD helpers`.

---

### Task 2: API routes — list/create, rename/delete, set-active

**Files:** Create `pages/api/workspaces/index.ts`, `pages/api/workspaces/[id].ts`, `pages/api/workspaces/active.ts`; Test `__tests__/api/workspaces.test.ts`.

- [ ] **Step 1 — failing test** (`__tests__/api/workspaces.test.ts`):
```ts
jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('u1') }));
jest.mock('../../lib/tenancy', () => ({
  getActiveWorkspaceId: jest.fn().mockResolvedValue(9),
  getAccessibleWorkspaceIds: jest.fn().mockResolvedValue([9, 10]),
}));
jest.mock('../../lib/workspaces', () => ({
  listWorkspaces: jest.fn().mockResolvedValue([{ id: 9, name: 'Default' }]),
  createWorkspace: jest.fn().mockResolvedValue({ id: 11, name: 'New' }),
  renameWorkspace: jest.fn().mockResolvedValue(undefined),
  deleteWorkspace: jest.fn().mockResolvedValue(undefined),
}));

import listHandler from '../../pages/api/workspaces/index';
import idHandler from '../../pages/api/workspaces/[id]';
import activeHandler from '../../pages/api/workspaces/active';
import { deleteWorkspace } from '../../lib/workspaces';

const makeRes = () => { const r: any = {}; r.status = jest.fn().mockReturnValue(r); r.json = jest.fn().mockReturnValue(r); r.setHeader = jest.fn(); return r; };

describe('/api/workspaces', () => {
  it('GET returns workspaces + activeId', async () => {
    const res = makeRes();
    await listHandler({ method: 'GET', cookies: {} } as any, res);
    expect(res.json).toHaveBeenCalledWith({ workspaces: [{ id: 9, name: 'Default' }], activeId: 9 });
  });
  it('POST creates a workspace', async () => {
    const res = makeRes();
    await listHandler({ method: 'POST', cookies: {}, body: { name: 'New' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ id: 11, name: 'New' });
  });
  it('DELETE maps WORKSPACE_NOT_EMPTY to 409', async () => {
    (deleteWorkspace as jest.Mock).mockRejectedValueOnce(new Error('WORKSPACE_NOT_EMPTY'));
    const res = makeRes();
    await idHandler({ method: 'DELETE', cookies: {}, query: { id: '10' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });
  it('active POST sets the cookie when the workspace is accessible', async () => {
    const res = makeRes();
    await activeHandler({ method: 'POST', cookies: {}, body: { id: 10 } } as any, res);
    expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', expect.stringContaining('active_workspace=10'));
    expect(res.status).toHaveBeenCalledWith(200);
  });
  it('active POST rejects a non-accessible workspace with 403', async () => {
    const res = makeRes();
    await activeHandler({ method: 'POST', cookies: {}, body: { id: 999 } } as any, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
```

- [ ] **Step 2 — run → fail.** **Step 3 — implement** the three routes:

`pages/api/workspaces/index.ts`:
```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUserId } from '../../../utils/getUser';
import { getActiveWorkspaceId } from '../../../lib/tenancy';
import { listWorkspaces, createWorkspace } from '../../../lib/workspaces';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const userId = await getCurrentUserId(req, res);
   if (!userId) return res.status(401).json({ error: 'Not authenticated' });

   if (req.method === 'GET') {
      const [workspaces, activeId] = await Promise.all([listWorkspaces(userId), getActiveWorkspaceId(req, userId)]);
      return res.status(200).json({ workspaces, activeId });
   }
   if (req.method === 'POST') {
      const name = String(req.body?.name ?? '').trim();
      if (!name) return res.status(400).json({ error: 'Name is required' });
      return res.status(201).json(await createWorkspace(userId, name));
   }
   res.setHeader('Allow', 'GET, POST');
   return res.status(405).json({ error: 'Method not allowed' });
}
```

`pages/api/workspaces/[id].ts`:
```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUserId } from '../../../utils/getUser';
import { renameWorkspace, deleteWorkspace } from '../../../lib/workspaces';

const ERR_STATUS: Record<string, number> = {
   WORKSPACE_NOT_FOUND: 404,
   WORKSPACE_LAST: 409,
   WORKSPACE_NOT_EMPTY: 409,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const userId = await getCurrentUserId(req, res);
   if (!userId) return res.status(401).json({ error: 'Not authenticated' });
   const wsId = parseInt(req.query.id as string, 10);
   if (!Number.isInteger(wsId)) return res.status(400).json({ error: 'Bad workspace id' });

   try {
      if (req.method === 'PATCH') {
         const name = String(req.body?.name ?? '').trim();
         if (!name) return res.status(400).json({ error: 'Name is required' });
         await renameWorkspace(userId, wsId, name);
         return res.status(200).json({ id: wsId, name });
      }
      if (req.method === 'DELETE') {
         await deleteWorkspace(userId, wsId);
         return res.status(200).json({ deleted: wsId });
      }
      res.setHeader('Allow', 'PATCH, DELETE');
      return res.status(405).json({ error: 'Method not allowed' });
   } catch (e: any) {
      const code = ERR_STATUS[e?.message] || 500;
      return res.status(code).json({ error: e?.message || 'Error' });
   }
}
```

`pages/api/workspaces/active.ts`:
```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUserId } from '../../../utils/getUser';
import { getAccessibleWorkspaceIds } from '../../../lib/tenancy';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const userId = await getCurrentUserId(req, res);
   if (!userId) return res.status(401).json({ error: 'Not authenticated' });
   if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }

   const wsId = parseInt(req.body?.id, 10);
   if (!Number.isInteger(wsId) || wsId <= 0) return res.status(400).json({ error: 'Bad workspace id' });
   const accessible = await getAccessibleWorkspaceIds(userId);
   if (!accessible.includes(wsId)) return res.status(403).json({ error: 'Access denied.' });

   // 1-year, lax, root-path cookie; readable server-side by getActiveWorkspaceId.
   res.setHeader('Set-Cookie', `active_workspace=${wsId}; Path=/; Max-Age=31536000; SameSite=Lax`);
   return res.status(200).json({ activeId: wsId });
}
```

- [ ] **Step 4 — run → pass (5/5).** **Step 5 — tsc clean; commit** the 3 route files + test — `feat(workspaces): list/create/rename/delete/active API`.

---

### Task 3: service + wire `WorkspaceSwitcher`

**Files:** Create `services/workspaces.tsx`; Modify `components/common/WorkspaceSwitcher.tsx`. (tsc + manual smoke; no unit test.)

- [ ] **Step 1 — create `services/workspaces.tsx`:**
```tsx
import { useMutation, useQuery, useQueryClient } from 'react-query';

export type Workspace = { id: number; name: string };

export function useWorkspaces() {
   return useQuery<{ workspaces: Workspace[]; activeId: number | null }>('workspaces', async () => {
      const res = await fetch('/api/workspaces');
      const d = await res.json().catch(() => ({}));
      return { workspaces: d.workspaces || [], activeId: d.activeId ?? null };
   }, { staleTime: 60_000 });
}

async function jsonFetch(url: string, method: string, body?: unknown) {
   const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
   if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Request failed'); }
   return res.json();
}

export function useCreateWorkspace() {
   const qc = useQueryClient();
   return useMutation((name: string) => jsonFetch('/api/workspaces', 'POST', { name }), { onSuccess: () => qc.invalidateQueries('workspaces') });
}
export function useRenameWorkspace() {
   const qc = useQueryClient();
   return useMutation(({ id, name }: { id: number; name: string }) => jsonFetch(`/api/workspaces/${id}`, 'PATCH', { name }), { onSuccess: () => qc.invalidateQueries('workspaces') });
}
export function useDeleteWorkspace() {
   const qc = useQueryClient();
   return useMutation((id: number) => jsonFetch(`/api/workspaces/${id}`, 'DELETE'), { onSuccess: () => qc.invalidateQueries('workspaces') });
}
/** Switches the active workspace, then hard-reloads so server-side scoping re-runs. */
export function useSetActiveWorkspace() {
   return useMutation(async (id: number) => {
      await jsonFetch('/api/workspaces/active', 'POST', { id });
      if (typeof window !== 'undefined') window.location.reload();
   });
}
```

- [ ] **Step 2 — wire `components/common/WorkspaceSwitcher.tsx`.** READ it first; it currently uses a hardcoded `WORKSPACES` array, local `selected` state, and a "coming soon" toast. Preserve ALL styles/markup; replace only the data + handlers:
  - Remove the `WORKSPACES` constant + `Workspace` interface (use the service type).
  - `const { data } = useWorkspaces();` → `const workspaces = data?.workspaces || [];` `const activeId = data?.activeId ?? null;`
  - `const setActive = useSetActiveWorkspace();` `const createWs = useCreateWorkspace();` `const renameWs = useRenameWorkspace();` `const deleteWs = useDeleteWorkspace();`
  - The trigger button shows the active workspace name: `const current = workspaces.find((w) => w.id === activeId) || workspaces[0];` render `current?.name ?? 'Workspace'`.
  - Each row: `onClick={() => { if (w.id !== activeId) setActive.mutate(w.id); setOpen(false); }}`; the checkmark shows when `w.id === activeId`.
  - "Add new workspace": replace the toast with an inline create — prompt for a name (a small inline text input in the menu, OR `window.prompt('Workspace name')` for the MVP) then `createWs.mutate(name)`; on success the list refetches. Keep the existing row styling for the button.
  - Add a rename + delete affordance per row (a small "···"/pencil+trash on hover, styled minimally with the existing palette): rename → `window.prompt` seeded with current name → `renameWs.mutate({ id, name })`; delete → `if (confirm('Delete workspace?')) deleteWs.mutate(id)` and surface the server error via `toast.error(err.message)` in the mutation's `onError` (map `WORKSPACE_NOT_EMPTY`/`WORKSPACE_LAST` to friendly text). Do NOT show delete/rename on the row that is the only workspace if it would violate the guards — but the server is the source of truth; just toast the error if it rejects.
  - Keep `toast` import; keep the click-outside `useEffect`.

  Keep it tasteful and minimal — this is wiring + small affordances, not a redesign. If full inline rename/delete UI risks disturbing the layout, use `window.prompt`/`confirm` for those two (acceptable for this MVP) and keep the menu visuals intact.

- [ ] **Step 3 — verify:** `cd /c/Users/patry/Desktop/serpbear && npx tsc --noEmit` → clean. Manual smoke (`npm run dev`): switcher lists real workspaces; switching reloads and the domains list reflects the new workspace; "Add new workspace" creates one; rename/delete work and deleting a non-empty workspace shows a friendly error.

- [ ] **Step 4 — commit** `services/workspaces.tsx components/common/WorkspaceSwitcher.tsx` — `feat(workspaces): wire WorkspaceSwitcher to live workspaces`.

---

## Self-Review
- list/switch/create/rename/delete → Tasks 1,2,3. ✅  Delete blocked when non-empty/last → Task 1 (`WORKSPACE_NOT_EMPTY`/`WORKSPACE_LAST`) → 409 (Task 2). ✅
- All CRUD re-verifies the workspace's `org_id` against the caller's org (`assertInOrg`) — no cross-org rename/delete. ✅  set-active validates via `getAccessibleWorkspaceIds` (403 otherwise). ✅
- Active id surfaced by the list endpoint via `getActiveWorkspaceId` (no client cookie parsing). Switch hard-reloads so ①'s server scoping re-runs. Deleting the active workspace → stale cookie → ① falls back to default. ✅
- No placeholders. Names consistent: `listWorkspaces/createWorkspace/renameWorkspace/deleteWorkspace`, `useWorkspaces/useCreate.../useSetActiveWorkspace`, `active_workspace` cookie, error codes `WORKSPACE_*`.
- Out of scope: moving domains between workspaces (deferred), members (④).
