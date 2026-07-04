import React, { useLayoutEffect, useRef } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { AuditFactor } from '../../lib/auditTypes';

const FONT = 'var(--font-family-primary)';
const YOU = '#9158D5';
const COMP = '#CBD5E0';
const RANGE = '#68D391';

interface Bar { cat: string; sub: string; value: number; fill: string; opacity: number; }

/**
 * One SurferSEO-style factor chart: "You" (purple) vs ranked competitors (grey, dimmed
 * when placeholder) with a green suggested-range band. amCharts 5, client-only — the
 * detail page imports it via next/dynamic({ ssr:false }).
 */
const AuditFactorChart = ({ factor, height = 300 }: { factor: AuditFactor; height?: number }) => {
   const ref = useRef<HTMLDivElement>(null);

   useLayoutEffect(() => {
      if (!ref.current) return undefined;
      const root = am5.Root.new(ref.current);
      root.setThemes([am5themes_Animated.new(root)]);
      root._logo?.dispose();

      const bars: Bar[] = [
         { cat: 'You', sub: '', value: factor.you, fill: YOU, opacity: 1 },
         ...[...factor.competitors].sort((a, b) => a.rank - b.rank).map((c) => ({
            cat: c.label, sub: `#${c.rank} in Google`, value: c.value, fill: COMP,
            opacity: factor.placeholder ? 0.5 : 1,
         })),
      ];

      const chart = root.container.children.push(am5xy.XYChart.new(root, {
         paddingLeft: 0, paddingRight: 8, layout: root.verticalLayout,
      }));

      const xRenderer = am5xy.AxisRendererX.new(root, { minGridDistance: 30 });
      xRenderer.grid.template.set('visible', false);
      xRenderer.labels.template.setAll({ fontSize: 11, fill: am5.color('#52525C'), oversizedBehavior: 'wrap', maxWidth: 110, textAlign: 'center' });
      const xAxis = chart.xAxes.push(am5xy.CategoryAxis.new(root, {
         categoryField: 'cat', renderer: xRenderer,
      }));
      xAxis.data.setAll(bars);

      const yRenderer = am5xy.AxisRendererY.new(root, {});
      yRenderer.labels.template.setAll({ fontSize: 11, fill: am5.color('#9F9FA9') });
      const yAxis = chart.yAxes.push(am5xy.ValueAxis.new(root, {
         min: 0, renderer: yRenderer,
      }));

      // Green suggested-range band.
      if (factor.suggestedMin !== null && factor.suggestedMax !== null && factor.suggestedMax > 0) {
         const range = yAxis.makeDataItem({ value: factor.suggestedMin, endValue: factor.suggestedMax });
         yAxis.createAxisRange(range);
         range.get('axisFill')?.setAll({ fill: am5.color(RANGE), fillOpacity: 0.12, visible: true });
         range.get('grid')?.setAll({ stroke: am5.color(RANGE), strokeOpacity: 0.9, strokeWidth: 1.5 });
      }

      const series = chart.series.push(am5xy.ColumnSeries.new(root, {
         xAxis, yAxis, categoryXField: 'cat', valueYField: 'value',
      }));
      series.columns.template.setAll({
         width: am5.percent(58), cornerRadiusTL: 3, cornerRadiusTR: 3, strokeOpacity: 0,
         templateField: 'columnSettings',
      });
      series.data.setAll(bars.map((b) => ({
         cat: b.cat, value: b.value,
         columnSettings: { fill: am5.color(b.fill), fillOpacity: b.opacity },
      })));

      // Value labels above bars.
      series.bullets.push(() => am5.Bullet.new(root, {
         locationY: 1, sprite: am5.Label.new(root, {
            text: '{valueY}', centerX: am5.p50, centerY: am5.p100, dy: -6,
            fontSize: 12, fill: am5.color('#18181B'), populateText: true,
         }),
      }));

      series.appear(600);
      chart.appear(600, 60);
      return () => root.dispose();
   }, [factor]);

   return (
      <div>
         <div ref={ref} style={{ width: '100%', height }} />
         {factor.placeholder && (
            <div style={{ fontSize: 11, color: '#9F9FA9', fontFamily: FONT, textAlign: 'right', marginTop: -4 }}>
               Competitor bars &amp; suggested range are sample data — real SERP data lands in the next phase
            </div>
         )}
      </div>
   );
};

export default AuditFactorChart;
