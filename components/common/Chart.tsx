import React, { useMemo } from 'react';
import { Chart as KoalaChart } from '../koala/charts';
import type { ChartPreparedData } from '../koala/charts';

type ChartProps = {
  labels: string[];
  series: number[];
  reverse?: boolean;
};

/** Rank-history shim — prepares series then declarative RankHistory preset. */
const Chart = ({ labels, series, reverse = true }: ChartProps) => {
  const data: ChartPreparedData = useMemo(
    () => ({
      labels,
      points: labels.map((label, index) => ({ label, value: series[index] ?? 0 })),
    }),
    [labels, series],
  );

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <KoalaChart
        preset={reverse ? 'RankHistory' : 'TrafficTrend'}
        data={data}
        state={labels.length ? 'ready' : 'empty'}
        overrides={{ height: 160 }}
        aria-label="Rank history"
      />
    </div>
  );
};

export default Chart;
