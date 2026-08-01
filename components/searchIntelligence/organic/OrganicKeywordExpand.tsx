import React, { useMemo } from 'react';
import { useRouter } from 'next/router';
import { Chart } from '../../koala/charts';
import type { ChartPreparedData } from '../../koala/charts';
import type { OrganicKeyword } from '../../../lib/organicResearch/types';
import { useOrganicKeywordHistory } from '../../../services/organicResearch';
import { useRankKeywordHistory } from '../../../services/rankTracking';
import { absoluteUrl, normalizeFeature, SerpMiniIcon } from './organicSerp';

const FONT = 'var(--font-family-primary)';
const LINK_COLOR = 'rgb(35, 95, 226)';

const SERP_CATALOG: { key: string; label: string; match: string[] }[] = [
  { key: 'ai_overview', label: 'AI Overview', match: ['ai_overview', 'ai overview', 'sge'] },
  { key: 'reviews', label: 'Reviews', match: ['reviews', 'review'] },
  { key: 'images', label: 'Image', match: ['images', 'image', 'image_pack'] },
  { key: 'video', label: 'Video', match: ['video', 'videos'] },
  { key: 'video_carousel', label: 'Video carousel', match: ['video_carousel', 'video carousel'] },
  { key: 'people_also_ask', label: 'People also ask', match: ['people_also_ask', 'people also ask', 'paa'] },
  { key: 'knowledge_panel', label: 'Knowledge panel', match: ['knowledge_panel', 'knowledge graph', 'knowledge_graph'] },
  { key: 'related_searches', label: 'Related searches', match: ['related_searches', 'related searches'] },
  { key: 'featured_snippet', label: 'Featured snippet', match: ['featured_snippet', 'featured snippet', 'snippet'] },
  { key: 'sitelinks', label: 'Sitelinks', match: ['sitelinks', 'sitelink'] },
  { key: 'local_pack', label: 'Local pack', match: ['local_pack', 'local pack', 'map'] },
  { key: 'shopping', label: 'Shopping', match: ['shopping', 'product'] },
];

function formatHistoryLabel(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 7);
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
}

