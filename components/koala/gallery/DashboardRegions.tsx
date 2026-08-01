import React from 'react';
import { MetricWidget, ChartWidget, ListWidget } from '../product/widgets';
import { Button } from '../core';

/**
 * Auth-free stub of dashboard visual regions (shell / KPI / chart / list).
 * Used by Playwright region shots — not the live dashboard page.
 */
export function DashboardRegions() {
  return (
    <div
      data-testid="dashboard-regions"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-6)',
        padding: 'var(--space-6)',
        maxWidth: 1100,
        margin: '0 auto',
        fontFamily: 'var(--font-family-primary)',
        color: 'var(--koala-text-primary)',
        background: 'var(--koala-bg-primary)',
      }}
    >
      <div
        data-testid="dashboard-shell"
        style={{
          display: 'flex',
          border: '1px solid var(--koala-border-primary)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          minHeight: 120,
        }}
      >
        <aside
          style={{
            width: 200,
            background: 'var(--koala-bg-secondary)',
            borderRight: '1px solid var(--koala-border-primary)',
            padding: 'var(--space-4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
          }}
        >
          <strong style={{ fontSize: 'var(--font-size-sm)' }}>Ranksmile</strong>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--koala-text-secondary)' }}>Dashboard</span>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--koala-text-secondary)' }}>Keywords</span>
        </aside>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <header
            style={{
              height: 48,
              borderBottom: '1px solid var(--koala-border-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 var(--space-4)',
              background: 'var(--koala-bg-primary)',
            }}
          >
            <span style={{ fontSize: 'var(--font-size-sm)' }}>Overview</span>
            <Button type="button" size="sm" variant="secondary">Account</Button>
          </header>
          <div style={{ flex: 1, padding: 'var(--space-4)', background: 'var(--koala-bg-primary)' }} />
        </div>
      </div>

      <div
        data-testid="dashboard-widget-row"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}
      >
        <MetricWidget title="Organic" value="12.4k" delta="+8%" deltaPositive />
        <MetricWidget title="Rank" value="14" delta="-2" deltaPositive={false} />
        <MetricWidget title="AI mentions" value="36" delta="+4" deltaPositive />
      </div>

      <ChartWidget
        title="Traffic"
        subtitle="Last 30 days"
        chart={{
          preset: 'TrafficTrend',
          data: {
            labels: ['W1', 'W2', 'W3', 'W4'],
            points: [
              { label: 'W1', value: 4 },
              { label: 'W2', value: 7 },
              { label: 'W3', value: 5 },
              { label: 'W4', value: 11 },
            ],
          },
          overrides: { height: 160 },
        }}
      />

      <ListWidget
        title="Tasks"
        items={['Fix title tags on /pricing', 'Publish cluster outline', 'Review AI visibility gaps']}
      />
    </div>
  );
}

export default DashboardRegions;
