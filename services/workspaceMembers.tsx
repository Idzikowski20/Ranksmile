import { useMutation, useQuery, useQueryClient } from 'react-query';

export type WorkspaceMemberRow = { id: number; email: string | null; role: string; hasAccess: boolean };
export type WorkspaceMembersData = { role: 'owner' | 'admin' | 'member' | null; members: WorkspaceMemberRow[] };

export function useWorkspaceMembers(wsId: number | null) {
   return useQuery<WorkspaceMembersData>(['workspaceMembers', wsId], async () => {
      const res = await fetch(`/api/workspaces/${wsId}/members`);
      const d: Partial<WorkspaceMembersData> = await res.json().catch(() => ({}));
      return { role: d.role ?? null, members: d.members || [] };
   }, { enabled: wsId !== null });
}

export function useSetWorkspaceMembers(wsId: number) {
   const qc = useQueryClient();
   return useMutation(async ({ memberIds }: { memberIds: number[] }) => {
      const res = await fetch(`/api/workspaces/${wsId}/members`, {
         method: 'PUT',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ memberIds }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Request failed'); }
      return res.json().catch(() => ({}));
   }, { onSuccess: () => qc.invalidateQueries(['workspaceMembers', wsId]) });
}
