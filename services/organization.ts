import { useMutation, useQuery, useQueryClient } from 'react-query';

export type OrganizationProfile = { name: string | null; logoUrl: string | null };
const KEY = 'organization';

export function useOrganization() {
   return useQuery<OrganizationProfile>(KEY, async () => {
      const res = await fetch('/api/organization');
      const d = await res.json().catch(() => ({}));
      return { name: d.name ?? null, logoUrl: d.logoUrl ?? null };
   }, { staleTime: 300_000, cacheTime: 600_000, refetchOnWindowFocus: false });
}

export function useUpdateOrganization() {
   const qc = useQueryClient();
   // `logoDataUrl: null` clears the logo server-side; omitting it leaves it alone.
   return useMutation(async (patch: { name?: string; logoDataUrl?: string | null }) => {
      const res = await fetch('/api/organization', {
         method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error('Failed to save organization');
      return res.json();
   }, { onSuccess: () => qc.invalidateQueries(KEY) });
}
