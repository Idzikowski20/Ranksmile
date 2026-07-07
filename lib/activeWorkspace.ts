/** Active-workspace helpers for SurferSEO-style /workspace/<id>/... URLs. */

/** The numeric workspace id leading a `/workspace/<id>[-slug]/...` path, or null. */
export function parseWorkspaceId(path: string): number | null {
   const m = /^\/workspace\/(\d+)(?:-[^/]*)?(?:\/|$)/.exec(path || '');
   return m ? Number(m[1]) : null;
}

/**
 * SSR-safe active workspace id. The URL is read ONLY once mounted: under the
 * `/workspace/<id>/:path → /:path` rewrite, `router.asPath` is the destination
 * (`/dashboard`) on the server but the source (`/workspace/2/dashboard`) on the
 * client, so reading it during the first render produces different hrefs server vs
 * client → a hydration mismatch. Until mounted we fall back to the server-reported
 * activeId (undefined at hydration on both sides), so first render matches; after
 * mount the URL id takes over.
 */
export function deriveActiveId(mounted: boolean, asPath: string, wsActiveId?: number | null): number | null {
   return (mounted ? parseWorkspaceId(asPath) : null) ?? wsActiveId ?? null;
}

/** Builds a `/workspace/<id>/<path>` href (bare `/path` when wsId is falsy). */
export function workspaceHref(wsId: number | null | undefined, path: string): string {
   const clean = path.startsWith('/') ? path.slice(1) : path;
   if (!wsId) return `/${clean}`;
   return `/workspace/${wsId}/${clean}`;
}

/**
 * Resolves the active workspace's domain out of a full (possibly cross-workspace)
 * domains list. Matches on `workspace_id` first — the reliable, unambiguous link
 * between a domain row and its workspace — then falls back to the workspace's own
 * tracked domain hostname (`activeWorkspaceDomain`, from `Workspace.domain`) for
 * legacy rows with no `workspace_id`. Returns `null` if neither resolves.
 *
 * Centralized because two independent ad-hoc implementations of "find the active
 * domain" (Sidebar.tsx matching `Workspace.name` — a display name, not a hostname —
 * against `domain.domain`; dashboard/index.tsx just taking `domains[0]` with no
 * workspace filter at all) both silently resolved the WRONG domain after switching
 * or creating a workspace.
 */
export function resolveActiveDomain<D extends { workspace_id?: number | null; domain: string }>(
   domains: D[],
   activeWorkspaceId: number | null | undefined,
   activeWorkspaceDomain?: string | null,
): D | null {
   if (activeWorkspaceId != null) {
      const byId = domains.find((d) => d.workspace_id === activeWorkspaceId);
      if (byId) return byId;
   }
   if (activeWorkspaceDomain) {
      const byDomain = domains.find((d) => d.domain === activeWorkspaceDomain);
      if (byDomain) return byDomain;
   }
   return null;
}
