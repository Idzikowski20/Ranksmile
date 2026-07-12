import { useMutation, useQuery, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import type { AiVisConfig, AiVisTopic, AiVisPriority } from '../lib/aiVisibility';

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

/** Read the saved config (topics + prompts with their DB ids). Shares the guard's
 *  cache key so the Manage Prompts editor and the redirect guard stay in sync. */
export function useAiVisConfig(slug: string | undefined) {
   return useQuery<{ config: AiVisConfig | null }>(
      ['ai-vis-config', slug],
      () => fetchJson<{ config: AiVisConfig | null }>(`/api/ai-visibility/${slug}/config`),
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
   return useMutation<StartScanResult, Error, { force?: boolean; incremental?: boolean } | void>(
      async (opts) => {
         const force = !!(opts && 'force' in opts && opts.force);
         const incremental = !!(opts && 'incremental' in opts && opts.incremental);
         const r = await fetch(`/api/ai-visibility/${slug}/scan`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ force, incremental }),
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
      (body: { brandName: string, topics: AiVisTopic[], priority?: AiVisPriority }) => fetchJson<{ config: AiVisConfig }>(`/api/ai-visibility/${slug}/config`, jsonPost(body)),
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

export function useUpdateAiVisPriority(slug: string | undefined) {
   const qc = useQueryClient();
   return useMutation(
      (priority: AiVisPriority) => fetchJson<{ config: AiVisConfig }>(`/api/ai-visibility/${slug}/config`, {
         method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priority }),
      }),
      {
         onSuccess: (data) => {
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
   usingFallbackScan?: boolean; latestAttemptFailedAt?: string | null;
   snapshot?: DomainSnapshotDTO;
   competitors?: Array<{ domain: string; snapshot: DomainSnapshotDTO }>;   // top-5, sources emptied
   competitorsAll?: Array<{ domain: string; visibilityScore: number }>;     // all, for the picker
   compare?: { competitorDomain: string; snapshot: DomainSnapshotDTO } | null; // long-tail fallback
   delta?: unknown; nextRefreshAt?: string | null; daysUntilRefresh?: number | null;
   refreshIntervalDays?: number; priority?: AiVisPriority;
   promptOptions?: Array<{ id: number; text: string; topic: string }>;
};

export function useAiVisOverview(slug: string | undefined, competitor?: string, prompts?: number[]) {
   const params = new URLSearchParams({ view: 'overview' });
   if (competitor) params.set('competitor', competitor);
   if (prompts?.length) params.set('prompts', prompts.join(','));
   const key = params.toString();
   return useQuery<OverviewPayload>(['ai-vis-overview', slug, key],
      () => fetchJson<OverviewPayload>(`/api/ai-visibility/${slug}/data?${key}`),
      { enabled: !!slug, staleTime: 30_000, keepPreviousData: true });
}

export type HistoryPayload = { scans: Array<{ scanId: number; finishedAt: string | null; series: { you: DomainOverview | null; competitor?: DomainOverview | null } }> };
export function useAiVisHistory(slug: string | undefined, competitor?: string, prompts?: number[]) {
   const params = new URLSearchParams();
   if (competitor) params.set('competitor', competitor);
   if (prompts?.length) params.set('prompts', prompts.join(','));
   const qs = params.toString();
   return useQuery<HistoryPayload>(['ai-vis-history', slug, qs],
      () => fetchJson<HistoryPayload>(`/api/ai-visibility/${slug}/history${qs ? `?${qs}` : ''}`),
      { enabled: !!slug, staleTime: 60_000, keepPreviousData: true });
}

export type SourceDetailPayload = { history: Array<{ finishedAt: string | null; timesShown: number }>; brands: Array<{ pos: number; brand: string; sentiment: 'positive' | 'neutral' | 'negative' | 'mixed'; quotes: string[] }>; brandCount: number };
export function useAiVisSourceDetail(slug: string | undefined, url: string | null) {
   return useQuery<SourceDetailPayload>(['ai-vis-source-detail', slug, url],
      () => fetchJson<SourceDetailPayload>(`/api/ai-visibility/${slug}/data?view=source-detail&url=${encodeURIComponent(url as string)}`),
      { enabled: !!slug && !!url, staleTime: 60_000 });
}

export type PromptTopicPrompt = { id: number; text: string; visibility: number; mentionRate: number; avgPosition: number | null; brands: string[] };
export type PromptTopic = { topic: string; promptCount: number; visibility: number; mentionRate: number; avgPosition: number | null; brands: string[]; prompts: PromptTopicPrompt[] };
export type PromptTopicsPayload = { pending?: boolean; overview: { visibilityScore: number; mentionRate: number; avgPosition: number | null }; topics: PromptTopic[] };
export function useAiVisPromptTopics(slug: string | undefined, params: { prompts?: number[]; models?: string[] }) {
   const q = new URLSearchParams({ view: 'prompt-topics' });
   if (params.prompts?.length) q.set('prompts', params.prompts.join(','));
   if (params.models?.length) q.set('models', params.models.join(','));
   const key = q.toString();
   return useQuery<PromptTopicsPayload>(['ai-vis-prompt-topics', slug, key],
      () => fetchJson<PromptTopicsPayload>(`/api/ai-visibility/${slug}/data?${key}`),
      { enabled: !!slug, staleTime: 30_000, keepPreviousData: true });
}

export type CompetitorRow = { domain: string; visibilityScore: number; mentionRate: number; avgPosition: number | null };
export function useAiVisCompetitors(slug: string | undefined, params: { prompts?: number[]; models?: string[] }) {
   const q = new URLSearchParams({ view: 'competitors' });
   if (params.prompts?.length) q.set('prompts', params.prompts.join(','));
   if (params.models?.length) q.set('models', params.models.join(','));
   const key = q.toString();
   return useQuery<{ competitors: CompetitorRow[]; pending?: boolean }>(['ai-vis-competitors', slug, key],
      () => fetchJson<{ competitors: CompetitorRow[]; pending?: boolean }>(`/api/ai-visibility/${slug}/data?${key}`),
      { enabled: !!slug, staleTime: 30_000, keepPreviousData: true });
}

export type MentionSource = { url: string; domain: string; timesShown: number; ownMentioned: boolean; compMentioned: boolean };
export type CompetitorDetailPayload = {
   overview: { visibilityScore: number; mentionRate: number; avgPosition: number | null };
   prompts: Array<{ promptId: number; topic: string; text: string; avgPosition: number | null }>;
   sources: Array<{ url: string; domain: string; timesShown: number; models: string[]; mentioned?: boolean }>;
   brand: string;
   ownLabel: string;
   mentions: number;
   mentionSources: MentionSource[];
   gap: { domain: string; gap: number; shared: number; you: number };
};
export function useAiVisCompetitorDetail(slug: string | undefined, competitor: string | null) {
   return useQuery<CompetitorDetailPayload>(['ai-vis-competitor-detail', slug, competitor],
      () => fetchJson<CompetitorDetailPayload>(`/api/ai-visibility/${slug}/data?view=competitor-detail&competitor=${encodeURIComponent(competitor as string)}`),
      { enabled: !!slug && !!competitor, staleTime: 60_000 });
}

// ── Fanout queries ─────────────────────────────────────────────────────────
export type FanoutByQueryRow = { query: string; promptCount: number; models: string[]; timesShown: number; prompts: Array<{ id: number; text: string; topic: string; timesShown: number }> };
export type FanoutByPromptRow = { id: number; text: string; topic: string; fanoutCount: number; models: string[]; timesShown: number; queries: Array<{ query: string; models: string[]; timesShown: number }> };
export type FanoutPayload = { pending?: boolean; groupByFanout: FanoutByQueryRow[]; groupByPrompt: FanoutByPromptRow[]; commonPhrases: Array<{ phrase: string; count: number }> };
export function useAiVisFanout(slug: string | undefined, params: { prompts?: number[]; models?: string[] }) {
   const q = new URLSearchParams({ view: 'fanout' });
   if (params.prompts?.length) q.set('prompts', params.prompts.join(','));
   if (params.models?.length) q.set('models', params.models.join(','));
   const key = q.toString();
   return useQuery<FanoutPayload>(['ai-vis-fanout', slug, key],
      () => fetchJson<FanoutPayload>(`/api/ai-visibility/${slug}/data?${key}`),
      { enabled: !!slug, staleTime: 30_000, keepPreviousData: true });
}

/** Shared detail slide-over payload (prompt-detail + fanout-detail return the same shape). */
export type AiVisDetailPayload = {
   pending?: boolean;
   title: string;
   overview: { visibilityScore: number; mentionRate: number; avgPosition: number | null } | null;
   engines: string[];
   series: Array<{ finishedAt: string | null; visibilityScore: number; mentionRate: number; avgPosition: number | null }>;
   brands: Array<{ brand: string; domain: string; mentions: number; avgPosition: number | null }>;
   fanout: Array<{ query: string; models: string[]; timesShown: number }>;
};
export function useAiVisPromptDetail(slug: string | undefined, params: { promptId: number | null; engine?: string }) {
   const q = new URLSearchParams({ view: 'prompt-detail' });
   if (params.promptId != null) q.set('promptId', String(params.promptId));
   if (params.engine) q.set('engine', params.engine);
   const key = q.toString();
   return useQuery<AiVisDetailPayload>(['ai-vis-prompt-detail', slug, key],
      () => fetchJson<AiVisDetailPayload>(`/api/ai-visibility/${slug}/data?${key}`),
      { enabled: !!slug && params.promptId != null, staleTime: 60_000, keepPreviousData: true });
}
export function useAiVisFanoutDetail(slug: string | undefined, params: { query: string | null; engine?: string }) {
   const q = new URLSearchParams({ view: 'fanout-detail' });
   if (params.query) q.set('query', params.query);
   if (params.engine) q.set('engine', params.engine);
   const key = q.toString();
   return useQuery<AiVisDetailPayload>(['ai-vis-fanout-detail', slug, key],
      () => fetchJson<AiVisDetailPayload>(`/api/ai-visibility/${slug}/data?${key}`),
      { enabled: !!slug && !!params.query, staleTime: 60_000, keepPreviousData: true });
}

/** Sources view with prompt/model/gapBrands filters. Distinct query key per filter set
 *  so switching filters refetches; keepPreviousData avoids flicker. */
export function useAiVisSources<T>(slug: string | undefined, params: { prompts?: number[]; models?: string[]; gapBrands?: string[]; compare?: string | null }) {
   const q = new URLSearchParams({ view: 'sources' });
   if (params.prompts?.length) q.set('prompts', params.prompts.join(','));
   if (params.models?.length) q.set('models', params.models.join(','));
   if (params.gapBrands?.length) q.set('gapBrands', params.gapBrands.join(','));
   if (params.compare) q.set('compare', params.compare);
   const key = q.toString();
   return useQuery<T & { pending?: boolean }>(['ai-vis-sources', slug, key],
      () => fetchJson<T & { pending?: boolean }>(`/api/ai-visibility/${slug}/data?${key}`),
      { enabled: !!slug, staleTime: 30_000, keepPreviousData: true });
}
