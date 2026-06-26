# P2a — Workspace URL routing foundation Implementation Plan

> First slice of P2 (navigation reframe). Branch: `feature/tenancy-foundation`. Gives the app SurferSEO-style `/workspace/[id]/...` URLs via Next rewrites + reads the active workspace from the URL (mirrored into the cookie that ①'s server scoping already reads). No page moves.

**Goal:** `/workspace/:wsId/<anything>` serves the existing page at `/<anything>` (browser URL stays `/workspace/...`). The client derives the active workspace from the URL and keeps the `active_workspace` cookie in sync so API scoping matches. `/` redirects into the first accessible workspace (or the create-workspace flow when there are none).

**Architecture:** A single `afterFiles` rewrite strips the `/workspace/:wsId` prefix. `lib/activeWorkspace.ts` holds pure helpers: `parseWorkspaceId(path)` and `workspaceHref(wsId, path)`. A tiny `WorkspaceCookieSync` mounted in `_app` writes the URL's workspace id into the `active_workspace` cookie on every route change. `pages/index.tsx` resolves the user's workspaces and redirects to `/workspace/<firstId>/dashboard` (or `/onboarding`-style create flow stub when none — full wizard is P3).

**Conventions:** `cd /c/Users/patry/Desktop/serpbear && ...`; `npx jest <path> --ci`; `npx tsc --noEmit` clean. Commit specific files; trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: `lib/activeWorkspace.ts` pure helpers (TDD)

**Files:** Create `lib/activeWorkspace.ts`; Test `__tests__/lib/activeWorkspace.test.ts`.

- [ ] **Step 1 — test** `__tests__/lib/activeWorkspace.test.ts`:
```ts
import { parseWorkspaceId, workspaceHref } from '../../lib/activeWorkspace';

describe('parseWorkspaceId', () => {
  it('extracts the numeric id from a /workspace/<id>-<slug>/... path', () => {
    expect(parseWorkspaceId('/workspace/1361078-vegra/dashboard')).toBe(1361078);
    expect(parseWorkspaceId('/workspace/42/sites/x.pl/performance')).toBe(42);
  });
  it('returns null when the path is not workspace-scoped', () => {
    expect(parseWorkspaceId('/dashboard')).toBeNull();
    expect(parseWorkspaceId('/workspace/abc/x')).toBeNull();
    expect(parseWorkspaceId('')).toBeNull();
  });
});

describe('workspaceHref', () => {
  it('builds a workspace-scoped path', () => {
    expect(workspaceHref(7, '/dashboard')).toBe('/workspace/7/dashboard');
    expect(workspaceHref(7, 'sites/x.pl')).toBe('/workspace/7/sites/x.pl');
  });
  it('returns the bare path when wsId is falsy', () => {
    expect(workspaceHref(0, '/dashboard')).toBe('/dashboard');
    expect(workspaceHref(null as any, '/dashboard')).toBe('/dashboard');
  });
});
```
- [ ] **Step 2 — run → fail.** **Step 3 — implement** `lib/activeWorkspace.ts`:
```ts
/** Active-workspace helpers for SurferSEO-style /workspace/<id>/... URLs. */

/** The numeric workspace id leading a `/workspace/<id>[-slug]/...` path, or null. */
export function parseWorkspaceId(path: string): number | null {
   const m = /^\/workspace\/(\d+)(?:-[^/]*)?(?:\/|$)/.exec(path || '');
   return m ? Number(m[1]) : null;
}

/** Builds a `/workspace/<id>/<path>` href (bare `/path` when wsId is falsy). */
export function workspaceHref(wsId: number | null | undefined, path: string): string {
   const clean = path.startsWith('/') ? path.slice(1) : path;
   if (!wsId) return `/${clean}`;
   return `/workspace/${wsId}/${clean}`;
}
```
- [ ] **Step 4 — run → pass (4/4).** **Step 5 — tsc clean; commit** `lib/activeWorkspace.ts __tests__/lib/activeWorkspace.test.ts` — `feat(routing): active-workspace path helpers`.

---

### Task 2: `next.config.js` workspace rewrite

**Files:** Modify `next.config.js`.

- [ ] **Step 1** — In the existing `async rewrites()` array, ADD this entry (keep the existing `content-editor` entries; order it LAST so the specific ones win):
```js
      { source: '/workspace/:wsId/:path*', destination: '/:path*' },
```
Also add a redirect (in the existing `async redirects()` array) so a bare workspace URL lands on its dashboard:
```js
      { source: '/workspace/:wsId', destination: '/workspace/:wsId/dashboard', permanent: false },
```
- [ ] **Step 2 — verify build config parses:** `cd /c/Users/patry/Desktop/serpbear && node -e "require('./next.config.js'); console.log('ok')"` → prints `ok`.
- [ ] **Step 3 — commit** `next.config.js` — `feat(routing): rewrite /workspace/:id/* to underlying pages`.

(Note: rewrites do not chain — under `/workspace/:id/...` always link to REAL destination paths, e.g. `/workspace/7/articles`, never the `/content-editor` alias.)

---

### Task 3: cookie sync in `_app.tsx`

So server-side scoping (`getActiveWorkspaceId` reads the `active_workspace` cookie) matches the URL.

**Files:** Modify `pages/_app.tsx`.

- [ ] **Step 1** — add a tiny client component inside `_app.tsx` (above `MyApp`) and mount it inside the providers:
```tsx
function WorkspaceCookieSync() {
   const router = useRouter();
   React.useEffect(() => {
      const sync = (asPath: string) => {
         const id = parseWorkspaceId(asPath);
         if (id) document.cookie = `active_workspace=${id}; Path=/; Max-Age=31536000; SameSite=Lax`;
      };
      sync(router.asPath);
      router.events.on('routeChangeComplete', sync);
      return () => router.events.off('routeChangeComplete', sync);
   }, [router]);
   return null;
}
```
Add imports at top: `import { useRouter } from 'next/router';` and `import { parseWorkspaceId } from '../lib/activeWorkspace';`. Mount `<WorkspaceCookieSync />` just inside `<QueryClientProvider>` (sibling to `<Component />`).
- [ ] **Step 2 — tsc clean; commit** `pages/_app.tsx` — `feat(routing): sync active_workspace cookie from the URL`.

---

### Task 4: `/` redirects into a workspace

**Files:** Modify `pages/index.tsx`.

- [ ] **Step 1** — Replace the redirect effect so it resolves the user's first accessible workspace and routes into it (falling back to the existing `post_login_redirect` stash, then to `/onboarding` when the user has no workspace yet — the full create-workspace wizard is P3):
```tsx
   useEffect(() => {
      if (!router) return;
      let stashed: string | null = null;
      try { stashed = localStorage.getItem('post_login_redirect'); if (stashed) localStorage.removeItem('post_login_redirect'); } catch { /* ignore */ }
      if (stashed) { router.replace(stashed); return; }
      (async () => {
         try {
            const res = await fetch('/api/workspaces');
            const d = await res.json().catch(() => ({}));
            const first = (d.workspaces || [])[0];
            if (first?.id) { router.replace(`/workspace/${first.id}/dashboard`); return; }
         } catch { /* fall through */ }
         router.replace('/onboarding');
      })();
   }, [router]);
```
(`/api/workspaces` already exists from ③ and returns `{ workspaces, activeId }`.)
- [ ] **Step 2 — tsc clean; commit** `pages/index.tsx` — `feat(routing): land on the first workspace dashboard`.

---

### Task 5: verification

- [ ] `cd /c/Users/patry/Desktop/serpbear && npx tsc --noEmit` → clean.
- [ ] `cd /c/Users/patry/Desktop/serpbear && npx jest __tests__/lib/activeWorkspace.test.ts --ci` → 4/4.
- [ ] Full suite `cd /c/Users/patry/Desktop/serpbear && npx jest --ci` → only the pre-existing UI failures, nothing new.
- [ ] Manual smoke (`npm run dev`): visiting `/workspace/<realId>/dashboard` renders the dashboard with the URL preserved; the `active_workspace` cookie is set to `<realId>`; the domain/article data shown is that workspace's; `/` redirects into `/workspace/<firstId>/dashboard`. `graphify update .`.

---

## Self-Review
- `/workspace/:id/*` URLs via one rewrite, no page moves → Task 2. ✅
- Active workspace from URL → `parseWorkspaceId` (Task 1) used in cookie sync (Task 3) + links (P2b). ✅
- Server scoping matches URL via cookie sync → Task 3 (① `getActiveWorkspaceId` already reads `active_workspace`). ✅
- `/` lands in a workspace; 0-workspace users → `/onboarding` stub (full wizard = P3). ✅
- Pure helpers unit-tested; routing/cookie verified by build-parse + manual smoke (not unit-testable). ✅
- Out of scope: sidebar rebuild (P2b), updating all in-app links to `workspaceHref` (P2c), removing Sites/config from nav (P2d).
