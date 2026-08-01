'use client';

import React, { useMemo } from 'react';
import { Group } from '@visx/group';
import { HeatmapRect } from '@visx/heatmap';
import { scaleLinear } from '@visx/scale';
import { chartColors } from '../tokens/chart';
import { greyNeutral } from '../tokens/colors';

/** @internal */
export type HeatmapRendererProps = {
  data: number[][];
  width: number;
  height: number;
  gap?: number;
  'aria-label'?: string;
};

type HeatmapColumn = { col: number; bins: HeatmapBin[] };
type HeatmapBin = { row: number; count: number };

const GAP = 2;

function toColumns(matrix: number[][]): HeatmapColumn[] {
  const colCount = matrix[0]?.length ?? 0;
  return Array.from({ length: colCount }, (_, col) => ({
    col,
    bins: matrix.map((row, rowIndex) => ({
      row: rowIndex,
      count: row[col] ?? 0,
    })),
  }));
}

export function HeatmapRenderer({
  data,
  width,
  height,
  gap = GAP,
  'aria-label': ariaLabel = 'Heatmap',
}: HeatmapRendererProps) {
  const color = chartColors.traffic;
  const columns = useMemo(() => toColumns(data), [data]);
  const rowCount = data.length;
  const colCount = columns.length;

  const { minVal, maxVal } = useMemo(() => {
    const flat = data.flat();
    if (!flat.length) return { minVal: 0, maxVal: 1 };
    return { minVal: Math.min(...flat), maxVal: Math.max(...flat, 1) };
  }, [data]);

  const binWidth = colCount > 0 ? (width - gap * (colCount - 1)) / colCount : 0;
  const binHeight = rowCount > 0 ? (height - gap * (rowCount - 1)) / rowCount : 0;

  const xScale = useMemo(
    () => scaleLinear<number>({ domain: [0, Math.max(colCount - 1, 0)], range: [0, width - binWidth] }),
    [binWidth, colCount, width],
  );

  const yScale = useMemo(
    () => scaleLinear<number>({ domain: [0, Math.max(rowCount - 1, 0)], range: [0, height - binHeight] }),
    [binHeight, height, rowCount],
  );

  const opacityScale = useMemo(() => {
    return (count: number | { valueOf(): number }) => {
      const value = typeof count === 'number' ? count : count.valueOf();
      if (maxVal === minVal) return 0.85;
      const t = (value - minVal) / (maxVal - minVal);
      return 0.12 + t * 0.88;
    };
  }, [maxVal, minVal]);

  if (!colCount || !rowCount || binWidth <= 0 || binHeight <= 0) return null;

  return (
    <svg width={width} height={height} role="img" aria-label={ariaLabel}>
      <Group>
        <HeatmapRect<HeatmapColumn, HeatmapBin>
          data={columns}
          binWidth={binWidth}
          binHeight={binHeight}
          gap={gap}
          xScale={(col) => xScale(col)}
          yScale={(row) => yScale(row)}
          bins={(column) => column.bins}
          count={(bin) => bin.count}
          colorScale={() => color}
          opacityScale={opacityScale}
        >
          {(cells) =>
            cells.flatMap((column) =>
              column.map((cell) => (
                <rect
                  key={`${cell.column}-${cell.row}`}
                  x={cell.x}
                  y={cell.y}
                  width={cell.width}
                  height={cell.height}
                  fill={color}
                  fillOpacity={opacityScale(cell.count ?? 0)}
                  rx={3}
                  stroke={greyNeutral[100]}
                  strokeWidth={0.5}
                />
              )),
            )
          }
        </HeatmapRect>
      </Group>
    </svg>
  );
}
