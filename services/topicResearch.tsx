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

export interface TopicResearchStatusPayload {
   queued: number; running: number; completed: number; failed: number;
   runs: { id: number; status: string; progressDone: number; progressTotal: number }[];
}

export interface TopicResearchDetailPayload {
   run: {
      id: number; seed: string; country: string; status: string;
      createdAt: string | null; finishedAt: string | null; error: string | null;
   };
   result: TopicResearchResult | null;
}

export function useTopicResearchList(slug: string | undefined): UseQueryResult<{ items: TopicResearchCardDTO[] }> {
   return useQuery<{ items: TopicResearchCardDTO[] }>(
      ['topic-research-list', slug],
      () => fetchJson<{ items: TopicResearchCardDTO[] }>(`/api/topic-research/${slug}/list`),
      { enabled: !!slug, keepPreviousData: true },
   );
}

export function useTopicResearchRun(slug: string | undefined, id: number | undefined): UseQueryResult<TopicResearchDetailPayload> {
   return useQuery<TopicResearchDetailPayload>(
      ['topic-research-run', slug, id],
      () => fetchJson<TopicResearchDetailPayload>(`/api/topic-research/${slug}/${id}`),
      {
         enabled: !!slug && !!id,
         refetchInterval: (data) => (
            data?.run?.status !== 'completed' && data?.run?.status !== 'failed' ? 3000 : false
         ),
      },
   );
}

export function useTopicResearchStatus(slug: string | undefined): UseQueryResult<TopicResearchStatusPayload> {
   return useQuery<TopicResearchStatusPayload>(
      ['topic-research-status', slug],
      () => fetchJson<TopicResearchStatusPayload>(`/api/topic-research/${slug}/status`),
      {
         enabled: !!slug,
         refetchInterval: (data) => (data && (data.queued > 0 || data.running > 0) ? 3000 : false),
      },
   );
}

export function useCreateTopicResearch(slug: string | undefined): UseMutationResult<{ id: number }, Error, { seed: string; country?: string }> {
   const qc = useQueryClient();
   return useMutation<{ id: number }, Error, { seed: string; country?: string }>(
      (body) => fetchJson<{ id: number }>(`/api/topic-research/${slug}/create`, jsonPost(body)),
      {
         onSuccess: () => {
            qc.invalidateQueries(['topic-research-list', slug]);
            qc.invalidateQueries(['topic-research-status', slug]);
         },
         onError: toastError,
      },
   );
}

export function useDeleteTopicResearch(slug: string | undefined): UseMutationResult<{ ok: boolean }, Error, { id: number }> {
   const qc = useQueryClient();
   return useMutation<{ ok: boolean }, Error, { id: number }>(
      ({ id }) => fetchJson<{ ok: boolean }>(`/api/topic-research/${slug}/${id}`, { method: 'DELETE' }),
      {
         onSuccess: () => {
            qc.invalidateQueries(['topic-research-list', slug]);
            qc.invalidateQueries(['topic-research-status', slug]);
         },
         onError: toastError,
      },
   );
}

export function useRunTopicResearch(slug: string | undefined): UseMutationResult<{ processed: number }, Error, void> {
   const qc = useQueryClient();
   return useMutation<{ processed: number }, Error, void>(
      () => fetchJson<{ processed: number }>(`/api/topic-research/${slug}/run`, jsonPost({})),
      {
         onSuccess: () => {
            qc.invalidateQueries(['topic-research-list', slug]);
            qc.invalidateQueries(['topic-research-status', slug]);
         },
         onError: toastError,
      },
   );
}
