import { useMutation, useQuery, useQueryClient } from 'react-query';

export type PeopleMember = {
   id: number;
   user_id: string;
   email: string | null;
   role: string;
   status: string;
   workspace_ids: string | null;
   created_at: string | null;
};
export type PeopleInvitation = {
   id: number;
   email: string;
   role: string;
   status: string;
   workspace_ids: string | null;
   expires_at: string | null;
};
export type PeopleData = { members: PeopleMember[]; invitations: PeopleInvitation[]; role: string | null };

async function jsonFetch(url: string, method: string, body?: unknown) {
   const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
   });
   if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.error || 'Request failed');
   }
   return res.json();
}

export function usePeople() {
   return useQuery<PeopleData>('people', async () => {
      const res = await fetch('/api/members');
      const d = await res.json().catch(() => ({}));
      return { members: d.members || [], invitations: d.invitations || [], role: d.role ?? null };
   });
}

export function useInviteMember() {
   const qc = useQueryClient();
   return useMutation(
      (p: { email: string; role: string; workspaceIds: number[] | null }) => jsonFetch('/api/members', 'POST', p),
      { onSuccess: () => qc.invalidateQueries('people') },
   );
}

export function useChangeRole() {
   const qc = useQueryClient();
   return useMutation(
      ({ id, role }: { id: number; role: string }) => jsonFetch(`/api/members/${id}`, 'PATCH', { role }),
      { onSuccess: () => qc.invalidateQueries('people') },
   );
}

export function useRemoveMember() {
   const qc = useQueryClient();
   return useMutation((id: number) => jsonFetch(`/api/members/${id}`, 'DELETE'), {
      onSuccess: () => qc.invalidateQueries('people'),
   });
}

export function useSetMemberWorkspaces() {
   const qc = useQueryClient();
   return useMutation(
      ({ id, workspaceIds }: { id: number; workspaceIds: number[] | null }) => jsonFetch(`/api/members/${id}/workspaces`, 'PATCH', { workspaceIds }),
      { onSuccess: () => qc.invalidateQueries('people') },
   );
}

export function useRevokeInvitation() {
   const qc = useQueryClient();
   return useMutation((id: number) => jsonFetch(`/api/members/invitations/${id}`, 'DELETE'), {
      onSuccess: () => qc.invalidateQueries('people'),
   });
}

/** "All workspaces" when null/empty; otherwise the workspace names resolved from ids. */
export function describeWorkspaceAccess(workspaceIdsJson: string | null, names: Map<number, string>): string {
   if (!workspaceIdsJson) return 'All';
   let ids: number[] = [];
   try { ids = JSON.parse(workspaceIdsJson); } catch { ids = []; }
   if (!ids.length) return 'All';
   const resolved = ids.map((id) => names.get(id) || `#${id}`);
   return resolved.join(', ');
}
