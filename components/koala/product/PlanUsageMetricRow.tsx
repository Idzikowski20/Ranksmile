import React from 'react';
import type { PlanLimitMetric } from '../../../lib/planLimits';

function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}

/** Shared meter row — sidebar limits popover + Settings → Usage. */
export function PlanUsageMetricRow({ metric }: { metric: PlanLimitMetric }) {
  const over = metric.limit != null && metric.used > metric.limit;
  const warn = over || (metric.pct ?? 0) >= 85;
  const fillPct = metric.limit == null
    ? 0
    : Math.min(100, Math.round((metric.used / metric.limit) * 100));
  const valueLabel = metric.limit == null
    ? `${formatCount(metric.used)} · Unlimited`
    : `${formatCount(metric.used)} / ${formatCount(metric.limit)}`;

  return (
    <li className="koala-plan-limits__row">
      <span className="koala-plan-limits__bar-label" title={metric.label}>{metric.label}</span>
      <div
        className="koala-plan-limits__track"
        role="progressbar"
        aria-valuenow={fillPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${metric.label} usage`}
      >
        <div
          className={`koala-plan-limits__fill${warn ? ' koala-plan-limits__fill--warn' : ''}${over ? ' koala-plan-limits__fill--over' : ''}`}
          style={{ width: `${over ? 100 : fillPct}%` }}
        />
      </div>
      <span className={`koala-plan-limits__value${warn ? ' koala-plan-limits__warn' : ''}`}>
        {valueLabel}
      </span>
    </li>
  );
}

export function PlanUsageMetricsList({ metrics }: { metrics: PlanLimitMetric[] }) {
  if (metrics.length === 0) {
    return <p style={{ margin: 0, fontSize: 14, color: 'var(--koala-text-secondary)' }}>No usage meters for this plan.</p>;
  }
  return (
    <ul className="koala-plan-limits__list">
      {metrics.map((metric) => (
        <PlanUsageMetricRow key={metric.key} metric={metric} />
      ))}
    </ul>
  );
}
