import { useEffect, useState } from 'react';

export type CoverageHistoryDelta = {
  /** Rounded score change vs previous coverage feature version. */
  delta: number;
  title: string;
};

/**
 * Minimal: fetch last two coverage feature versions and return ↑/↓ vs previous run.
 * Renders nothing useful when < 2 versions (caller should omit chip).
 */
export function useCoverageHistoryDelta(articleId?: number | null): CoverageHistoryDelta | null {
  const [state, setState] = useState<CoverageHistoryDelta | null>(null);

  useEffect(() => {
    if (!articleId) {
      setState(null);
      return undefined;
    }
    let cancelled = false;
    fetch(`/api/articles/${articleId}/growth-history?featureId=coverage`)
      .then(async (res): Promise<CoverageHistoryDelta | null> => {
        if (!res.ok) return null;
        const data = (await res.json()) as {
          features?: Array<{ score?: { score?: number; value?: number }; version?: number }>;
          delta?: { scoreDelta?: number | null } | null;
        };
        const features = data.features || [];
        if (features.length < 2) return null;
        const latest = features[0]!;
        const prev = features[1]!;
        const latestScore = latest.score?.value ?? latest.score?.score ?? 0;
        const prevScore = prev.score?.value ?? prev.score?.score ?? 0;
        const raw = Math.round(latestScore - prevScore);
        if (raw === 0) return null;
        // Note: avoid `satisfies` — Next 12 SWC parser rejects it at compile time.
        return {
          delta: raw,
          title: `vs previous run (v${prev.version ?? '?'} → v${latest.version ?? '?'})`,
        };
      })
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch(() => {
        if (!cancelled) setState(null);
      });
    return () => {
      cancelled = true;
    };
  }, [articleId]);

  return state;
}
