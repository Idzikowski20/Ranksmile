import React, { useMemo } from 'react';
import { Chart } from '../koala/charts';
import type { ChartPreparedData } from '../koala/charts';
import { AuditFactor } from '../../lib/auditTypes';

/**
 * Factor comparison — page prepares bars; Chart Distribution renders only.
 */
const AuditFactorChart = ({ factor, height = 300 }: { factor: AuditFactor; height?: number }) => {
  const data: ChartPreparedData = useMemo(() => {
    const competitors = [...factor.competitors].sort((a, b) => a.rank - b.rank);
    const points = [
      { label: 'You', value: factor.you },
      ...competitors.map((c) => ({
        label: c.label || 'Competitor',
        value: c.value,
      })),
    ];
    return {
      labels: points.map((p) => p.label),
      points,
    };
  }, [factor]);

  return (
    <Chart
      preset="Distribution"
      data={data}
      state={data.points?.length ? 'ready' : 'empty'}
      overrides={{ height, legend: false }}
      aria-label={`${factor.section || factor.key} comparison`}
      emptyDescription="No factor data"
    />
  );
};

export default AuditFactorChart;
