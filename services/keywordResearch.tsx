import { useMutation, useQuery, useQueryClient, UseQueryResult, UseMutationResult } from 'react-query';
import toast from 'react-hot-toast';
import type { TopicResearchCardDTO, TopicResearchResult } from '../lib/topicResearchTypes';

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

export interface KeywordResearchStatusPayload {
   queued: number; running: number; completed: number; failed: number;
   runs: { id: number; status: string; progressDone: number; progressTotal: number }[];
}

export interface KeywordResearchDetailPayload {
   run: {
      id: number; seed: string; country: string; status: string;
      createdAt: string | null; finishedAt: string | null; error: string | null;
   };
   result: TopicResearchResult | null;
}

export function useKeywordResearchList(slug: string | undefined): UseQueryResult<{ items: TopicResearchCardDTO[] }> {
   return useQuery<{ items: TopicResearchCardDTO[] }>(
      ['keyword-research-list', slug],
      () => fetchJson<{ items: TopicResearchCardDTO[] }>(`/api/keyword-research/${slug}/list`),
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
