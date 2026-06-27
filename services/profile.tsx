import { useMutation, useQuery, useQueryClient } from 'react-query';

export type UserProfile = { name: string | null; avatarUrl: string | null; productUpdates: boolean };
const KEY = 'profile';

export function useProfile() {
   return useQuery<UserProfile>(KEY, async () => {
      const res = await fetch('/api/profile');
      const d = await res.json().catch(() => ({}));
      return { name: d.name ?? null, avatarUrl: d.avatarUrl ?? null, productUpdates: !!d.productUpdates };
   }, { staleTime: 300_000, cacheTime: 600_000, refetchOnWindowFocus: false });
}

export function useUpdateProfile() {
   const qc = useQueryClient();
   return useMutation(async (patch: { name?: string; avatarDataUrl?: string; productUpdates?: boolean }) => {
      const res = await fetch('/api/profile', {
         method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error('Failed to save profile');
      return res.json() as Promise<UserProfile>;
   }, { onSuccess: () => qc.invalidateQueries(KEY) });
}
