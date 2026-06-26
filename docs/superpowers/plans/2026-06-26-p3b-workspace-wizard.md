# P3b — Workspace creator wizard (2-step) Implementation Plan

> Second slice of P3. The setup-state workspace + create endpoint + new-user redirect already landed (P3a, commits 7e9971a + 97586dc). This builds the wizard the user lands on at `/workspace/<id>/setup`. Faithful 1:1 to the Surfer markup the user provided. Branch: `feature/tenancy-foundation`.

## Context / how it hangs together
- Routing: `next.config.js` rewrites `/workspace/:wsId/:path*` → `/:path*`, so `/workspace/123/setup` serves **`pages/setup.tsx`**. The page reads its workspace id from the URL via `parseWorkspaceId(router.asPath)` (`lib/activeWorkspace.ts`).
- `WorkspaceCookieSync` (in `pages/_app.tsx`) already writes `active_workspace=<id>` cookie from the `/workspace/<id>/...` URL. So while on the wizard, the active workspace IS the setup workspace.
- `POST /api/domains/configure` ({domain, language?, pages?}) creates the `domain` row with `workspace_id = getActiveWorkspaceId(req, userId)` → i.e. the setup workspace (via the cookie above). **No new attach endpoint needed.** It also seeds `site_context` + one skeleton `articles` row per page, returns `{ domainSlug, domainId }`.
- `POST /api/brand-knowledge` ({url}) → `{ brandName, brandKnowledge }` (AI via Python sidecar).
- `lib/workspaces.ts` already exports `markWorkspaceReady(userId, wsId, name)` and `getWorkspace(userId, wsId)`.
- `getAccessibleWorkspaceIds` has NO status filter, so a `setup` workspace is accessible → the cookie resolves correctly in `getActiveWorkspaceId`.

## Wizard flow (faithful to provided markup)
**Step 1 — "Create a new workspace"** (step dot 1 active): a "Select Search Console site" combobox **or** a "Start with URL" button. Picking a GSC site, or entering a URL, → `POST /api/domains/configure` with that domain → advance to step 2. (No location/language fields — the user's actual markup has none.)
**Step 2 — "Set up Brand Knowledge"** (step dot 2 active): on entry, `POST /api/brand-knowledge {url:<domain>}` prefills "Brand name" (input) + "Brand details" (multiline). "Get started" → `POST /api/workspaces/<id>/finish` → redirect `/workspace/<id>/dashboard`.

Out of scope (→ P3c): the dashboard's 5-stage pipeline loader ("Getting Search Console and site data / Extracting and expanding keywords / Clustering and modeling topics / Analyzing competitors and coverage / Getting and evaluating recommendations"). The wizard ends by redirecting to the dashboard; wiring that loader to deep-analysis is separate.

**Conventions:** `cd /c/Users/patry/Desktop/serpbear && ...`. TDD for backend (mock DB; local `jest.mock('sequelize', ...)` if needed, NEVER global). `db.query(sql,{replacements})` → `[rows,meta]`; no `ON CONFLICT`. Commit specific files only; trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. UI = inline styles + `var(--font-family-primary)` per CLAUDE.md §6, BUT for the provided Surfer markup reproduce the classes 1:1 using the project's existing Tailwind tokens (the project's tailwind config already matches Surfer's `bg-gray-base`, `px-lg`, `rounded-lg`, `text-white-base`, `bg-brand-orange`, etc. — verify a couple resolve before relying on them; fall back to inline styles for any token that doesn't exist).

---

### Task 1 — Backend: GSC sites list + brand_knowledge column + finish endpoint

**Files:** Create `pages/api/gsc/sites.ts`, `pages/api/workspaces/[id]/finish.ts`; Modify `lib/ensureTenancyTables.ts`, `lib/workspaces.ts`; Tests: `__tests__/api/workspace-finish.test.ts` (new), extend `__tests__/lib/workspaces.test.ts`.

