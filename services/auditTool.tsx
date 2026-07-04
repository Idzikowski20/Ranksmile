import { useMutation, useQuery, useQueryClient, UseQueryResult, UseMutationResult } from 'react-query';
import toast from 'react-hot-toast';
import type { AuditCardDTO, AuditResult } from '../lib/auditTypes';

/** Single fetch+parse+error helper — mirrors services/aiVisibility.tsx so every hook
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

export interface AuditStatusPayload {
   queued: number; running: number; completed: number; failed: number;
   runs: { id: number; status: string; progressDone: number; progressTotal: number }[];
}

export interface AuditDetailPayload {
   run: { id: number; url: string; keyword: string; status: string; contentScore: number | null; createdAt: string | null; finishedAt: string | null; error: string | null };
   result: AuditResult | null;
}

export function useAuditList(slug: string | undefined): UseQueryResult<{ items: AuditCardDTO[] }> {
   return useQuery<{ items: AuditCardDTO[] }>(
      ['audit-list', slug],
      () => fetchJson<{ items: AuditCardDTO[] }>(`/api/audit-tool/${slug}/list`),
      { enabled: !!slug, keepPreviousData: true },
   );
}

export function useAuditRun(slug: string | undefined, id: number | undefined): UseQueryResult<AuditDetailPayload> {
   return useQuery<AuditDetailPayload>(
      ['audit-run', slug, id],
      () => fetchJson<AuditDetailPayload>(`/api/audit-tool/${slug}/${id}`),
      {
         enabled: !!slug && !!id,
         // Poll while the run is still computing so the detail page updates when it finishes.
         refetchInterval: (data) => (
            data?.run?.status !== 'completed' && data?.run?.status !== 'failed' ? 3000 : false
         ),
      },
   );
}

export function useAuditStatus(slug: string | undefined): UseQueryResult<AuditStatusPayload> {
   return useQuery<AuditStatusPayload>(
      ['audit-status', slug],
      () => fetchJson<AuditStatusPayload>(`/api/audit-tool/${slug}/status`),
      {
         enabled: !!slug,
         refetchInterval: (data) => (data && (data.queued > 0 || data.running > 0) ? 3000 : false),
      },
   );
}

export function useCreateAudit(slug: string | undefined): UseMutationResult<{ ids: number[] }, Error, { url: string; keywords: string[] }> {
   const qc = useQueryClient();
   return useMutation<{ ids: number[] }, Error, { url: string; keywords: string[] }>(
      (body) => fetchJson<{ ids: number[] }>(`/api/audit-tool/${slug}/create`, jsonPost(body)),
      {
         onSuccess: () => {
            qc.invalidateQueries(['audit-list', slug]);
            qc.invalidateQueries(['audit-status', slug]);
         },
         onError: toastError,
      },
   );
}

export function useRunAudits(slug: string | undefined): UseMutationResult<{ processed: number }, Error, void> {
   const qc = useQueryClient();
   return useMutation<{ processed: number }, Error, void>(
      () => fetchJson<{ processed: number }>(`/api/audit-tool/${slug}/run`, jsonPost({})),
      {
         onSuccess: () => {
            qc.invalidateQueries(['audit-list', slug]);
            qc.invalidateQueries(['audit-status', slug]);
         },
         onError: toastError,
      },
   );
}
