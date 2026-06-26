import { useQuery } from 'react-query';

export type GscAccount = { email: string; picture: string };

/** The signed-in user's first connected Google Search Console account (email + avatar).
 *  Cached so the topbar avatar doesn't refetch on every mount/navigation. */
export function useGscAccount() {
   return useQuery<GscAccount | null>('gscAccount', async () => {
      const res = await fetch('/api/gsc/accounts', { credentials: 'include' });
      if (!res.ok) return null;
      const data = await res.json().catch(() => ({}));
      const a = data?.accounts?.[0];
      return a ? { email: a.email || '', picture: a.picture || '' } : null;
   }, { staleTime: 300_000, cacheTime: 600_000, refetchOnWindowFocus: false, retry: false });
}
