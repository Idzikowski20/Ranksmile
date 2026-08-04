import React, { useMemo } from 'react';
import { Chart } from '../koala/charts';
import type { ChartPreparedData } from '../koala/charts';
import { chartColors } from '../koala/tokens/chart';
import DomainFavicon from '../common/DomainFavicon';

const FONT = 'var(--font-family-primary)';

type Bar = { domain: string; overview: { visibilityScore: number }; rank?: number; outsider?: boolean };

/** Grouped bars: orange = You, grey = competitor (Koala Distribution). */
const CompetitorBarChart = ({
  competitors,
  selected,
  onSelect,
  ownScore = 0,
}: {
  competitors: Bar[];
  selected: string | null;
  onSelect: (d: string) => void;
  /** Own visibility score — orange series on every group. */
  ownScore?: number;
}) => {
  const shown = competitors.slice(0, 5);

  const chartData: ChartPreparedData = useMemo(
    () => ({
      labels: shown.map((c) => c.domain),
      series: [
        {
          label: 'You',
          kind: 'traffic' as const,
          values: shown.map(() => ownScore),
        },
        {
          label: 'Competitor',
          kind: 'comparison' as const,
          values: shown.map((c) => c.overview.visibilityScore),
        },
      ],
    }),
    [shown, ownScore],
  );

  if (!shown.length) {
    return (
      <div style={{
        height: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 14,
        color: 'var(--koala-text-tertiary, #9F9FA9)',
        fontFamily: FONT,
      }}
      >
        No competitors cited yet.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      <Chart
        preset="Distribution"
        data={chartData}
        state="ready"
        overrides={{ height: 220, legend: true }}
        aria-label="Competitor visibility scores"
        legendItems={[
          { key: 'you', label: 'You', color: chartColors.traffic },
          { key: 'competitor', label: 'Competitor', color: chartColors.comparison },
        ]}
      />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {shown.map((c) => {
          const isSel = c.domain === selected;
          return (
            <button
              key={c.domain}
              type="button"
              onClick={() => onSelect(c.domain)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                border: `1px solid ${isSel ? 'var(--koala-border-brand, #F84416)' : 'var(--koala-border-primary, #e5e5e5)'}`,
                borderRadius: 12,
                padding: '6px 10px',
                background: isSel ? 'var(--koala-bg-secondary, #f5f5f5)' : 'var(--koala-bg-primary, #fff)',
                cursor: 'var(--koala-cursor-pointing, pointer)',
                fontFamily: FONT,
                fontSize: 13,
                fontWeight: isSel ? 600 : 500,
                color: 'var(--koala-text-primary)',
              }}
            >
              <DomainFavicon domain={c.domain} size={16} style={{ borderRadius: 3 }} />
              {c.domain}
              <span style={{ color: 'var(--koala-text-secondary)' }}>{c.overview.visibilityScore}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CompetitorBarChart;
