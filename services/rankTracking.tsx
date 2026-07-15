import { useMutation, useQuery, useQueryClient, UseQueryResult } from 'react-query';
import toast from 'react-hot-toast';
import type {
  ComparePeriod,
  RankAnalyticsSummary,
  RankCheckRunRow,
  RankHistorySummaryItem,
  RankResultsPage,
  RankSnapshotRow,
  RankTrackingConfigRow,
  RankTrackingKeywordRow,
} from '../lib/types/rankTracking';

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  let body: unknown = null;
  try { body = await r.json(); } catch { /* empty */ }
  if (!r.ok) {
    const msg = (body as { error?: string } | null)?.error || `Request failed (${r.status})`;
    throw new Error(msg);
  }
  return body as T;
}

const toastError = (e: unknown): void => {
  toast.error(e instanceof Error ? e.message : 'Something went wrong');
};

const jsonPost = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export function useRankConfigs(slug: string | undefined): UseQueryResult<{ configs: RankTrackingConfigRow[] }> {
  return useQuery(
    ['rank-configs', slug],
    () => fetchJson<{ configs: RankTrackingConfigRow[] }>(`/api/rank-tracking/${slug}/configs`),
    { enabled: !!slug, keepPreviousData: true },
  );
}

export function useRankResults(
  slug: string | undefined,
  configId: number | undefined,
  opts?: {
    comparePeriod?: ComparePeriod;
    page?: number;
    pageSize?: number;
    cursor?: string | null;
    search?: string;
    sort?: string;
    order?: 'asc' | 'desc';
  },
): UseQueryResult<RankResultsPage> {
  const params = new URLSearchParams();
  if (configId) params.set('configId', String(configId));
  if (opts?.comparePeriod) params.set('comparePeriod', opts.comparePeriod);
  if (opts?.page) params.set('page', String(opts.page));
  if (opts?.pageSize) params.set('pageSize', String(opts.pageSize));
  if (opts?.cursor) params.set('cursor', opts.cursor);
  if (opts?.search) params.set('search', opts.search);
  if (opts?.sort) params.set('sort', opts.sort);
  if (opts?.order) params.set('order', opts.order);

  return useQuery(
    ['rank-results', slug, configId, opts],
    () => fetchJson<RankResultsPage>(`/api/rank-tracking/${slug}/results?${params}`),
    { enabled: !!slug && !!configId, keepPreviousData: true },
  );
}

export function usePrefetchRankNextPage(
  slug: string | undefined,
  configId: number | undefined,
  nextCursor: string | null,
  opts?: { comparePeriod?: ComparePeriod; pageSize?: number },
) {
  const qc = useQueryClient();
  return () => {
    if (!slug || !configId || !nextCursor) return;
    const params = new URLSearchParams({
      configId: String(configId),
      cursor: nextCursor,
      pageSize: String(opts?.pageSize ?? 50),
    });
    if (opts?.comparePeriod) params.set('comparePeriod', opts.comparePeriod);
    void qc.prefetchQuery(
      ['rank-results', slug, configId, { ...opts, cursor: nextCursor }],
      () => fetchJson<RankResultsPage>(`/api/rank-tracking/${slug}/results?${params}`),
    );
  };
}

export function useRankAnalytics(
  slug: string | undefined,
  configId: number | undefined,
  comparePeriod: ComparePeriod = '7d',
): UseQueryResult<{ summary: RankAnalyticsSummary }> {
  return useQuery(
    ['rank-analytics', slug, configId, comparePeriod],
    () => fetchJson<{ summary: RankAnalyticsSummary }>(
      `/api/rank-tracking/${slug}/analytics?configId=${configId}&comparePeriod=${comparePeriod}`,
    ),
    { enabled: !!slug && !!configId, keepPreviousData: true },
  );
}

export function useRankRunPolling(slug: string | undefined, configId: number | undefined) {
  return useQuery(
    ['rank-run-latest', slug, configId],
    () => fetchJson<{ run: RankCheckRunRow | null }>(
      `/api/rank-tracking/${slug}/runs/latest?configId=${configId}`,
    ),
    {
      enabled: !!slug && !!configId,
      refetchInterval: (data) => {
        const s = data?.run?.status;
        return s === 'pending' || s === 'running' || s === 'partial' ? 3000 : false;
      },
    },
  );
}

