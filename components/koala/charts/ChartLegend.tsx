import React from 'react';

/** @internal */
export type ChartLegendItem = {
  key: string;
  label: string;
  color: string;
  active?: boolean;
  onToggle?: () => void;
};

export type ChartLegendProps = {
  items: ChartLegendItem[];
};

export function ChartLegend({ items }: ChartLegendProps) {
  return (
    <div
      className="koala-chart-legend"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        alignItems: 'center',
        fontFamily: 'var(--font-family-primary)',
        fontSize: 13,
      }}
      role="group"
      aria-label="Chart legend"
    >
      {items.map((item) => {
        const active = item.active !== false;
        const interactive = Boolean(item.onToggle);
        return (
          <button
            key={item.key}
            type="button"
            disabled={!interactive}
            onClick={item.onToggle}
            aria-pressed={interactive ? active : undefined}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              border: 'none',
              background: 'transparent',
              padding: 0,
              cursor: interactive ? 'pointer' : 'default',
              opacity: active ? 1 : 0.45,
              color: 'var(--koala-text-primary)',
              font: 'inherit',
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: item.color,
                flexShrink: 0,
              }}
            />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