export function ExpandedPanel({
  kw,
  onFilterKeyword,
  trackingKeywordId,
  rankConfigId,
}: {
  kw: OrganicKeyword;
  onFilterKeyword?: (keyword: string) => void;
  trackingKeywordId?: number | null;
  rankConfigId?: number | null;
}) {
  const router = useRouter();
  const slug = typeof router.query.domain === 'string' ? router.query.domain : '';
  const href = absoluteUrl(kw.url);
  const thenPos = kw.previousPosition;
  const curr = kw.position;

  const useTracker = Boolean(slug && rankConfigId && trackingKeywordId);
  const trackerHistoryQ = useRankKeywordHistory(
    useTracker ? slug : undefined,
    useTracker ? rankConfigId ?? undefined : undefined,
    useTracker ? trackingKeywordId ?? undefined : undefined,
  );
  const organicHistoryQ = useOrganicKeywordHistory(
    !useTracker ? slug : undefined,
    !useTracker ? kw.keyword : undefined,
    {
      position: kw.position,
      previousPosition: kw.previousPosition,
      change30d: kw.change30d,
      updatedAt: kw.updatedAt,
    },
  );

  const chartState = useTracker
    ? (trackerHistoryQ.isLoading ? 'loading' : trackerHistoryQ.isError ? 'error' : 'ready')
    : (organicHistoryQ.isLoading ? 'loading' : organicHistoryQ.isError ? 'error' : 'ready');

  const prepared: ChartPreparedData = useMemo(() => {
    if (useTracker) {
      const snaps = [...(trackerHistoryQ.data?.snapshots ?? [])]
        .filter((s) => s.position != null && s.position > 0)
        .sort((a, b) => String(a.checked_at).localeCompare(String(b.checked_at)));
      const labels = snaps.map((s) => formatHistoryLabel(String(s.checked_at || '').slice(0, 10)));
      const points = snaps.map((s, i) => ({
        label: labels[i],
        value: Number(s.position),
      }));
      return { labels, points };
    }

    const rows = (organicHistoryQ.data?.points ?? []).filter((p) => p.position != null && p.position > 0);
    const labels = rows.map((p) => formatHistoryLabel(p.date));
    return {
      labels,
      points: rows.map((p, i) => ({ label: labels[i], value: p.position as number })),
    };
  }, [useTracker, trackerHistoryQ.data?.snapshots, organicHistoryQ.data?.points]);

  const hasPoints = (prepared.points?.length ?? 0) > 0;
  const resolvedState = chartState === 'ready' && !hasPoints ? 'empty' : chartState;

  const activeSet = useMemo(
    () => new Set(kw.serpFeatures.map(normalizeFeature)),
    [kw.serpFeatures],
  );

  const isFeatureOn = (match: string[]) => match.some((m) => {
    const n = normalizeFeature(m);
    for (const f of activeSet) {
      if (f.includes(n) || n.includes(f)) return true;
    }
    return false;
  });

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      padding: '16px 20px 20px 48px',
      background: 'var(--koala-bg-secondary, #f5f5f5)',
      borderBottom: '1px solid var(--koala-border-primary, #e5e5e5)',
    }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: FONT, fontSize: 13 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--koala-text-primary)', marginRight: 4 }}>
            Position
          </span>
          <strong style={{ color: 'var(--koala-text-primary)' }}>{thenPos != null ? thenPos : '—'}</strong>
          <span style={{ color: 'var(--koala-text-secondary)' }}>→</span>
          <strong style={{ color: 'var(--koala-text-primary)' }}>{curr != null ? curr : '—'}</strong>
        </div>
        {onFilterKeyword && (
          <button
            type="button"
            onClick={() => onFilterKeyword(kw.keyword)}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--koala-text-brand, #F84416)',
              fontSize: 12,
              fontFamily: FONT,
              cursor: 'var(--koala-cursor-pointing)',
              padding: 0,
            }}
          >
            Filter by: <span style={{ fontWeight: 600 }}>{kw.keyword}</span>
          </button>
        )}
      </div>

      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          style={{
            color: LINK_COLOR,
            fontFamily: 'inherit',
            fontSize: 13,
            textDecoration: 'none',
            wordBreak: 'break-all',
            lineHeight: 1.4,
          }}
        >
          {href}
        </a>
      ) : (
        <span style={{ color: 'var(--koala-text-tertiary)', fontSize: 13, fontFamily: FONT }}>No ranking URL</span>
      )}

      <div style={{
        background: 'var(--koala-bg-primary, #fff)',
        border: '1px solid var(--koala-border-primary, #e5e5e5)',
        borderRadius: 16,
        padding: '12px 16px 8px',
      }}
      >
        <div style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--koala-text-secondary)',
          fontFamily: FONT,
          marginBottom: 8,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
        >
          Position history
        </div>
        <div style={{ width: '100%', minHeight: 180 }}>
          <Chart
            preset="RankHistory"
            data={prepared}
            state={resolvedState}
            emptyDescription="No position history yet"
            errorDescription="Could not load position history"
            overrides={{ height: 200, legend: false }}
            aria-label={`Position history for ${kw.keyword}`}
          />
        </div>
      </div>

      <div>
        <div style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--koala-text-secondary)',
          fontFamily: FONT,
          marginBottom: 8,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
        >
          SERP Features
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: '6px 16px',
          maxWidth: 560,
        }}
        >
          {SERP_CATALOG.map((item) => {
            const on = isFeatureOn(item.match);
            return (
              <div
                key={item.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  fontFamily: FONT,
                  color: on ? 'var(--koala-text-primary)' : 'var(--koala-text-tertiary)',
                }}
              >
                <span style={{
                  width: 16,
                  height: 16,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: on ? 1 : 0.45,
                }}
                >
                  <SerpMiniIcon name={item.key} />
                </span>
                {item.label}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
