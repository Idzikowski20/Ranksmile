import { useMutation, useQuery, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import type { AiVisConfig, AiVisTopic } from '../lib/aiVisibility';

export type AiVisScanStatus = {
   status: 'idle' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled',
   progressDone: number, progressTotal: number, costUsd: number, finishedAt: string | null,
};

/** Single fetch+parse+error helper — replaces the repeated `if (!r.ok) throw`
 * across every hook. Throws Error(message-from-server) so react-query onError
 * can toast it uniformly. */
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

export function useAiVisData<T>(slug: string | undefined, view: string) {
   return useQuery<T & { pending?: boolean }>(
      ['ai-vis-data', slug, view],
      () => fetchJson<T & { pending?: boolean }>(`/api/ai-visibility/${slug}/data?view=${view}`),
      { enabled: !!slug, staleTime: 30_000 },
   );
}

export function useAiVisScanStatus(slug: string | undefined) {
   return useQuery<AiVisScanStatus>(
      ['ai-vis-scan-status', slug],
      () => fetchJson<AiVisScanStatus>(`/api/ai-visibility/${slug}/scan-status`),
      {
         enabled: !!slug,
         refetchInterval: (data) => (
            data?.status === 'running' ? 3000
            : data?.status === 'queued' ? 5000
            : false
         ),
      },
   );
}

export type StartScanResult =
   | { needsConfirm: false; scanId: number }
   | { needsConfirm: true; lastScanDaysAgo: number };

export function useStartAiVisScan(slug: string | undefined) {
   const qc = useQueryClient();
   return useMutation<StartScanResult, Error, { force?: boolean } | void>(
      async (opts) => {
         const force = !!(opts && 'force' in opts && opts.force);
         const r = await fetch(`/api/ai-visibility/${slug}/scan`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ force }),
         });
         let body: unknown = null;
         try { body = await r.json(); } catch { /* empty body */ }
         if (r.status === 409 && (body as { needsConfirm?: boolean } | null)?.needsConfirm) {
            return { needsConfirm: true, lastScanDaysAgo: (body as { lastScanDaysAgo: number }).lastScanDaysAgo };
         }
         if (!r.ok) throw new Error((body as { error?: string } | null)?.error || `Request failed (${r.status})`);
         return { needsConfirm: false, scanId: (body as { scanId: number }).scanId };
      },
      {
         onSuccess: (res) => { if (!res.needsConfirm) qc.invalidateQueries(['ai-vis-scan-status', slug]); },
         onError: toastError,
      },
   );
}

export function useSaveAiVisConfig(slug: string | undefined) {
   const qc = useQueryClient();
   return useMutation(
      (body: { brandName: string, topics: AiVisTopic[] }) => fetchJson<{ config: AiVisConfig }>(`/api/ai-visibility/${slug}/config`, jsonPost(body)),
      {
         onSuccess: (data) => {
            // Prime the guard's cache with the freshly-saved (completed) config so the
            // redirect-to-overview after "Finish" reads completedAt immediately instead
            // of a stale { config: null } — which bounced the user back to setup.
            qc.setQueryData(['ai-vis-config', slug], data);
            qc.invalidateQueries(['ai-vis-data', slug]);
         },
         onError: toastError,
      },
   );
}

export function useGeneratePrompts(slug: string | undefined) {
   return useMutation(
      (topic: string) => fetchJson<{ prompts: Array<{ text: string, provenance: string[] }>, degraded?: boolean }>(`/api/ai-visibility/${slug}/generate-prompts`, jsonPost({ topic })),
      { onError: toastError },
   );
}

export type DomainOverview = { visibilityScore: number; mentionRate: number; avgPosition: number | null; directCitations: number; pages: number; perModel: Array<{ model: string; score: number }> };
export type DomainSnapshotDTO = { overview: DomainOverview; sources: Array<{ url: string; domain: string; timesShown: number; models: string[] }>; prompts: Array<{ promptId: number; topic: string; text: string; score: number }>; topics: Array<{ topic: string; score: number }>; citedPromptIds: number[] };
export type OverviewPayload = {
   pending?: boolean; scanId?: number; finishedAt?: string | null;
   snapshot?: DomainSnapshotDTO;
   competitors?: Array<{ domain: string; snapshot: DomainSnapshotDTO }>;   // top-5, sources emptied
   competitorsAll?: Array<{ domain: string; visibilityScore: number }>;     // all, for the picker
   compare?: { competitorDomain: string; snapshot: DomainSnapshotDTO } | null; // long-tail fallback
   delta?: unknown; nextRefreshAt?: string | null; daysUntilRefresh?: number | null;
};

export function useAiVisOverview(slug: string | undefined, competitor?: string) {
   const q = competitor ? `&competitor=${encodeURIComponent(competitor)}` : '';
   return useQuery<OverviewPayload>(['ai-vis-overview', slug, competitor || ''],
      () => fetchJson<OverviewPayload>(`/api/ai-visibility/${slug}/data?view=overview${q}`),
      { enabled: !!slug, staleTime: 30_000, keepPreviousData: true });
}

export type HistoryPayload = { scans: Array<{ scanId: number; finishedAt: string | null; series: { you: DomainOverview | null; competitor?: DomainOverview | null } }> };
export function useAiVisHistory(slug: string | undefined, competitor?: string) {
   const q = competitor ? `?competitor=${encodeURIComponent(competitor)}` : '';
   return useQuery<HistoryPayload>(['ai-vis-history', slug, competitor || ''],
      () => fetchJson<HistoryPayload>(`/api/ai-visibility/${slug}/history${q}`),
      { enabled: !!slug, staleTime: 60_000, keepPreviousData: true });
}