- [ ] **Step 1 — `domain.brand_knowledge` column.** In `lib/ensureTenancyTables.ts`, next to the other `ALTER TABLE` try/catch blocks (before `tablesChecked = true`):
  ```ts
  try { await db.query('ALTER TABLE domain ADD COLUMN brand_knowledge TEXT'); } catch { /* exists */ }
  ```

- [ ] **Step 2 — `finishWorkspaceSetup` helper** in `lib/workspaces.ts`:
  ```ts
  /** Persists brand knowledge onto the workspace's domain and flips the workspace to 'ready'. */
  export async function finishWorkspaceSetup(userId: string, wsId: number, brandName: string, brandKnowledge: string): Promise<void> {
     const { orgId } = await ensureUserTenancy(userId);
     await assertInOrg(orgId, wsId);
     await db.query('UPDATE domain SET brand_knowledge = ? WHERE workspace_id = ?', { replacements: [brandKnowledge || '', wsId] });
     await markWorkspaceReady(userId, wsId, brandName);
  }
  ```
  Test (extend `__tests__/lib/workspaces.test.ts`): mock the ownership SELECT + UPDATE domain + (markWorkspaceReady's own ownership SELECT + UPDATE); assert an `UPDATE domain SET brand_knowledge` is issued and the workspace UPDATE sets `status = 'ready'`. (markWorkspaceReady re-calls ensureUserTenancy/assertInOrg — account for those query calls in the mock sequence.)

- [ ] **Step 3 — `POST /api/workspaces/[id]/finish`** (`pages/api/workspaces/[id]/finish.ts`):
  ```ts
  import type { NextApiRequest, NextApiResponse } from 'next';
  import { getCurrentUserId } from '../../../../utils/getUser';
  import { finishWorkspaceSetup } from '../../../../lib/workspaces';

  export default async function handler(req: NextApiRequest, res: NextApiResponse) {
     const userId = await getCurrentUserId(req, res);
     if (!userId) return res.status(401).json({ error: 'Not authenticated' });
     if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
     const wsId = Number(req.query.id);
     if (!Number.isFinite(wsId)) return res.status(400).json({ error: 'Invalid workspace id' });
     const { brandName, brandKnowledge } = (req.body || {}) as { brandName?: string; brandKnowledge?: string };
     if (!brandName || !brandName.trim()) return res.status(400).json({ error: 'brandName required' });
     try {
        await finishWorkspaceSetup(userId, wsId, brandName, brandKnowledge || '');
        return res.status(200).json({ ok: true });
     } catch (e: any) {
        if (e?.message === 'WORKSPACE_NOT_FOUND') return res.status(404).json({ error: 'Workspace not found' });
        throw e;
     }
  }
  ```
  Verify the `../../../../` import depth is correct for `pages/api/workspaces/[id]/finish.ts` by comparing to the sibling `pages/api/workspaces/[id].ts` (which already imports getCurrentUserId) — match that file's depth.
  Test (`__tests__/api/workspace-finish.test.ts`): mock `getCurrentUserId`→'u1' and `finishWorkspaceSetup`. Assert: 401 when unauthenticated; 405 on GET; 400 when brandName missing; 200 `{ok:true}` on valid POST (and that finishWorkspaceSetup was called with `('u1', <id>, brandName, brandKnowledge)`); 404 when the helper throws `WORKSPACE_NOT_FOUND`.

- [ ] **Step 4 — `GET /api/gsc/sites`** (`pages/api/gsc/sites.ts`): list the user's GSC properties (Webmasters `sites.list`). **Read `pages/api/gsc/pages.ts` first** and mirror its auth + OAuth-client construction (it already iterates the user's `gsc_accounts`, builds an authorized client, and calls the Search Console API). Instead of `searchanalytics.query`, call the **sites.list** endpoint (`GET https://www.googleapis.com/webmasters/v3/sites` with the bearer token, or the googleapis `webmasters.sites.list`). Return:
  ```json
  { "sites": [ { "siteUrl": string, "permissionLevel": string } ] }
  ```
  Filter out sites where `permissionLevel === 'siteUnverifiedUser'`. On no connected account → `200 { "sites": [] }` (the UI shows the connect CTA). Match the error/auth style of `pages.ts` exactly. No test required for the live-Google call, but guard params/auth the same way `pages.ts` does.

