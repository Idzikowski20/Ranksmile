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
