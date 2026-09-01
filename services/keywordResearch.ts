import { useMutation, useQuery, useQueryClient, UseQueryResult, UseMutationResult } from 'react-query';
import type { KeywordResearchCardDTO, KeywordResearchResult } from '@/src/core/domain/keywords/types';
import { fetchJson, toastError, jsonPost } from './http';

export interface KeywordResearchStatusPayload {
   queued: number; running: number; completed: number; failed: number;
   runs: { id: number; status: string; progressDone: number; progressTotal: number }[];
}

export interface KeywordResearchDetailPayload {
   run: {
      id: number; seed: string; country: string; status: string;
      createdAt: string | null; finishedAt: string | null; error: string | null;
   };
   result: KeywordResearchResult | null;
}

export function useKeywordResearchList(slug: string | undefined): UseQueryResult<{ items: KeywordResearchCardDTO[] }> {
   return useQuery<{ items: KeywordResearchCardDTO[] }>(
      ['keyword-research-list', slug],
      () => fetchJson<{ items: KeywordResearchCardDTO[] }>(`/api/keyword-research/${slug}/list`),
      { enabled: !!slug, keepPreviousData: true },
   );
}

export function useKeywordResearchRun(slug: string | undefined, id: number | undefined): UseQueryResult<KeywordResearchDetailPayload> {
   return useQuery<KeywordResearchDetailPayload>(
      ['keyword-research-run', slug, id],
      () => fetchJson<KeywordResearchDetailPayload>(`/api/keyword-research/${slug}/${id}`),
      {
         enabled: !!slug && !!id,
         refetchInterval: (data) => (
            data?.run?.status !== 'completed' && data?.run?.status !== 'failed' ? 3000 : false
         ),
      },
   );
}

export function useKeywordResearchStatus(slug: string | undefined): UseQueryResult<KeywordResearchStatusPayload> {
   return useQuery<KeywordResearchStatusPayload>(
      ['keyword-research-status', slug],
      () => fetchJson<KeywordResearchStatusPayload>(`/api/keyword-research/${slug}/status`),
      {
         enabled: !!slug,
         refetchInterval: (data) => (data && (data.queued > 0 || data.running > 0) ? 3000 : false),
      },
   );
}

export function useCreateKeywordResearch(slug: string | undefined): UseMutationResult<{ id: number }, Error, { seed: string; country?: string }> {
   const qc = useQueryClient();
   return useMutation<{ id: number }, Error, { seed: string; country?: string }>(
      (body) => fetchJson<{ id: number }>(`/api/keyword-research/${slug}/create`, jsonPost(body)),
      {
         onSuccess: () => {
            qc.invalidateQueries(['keyword-research-list', slug]);
            qc.invalidateQueries(['keyword-research-status', slug]);
         },
         onError: toastError,
      },
   );
}

export function useDeleteKeywordResearch(slug: string | undefined): UseMutationResult<{ ok: boolean }, Error, { id: number }> {
   const qc = useQueryClient();
   return useMutation<{ ok: boolean }, Error, { id: number }>(
      ({ id }) => fetchJson<{ ok: boolean }>(`/api/keyword-research/${slug}/${id}`, { method: 'DELETE' }),
      {
         onSuccess: () => {
            qc.invalidateQueries(['keyword-research-list', slug]);
            qc.invalidateQueries(['keyword-research-status', slug]);
         },
         onError: toastError,
      },
   );
}

export function useRunKeywordResearch(slug: string | undefined): UseMutationResult<{ processed: number }, Error, void> {
   const qc = useQueryClient();
   return useMutation<{ processed: number }, Error, void>(
      () => fetchJson<{ processed: number }>(`/api/keyword-research/${slug}/run`, jsonPost({})),
      {
         onSuccess: () => {
            qc.invalidateQueries(['keyword-research-list', slug]);
            qc.invalidateQueries(['keyword-research-status', slug]);
         },
         onError: toastError,
      },
   );
}
