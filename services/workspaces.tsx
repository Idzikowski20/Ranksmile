import { useMutation, useQuery, useQueryClient } from 'react-query';

export type Workspace = { id: number; name: string; domain?: string | null };

export function useWorkspaces() {
   return useQuery<{ workspaces: Workspace[]; activeId: number | null }>('workspaces', async () => {
      const res = await fetch('/api/workspaces');
      const d = await res.json().catch(() => ({}));
      return { workspaces: d.workspaces || [], activeId: d.activeId ?? null };
   }, { staleTime: 300_000, cacheTime: 600_000, refetchOnWindowFocus: false });
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
/**
 * Creates (or resumes) an empty setup-state workspace and returns its id. The
 * caller navigates to `/workspace/<id>/setup` to run the creator wizard, which
 * attaches the domain + brand knowledge and flips the workspace to `ready`.
 */
export function useCreateSetupWorkspace() {
   return useMutation(async () => {
      const d = await jsonFetch('/api/workspaces/setup', 'POST');
      return d.id as number;
   });
}
export function useRenameWorkspace() {
   const qc = useQueryClient();
   return useMutation(({ id, name }: { id: number; name: string }) => jsonFetch(`/api/workspaces/${id}`, 'PATCH', { name }), { onSuccess: () => qc.invalidateQueries('workspaces') });
}
export function useDeleteWorkspace() {
   const qc = useQueryClient();
   return useMutation((id: number) => jsonFetch(`/api/workspaces/${id}`, 'DELETE'), { onSuccess: () => qc.invalidateQueries('workspaces') });
}
/**
 * Switches the active workspace by navigating to its dashboard. The
 * `/workspace/<id>/...` URL is the source of truth; `WorkspaceCookieSync` (in
 * _app) mirrors it into the `active_workspace` cookie so server scoping matches.
 */
export function useSetActiveWorkspace() {
   return useMutation(async (id: number) => {
      if (typeof window !== 'undefined') window.location.href = `/workspace/${id}/dashboard`;
   });
}
