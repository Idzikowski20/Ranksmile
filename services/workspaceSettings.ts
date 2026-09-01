import { useMutation, useQuery, useQueryClient } from 'react-query';

export type WorkspaceSettings = {
   name: string;
   domain: string | null;
   country: string | null;
   language: string | null;
   logoUrl: string | null;
   cc: string | null;
};

const KEY = 'workspaceSettings';

export function useWorkspaceSettings() {
   return useQuery<WorkspaceSettings>(KEY, async () => {
      const res = await fetch('/api/workspaces/settings');
      const d = await res.json().catch(() => ({}));
      return {
         name: d.name ?? '',
         domain: d.domain ?? null,
         country: d.country ?? null,
         language: d.language ?? null,
         logoUrl: d.logoUrl ?? null,
         cc: d.cc ?? null,
      };
   }, { staleTime: 60_000, refetchOnWindowFocus: false });
}

export function useUpdateWorkspaceLogo() {
   const qc = useQueryClient();
   return useMutation(async (logoDataUrl: string) => {
      const res = await fetch('/api/workspaces/settings', {
         method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logoDataUrl }),
      });
      if (!res.ok) throw new Error('Failed to save workspace logo');
      return res.json() as Promise<{ logoUrl: string }>;
   }, { onSuccess: () => qc.invalidateQueries(KEY) });
}
