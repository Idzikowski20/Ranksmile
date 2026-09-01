import { useMutation, useQuery, useQueryClient, UseQueryResult, UseMutationResult } from 'react-query';
import toast from 'react-hot-toast';
import type { CompetitorDTO } from '../lib/competitorTypes';

/** Single fetch+parse+error helper — mirrors services/auditTool.tsx so every hook
 *  throws Error(message-from-server) and react-query onError can toast it uniformly. */
async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
   const r = await fetch(url, init);
   let body: unknown = null;
   try { body = await r.json(); } catch { /* empty/non-JSON body */ }
   if (!r.ok) {
      const msg = (body as { error?: string } | null)?.error || `Request failed (${r.status})`;
      throw new Error(msg);
   }
   return body as T;
}

const toastError = (e: unknown): void => { toast.error(e instanceof Error ? e.message : 'Something went wrong'); };

const jsonPost = (body: unknown): RequestInit => ({
   method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

export function useCompetitors(slug: string | undefined, keyword: string | undefined): UseQueryResult<{ competitors: CompetitorDTO[] }> {
   return useQuery<{ competitors: CompetitorDTO[] }>(
      ['competitors', slug, keyword],
      () => fetchJson<{ competitors: CompetitorDTO[] }>(`/api/competitors/${slug}/list?keyword=${encodeURIComponent(keyword || '')}`),
      { enabled: !!slug && !!keyword, keepPreviousData: true },
   );
}

export function useScanCompetitors(slug: string | undefined): UseMutationResult<{ competitors: CompetitorDTO[] }, Error, { keyword: string }> {
   const qc = useQueryClient();
   return useMutation<{ competitors: CompetitorDTO[] }, Error, { keyword: string }>(
      (body) => fetchJson<{ competitors: CompetitorDTO[] }>(`/api/competitors/${slug}/scan`, jsonPost(body)),
      {
         onSuccess: (_data, variables) => {
            qc.invalidateQueries(['competitors', slug, variables.keyword]);
         },
         onError: toastError,
      },
   );
}

export function useSelectCompetitors(slug: string | undefined): UseMutationResult<{ ok: boolean }, Error, { keyword: string; selectedIds: number[] }> {
   const qc = useQueryClient();
   return useMutation<{ ok: boolean }, Error, { keyword: string; selectedIds: number[] }>(
      (body) => fetchJson<{ ok: boolean }>(`/api/competitors/${slug}/select`, jsonPost(body)),
      {
         onSuccess: (_data, variables) => {
            qc.invalidateQueries(['competitors', slug, variables.keyword]);
         },
         onError: toastError,
      },
   );
}
