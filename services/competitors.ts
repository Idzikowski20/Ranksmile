import { useMutation, useQuery, useQueryClient, UseQueryResult, UseMutationResult } from 'react-query';
import type { CompetitorDTO } from '@/src/core/domain/competitors/competitor';
import { fetchJson, toastError, jsonPost } from './http';

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