- [ ] **Step 5 — verify + commit.** `cd /c/Users/patry/Desktop/serpbear && npx jest __tests__/lib/workspaces.test.ts __tests__/api/workspace-finish.test.ts --ci` (pass) + `npx tsc --noEmit` (no new errors). Commit `lib/ensureTenancyTables.ts lib/workspaces.ts pages/api/workspaces/[id]/finish.ts pages/api/gsc/sites.ts __tests__/lib/workspaces.test.ts __tests__/api/workspace-finish.test.ts` — `feat(workspaces): wizard finish endpoint + GSC sites list + brand_knowledge column`.

---

### Task 2 — `pages/setup.tsx`: the 2-step wizard UI

**Files:** Create `pages/setup.tsx`. (No new service file required — use `fetch` directly, matching `pages/index.tsx`'s style; or add hooks to `services/workspaces.tsx` if cleaner.)

The page renders inside the app shell? NO — the provided markup is a standalone onboarding-style centered layout (`[grid-area:main]`, white bg, max-w-[400px] step 1 / max-w-screen-sm step 2), NOT the dark AppShell. Render it as a bare full-height page (like onboarding), not wrapped in AppShell/Sidebar.

- [ ] **Step 0 — guards & state.** On mount: `wsId = parseWorkspaceId(router.asPath)`. If null → `router.replace('/')`. Optionally `GET /api/workspaces` and if this wsId is already `ready` (appears in the list) → `router.replace('/workspace/<id>/dashboard')` (don't re-run setup on a finished workspace). State: `step: 1|2`, `domain: string|null`, `brandName`, `brandKnowledge`, loading flags, `gscSites: {siteUrl}[]`, `urlMode: boolean`.

- [ ] **Step 1 — "Create a new workspace"** — reproduce this markup 1:1 (step dot 1 = `bg-brand-orange w-base`, dot 2 = `bg-gray-20 w-xs`):
  ```html
  <div class="p-sm relative flex flex-col overflow-hidden [grid-area:main]">
    <div data-scroll-element="true" class="relative flex-1 overflow-auto rounded-xl [color-scheme:light] px-base sm:px-lg bg-white-base">
      <div class="pb-md pt-3xl mx-auto flex w-full max-w-[400px] flex-col items-center justify-center self-center gap-lg">
        <div class="gap-2xl flex w-full flex-col justify-center">
          <div class="gap-2xs flex items-center">
            <div class="h-xs rounded-full bg-brand-orange w-base"></div>
            <div class="h-xs rounded-full bg-gray-20 w-xs"></div>
          </div>
          <div class="gap-md flex w-full flex-col justify-center">
            <h2 class="m-0 text-lg font-semibold">Create a new workspace</h2>
            <span class="text-gray-80">Workspace is used for a brand you own or manage. You can add workspaces for more brands later.</span>
          </div>
        </div>
        <form class="gap-lg flex w-full flex-col">
          <div class="gap-md flex w-full flex-col">
            <div class="flex w-full flex-col">
              <div class="text-md pb-xs font-medium text-gray-100">Select Search Console site</div>
              <!-- combobox button: Google icon + selected siteUrl|"Select site" + chevron. Opens a list of gscSites.
                   If gscSites is empty: clicking it (or a row) starts GSC connect:
                   window.location.href = '/api/gsc/connect?redirect=' + encodeURIComponent(location.pathname) -->
            </div>
          </div>
          <div class="text-gray-60 flex w-full items-center justify-center">
            <div class="flex w-full items-center"><div role="separator" class="text-gray-20 min-h-[1px] min-w-[1px] self-stretch bg-gray-20 w-full"></div></div>
            <div class="px-base inline-block">or</div>
            <div class="flex w-full items-center"><div role="separator" class="text-gray-20 min-h-[1px] min-w-[1px] self-stretch bg-gray-20 w-full"></div></div>
          </div>
          <button type="button" class="gap-sm ... px-lg py-sm rounded-lg text-base bg-gray-10 text-gray-base hover:bg-gray-20 active:bg-gray-40">Start with URL</button>
        </form>
      </div>
    </div>
  </div>
  ```
  Include the inline Google `<svg id="icon-google">` from the source markup (4 colored paths). Behaviour:
  - On mount, `GET /api/gsc/sites` → `gscSites`. Combobox lists them; selecting one sets `domain` = host of `siteUrl` (strip scheme/trailing slash) and calls **submit** (see below).
  - "Start with URL" → toggles `urlMode`: replace the combobox area with a URL `<input>` (styled like the combobox button: `border-gray-40 rounded-lg h-[40px] px-md`) + a primary submit button (`bg-gray-base text-white-base rounded-lg px-lg py-sm`, label "Continue"). Submitting with a non-empty value sets `domain` and calls submit.
  - **submit(domain)**: `POST /api/domains/configure` `{ domain }` (let it default language/pages). On success → `setStep(2)`. On the same tick kick off the brand-knowledge fetch for step 2. Show a spinner/disabled state while configuring.

- [ ] **Step 2 — "Set up Brand Knowledge"** — reproduce 1:1 (step dot 1 = `bg-gray-20 w-xs`, dot 2 = `bg-brand-orange w-base`), `max-w-screen-sm`:
  - Heading "Set up Brand Knowledge" + the subtext from the markup.
  - Card "Brand name" / "What is your brand called?" + `<input name="name">` bound to `brandName`.
  - Card "Brand details" + its subtext + a multiline editable area bound to `brandKnowledge` (a `<textarea>` styled inside the `border-gray-20 rounded-lg` container is an acceptable faithful simplification of the Surfer tiptap editor + ribbon — keep the bordered card chrome and the rounded inner editor box; the ribbon toolbar may be rendered visually but non-functional, OR omitted. Prefer a clean bordered textarea over a broken fake-ribbon).
  - On entering step 2: `POST /api/brand-knowledge { url: domain }` → prefill `brandName` (from `brandName`) + `brandKnowledge` (from `brandKnowledge`). Show a loading state in the fields while fetching; if it 502s, leave fields empty/editable (don't block).
  - Sticky footer (reproduce the markup): "Cancel" (text button → `router.push('/')`) + "Get started" (`type=submit`, `bg-gray-base text-white-base rounded-lg px-lg py-sm hover:bg-purple-base`). "Get started" → `POST /api/workspaces/<wsId>/finish { brandName, brandKnowledge }` → on success `router.replace('/workspace/<wsId>/dashboard')`. Disable while submitting; require non-empty brandName.

- [ ] **Step 3 — verify.** `npx tsc --noEmit` clean. Manually reason through: parseWorkspaceId from `/workspace/123/setup` → 123 (the rewrite serves this page at `/setup` but `router.asPath` is the original `/workspace/123/setup`). If `router.asPath` is `/setup` (no wsId) because of how the rewrite surfaces, FALL BACK to reading the active workspace from `GET /api/workspaces` (`activeId`) — verify which one Next actually gives and handle both. Commit `pages/setup.tsx` — `feat(workspaces): 2-step create-workspace wizard (/setup)`.

---

## Self-Review
- `/workspace/<id>/setup` renders the wizard (via rewrite → pages/setup.tsx) → Task 2. ✅
- Step 1 GSC-site OR Start-with-URL → configure → domain attached to the setup workspace (via active_workspace cookie) → Task 2 + existing configure.ts. ✅
- Step 2 AI-prefilled brand knowledge → finish → ready → dashboard → Task 1 (finish endpoint, brand_knowledge column) + Task 2. ✅
- GSC sites listing didn't exist → Task 1 adds `/api/gsc/sites`. ✅
- Faithful 1:1 markup embedded for both steps → Task 2. ✅
- Dashboard 5-stage pipeline loader = OUT OF SCOPE (P3c).
- Open risk flagged in Task 2 Step 3: whether `router.asPath` under the rewrite is `/workspace/<id>/setup` or `/setup`; handle both (URL parse with fallback to `/api/workspaces` activeId).
