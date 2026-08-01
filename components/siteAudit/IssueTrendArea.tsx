import React from 'react';
import { Chart } from '../koala/charts';

/**
 * Site audit has only a current snapshot — no historical issue series.
 * Visualization Layer shows empty ("No history"), never a fake spark.
 */
export default function IssueTrendArea(_props: { value: number; color: string }) {
  return (
    <Chart
      preset="TrafficTrend"
      data={{ labels: [], points: [] }}
      state="empty"
      emptyDescription="No history"
      overrides={{ height: 72 }}
      aria-label="Issue trend"
    />
  );
}
