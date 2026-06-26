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