export function useCreateRankConfig(slug: string | undefined) {
  const qc = useQueryClient();
  return useMutation(
    (body: Record<string, unknown>) => fetchJson<{ id: number }>(`/api/rank-tracking/${slug}/configs`, jsonPost(body)),
    {
      onSuccess: () => qc.invalidateQueries(['rank-configs', slug]),
      onError: toastError,
    },
  );
}

export function useAddRankKeywords(slug: string | undefined, configId: number | undefined) {
  const qc = useQueryClient();
  return useMutation(
    (keywords: string[]) => fetchJson<{ keywords: RankTrackingKeywordRow[]; ids: number[]; run: { runId: number } | null }>(
      `/api/rank-tracking/${slug}/keywords`,
      jsonPost({ configId, keywords }),
    ),
    {
      onSuccess: async (data) => {
        const added = data.ids?.length ?? 0;
        if (added > 0) {
          toast.success(
            data.run
              ? (added === 1 ? 'Keyword added — checking rank…' : `${added} keywords added — checking ranks…`)
              : (added === 1 ? 'Keyword added' : `${added} keywords added`),
          );
        }
        void qc.invalidateQueries(['rank-results', slug, configId]);
        void qc.invalidateQueries(['rank-cost', slug, configId]);
        if (data.run && slug && configId) {
          void qc.invalidateQueries(['rank-run-latest', slug, configId]);
          try {
            await fetchJson<{ processed: number; completed: boolean }>(
              `/api/rank-tracking/${slug}/run`,
              jsonPost({ configId }),
            );
            void qc.invalidateQueries(['rank-results', slug, configId]);
            void qc.invalidateQueries(['rank-run-latest', slug, configId]);
          } catch {
            /* rank-tracking page polling loop will continue the run */
          }
        }
      },
      onError: toastError,
    },
  );
}

export function useTriggerRankCheck(slug: string | undefined) {
  const qc = useQueryClient();
  return useMutation(
    (configId: number) => fetchJson<{ ok: boolean; runId?: number }>(
      `/api/rank-tracking/${slug}/check`,
      jsonPost({ configId }),
    ),
    {
      onSuccess: () => qc.invalidateQueries(['rank-run-latest', slug]),
      onError: toastError,
    },
  );
}

export function useProcessRankRun(slug: string | undefined) {
  return useMutation(
    (configId: number) => fetchJson<{ processed: number; completed: boolean }>(
      `/api/rank-tracking/${slug}/run`,
      jsonPost({ configId }),
    ),
    { onError: toastError },
  );
}

export function useRankCost(slug: string | undefined, configId: number | undefined) {
  return useQuery(
    ['rank-cost', slug, configId],
    () => fetchJson<{ costUsd: number; keywordCount: number }>(
      `/api/rank-tracking/${slug}/cost?configId=${configId}`,
    ),
    { enabled: !!slug && !!configId },
  );
}

export function useRankHistorySummary(
  slug: string | undefined,
  configId: number | undefined,
): UseQueryResult<{ summaries: RankHistorySummaryItem[] }> {
  return useQuery(
    ['rank-history-summary', slug, configId],
    () => fetchJson<{ summaries: RankHistorySummaryItem[] }>(
      `/api/rank-tracking/${slug}/history/summary?configId=${configId}`,
    ),
    { enabled: !!slug && !!configId, staleTime: 60_000 },
  );
}

export function useRankKeywordHistory(
  slug: string | undefined,
  configId: number | undefined,
  keywordId: number | undefined,
): UseQueryResult<{ snapshots: RankSnapshotRow[] }> {
  return useQuery(
    ['rank-keyword-history', slug, configId, keywordId],
    () => fetchJson<{ snapshots: RankSnapshotRow[] }>(
      `/api/rank-tracking/${slug}/history/${keywordId}?configId=${configId}&device=desktop&limit=365`,
    ),
    { enabled: !!slug && !!configId && !!keywordId },
  );
}
