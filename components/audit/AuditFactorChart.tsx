import React, { useLayoutEffect, useRef } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { AuditFactor } from '../../lib/auditTypes';

const FONT = 'var(--font-family-primary)';
const YOU = '#9158D5';
const YOU_STROKE = '#7934CB';
const COMP = '#CBD5E0';
const RANGE = '#68D391';
const RANGE_HATCH = '#9AE6B4';
const NUM = '#,###.##';

interface Bar { cat: string; host: string; link: string; value: number; you: boolean; }

/**
 * One Ranksmile-style factor chart (amCharts 5, client-only — imported via
 * next/dynamic({ ssr:false })): "You" (purple) vs ranked competitors (grey, dimmed when
 * placeholder), a hatched green suggested-range band, value labels, a dashed cursor with
 * a dark value pill, and a legend (You / Competitors / Suggested range).
 */
const AuditFactorChart = ({ factor, height = 300 }: { factor: AuditFactor; height?: number }) => {
   const ref = useRef<HTMLDivElement>(null);
   const hasRange = factor.suggestedMin !== null && factor.suggestedMax !== null && factor.suggestedMax > 0;

   useLayoutEffect(() => {
      if (!ref.current) return undefined;
      const root = am5.Root.new(ref.current);
      root.setThemes([am5themes_Animated.new(root)]);
      root._logo?.dispose();
      root.numberFormatter.set('numberFormat', NUM);

      // Two-line x labels: "You" / "domain \n #N in Google" (unique per bar → safe category key).
      const bars: Bar[] = [
         { cat: 'You', host: 'You', link: '', value: factor.you, you: true },
         ...[...factor.competitors].sort((a, b) => a.rank - b.rank).map((c) => ({
            // Tooltip shows the short domain (a long URL broke the amCharts label); the full
            // article URL rides on `link` for the click-through.
            cat: `${c.label}\n#${c.rank} in Google`, host: c.label || 'Competitor', link: c.url || '', value: c.value, you: false,
         })),
      ];

      const chart = root.container.children.push(am5xy.XYChart.new(root, {
         paddingLeft: 12, paddingRight: 8, paddingBottom: 4, layout: root.verticalLayout,
      }));

      const xRenderer = am5xy.AxisRendererX.new(root, { minGridDistance: 30 });
      xRenderer.grid.template.set('visible', false);
      xRenderer.labels.template.setAll({ fontSize: 11, fill: am5.color('#52525C'), textAlign: 'center', oversizedBehavior: 'wrap', maxWidth: 120, paddingTop: 6 });
      const xAxis = chart.xAxes.push(am5xy.CategoryAxis.new(root, { categoryField: 'cat', renderer: xRenderer }));
      xAxis.data.setAll(bars);

      const yRenderer = am5xy.AxisRendererY.new(root, { minGridDistance: 28 });
      yRenderer.grid.template.setAll({ stroke: am5.color('#000000'), strokeOpacity: 0.08 });
      yRenderer.labels.template.setAll({ fontSize: 11, fill: am5.color('#9F9FA9') });
      // extraMax leaves headroom so the value label above the tallest bar is never clipped.
      const yAxis = chart.yAxes.push(am5xy.ValueAxis.new(root, { min: 0, extraMax: 0.08, renderer: yRenderer }));

      // Dark value pill on the Y axis, revealed by the dashed cursor line (kept in bounds).
      // autoTextColor:false so amCharts doesn't recolor the label for contrast.
      const yTooltip = am5.Tooltip.new(root, { autoTextColor: false });
      yTooltip.get('background')?.setAll({ fill: am5.color('#000000'), fillOpacity: 1 });
      yTooltip.label.setAll({ fill: am5.color('#FFFFFF'), fontSize: 12 });
      yAxis.set('tooltip', yTooltip);

      // ── Hatched suggested-range band, with a solid green line on both edges ──
      if (hasRange) {
         const hatch = am5.LinePattern.new(root, { color: am5.color(RANGE_HATCH), colorOpacity: 0.7, rotation: 45, gap: 5, strokeWidth: 1, width: 1000, height: 1000 });
         const band = yAxis.makeDataItem({ value: factor.suggestedMin as number, endValue: factor.suggestedMax as number });
         yAxis.createAxisRange(band);
         band.get('axisFill')?.setAll({ fill: am5.color(RANGE_HATCH), fillOpacity: 0.12, fillPattern: hatch, visible: true });
         band.get('grid')?.setAll({ stroke: am5.color(RANGE), strokeOpacity: 1, strokeWidth: 2 });
         const top = yAxis.makeDataItem({ value: factor.suggestedMax as number });
         yAxis.createAxisRange(top);
         top.get('grid')?.setAll({ stroke: am5.color(RANGE), strokeOpacity: 1, strokeWidth: 2 });
      }

      const series = chart.series.push(am5xy.ColumnSeries.new(root, { xAxis, yAxis, categoryXField: 'cat', valueYField: 'value' }));
      // labelText populates from the hovered column's data. autoTextColor:false is the fix
      // for the dark-on-dark label: amCharts was auto-recoloring the text to contrast with
      // the column fill (dark "You" bar → white, light competitor bar → black), overriding
      // our explicit white. getFillFromSprite:false keeps the pill black regardless of bar.
      const colTooltip = am5.Tooltip.new(root, { getFillFromSprite: false, autoTextColor: false, labelText: '{host}' });
      colTooltip.get('background')?.setAll({ fill: am5.color('#000000'), fillOpacity: 1 });
      colTooltip.label.setAll({ fill: am5.color('#FFFFFF'), fontSize: 12 });
      series.set('tooltip', colTooltip);
      series.columns.template.setAll({ width: am5.percent(58), cornerRadiusTL: 3, cornerRadiusTR: 3, strokeOpacity: 0, tooltipY: 0, tooltipText: '{host}', templateField: 'columnSettings' });
      // Click a competitor bar → open its ranking article in a new tab.
      series.columns.template.events.on('click', (ev) => {
         const link = (ev.target.dataItem?.dataContext as { link?: string } | undefined)?.link;
         if (link) window.open(link, '_blank', 'noopener,noreferrer');
      });
      series.data.setAll(bars.map((b) => ({
         cat: b.cat, value: b.value, host: b.host, link: b.link,
         columnSettings: {
            fill: am5.color(b.you ? YOU : COMP),
            fillOpacity: b.you ? 1 : (factor.placeholder ? 0.5 : 1),
            stroke: b.you ? am5.color(YOU_STROKE) : undefined,
            strokeOpacity: b.you ? 1 : 0,
            cursorOverStyle: b.link ? 'pointer' : 'default',
         },
      })));

      // Value labels above the bars (comma-formatted, decimals kept for densities).
      series.bullets.push(() => am5.Bullet.new(root, {
         locationY: 1, sprite: am5.Label.new(root, {
            text: `{valueY.formatNumber('${NUM}')}`, centerX: am5.p50, centerY: am5.p100, dy: -6,
            fontSize: 12, fill: am5.color('#18181B'), populateText: true,
         }),
      }));

      // Dashed cursor line → dark y-value pill.
      const cursor = chart.set('cursor', am5xy.XYCursor.new(root, { behavior: 'none', xAxis, yAxis }));
      cursor.lineX.set('visible', false);
      cursor.lineY.setAll({ stroke: am5.color('#000000'), strokeDasharray: [3, 3], strokeOpacity: 0.4 });

      series.appear(600);
      chart.appear(600, 60);
      return () => root.dispose();
   }, [factor, hasRange]);

   const Swatch = ({ style }: { style: React.CSSProperties }) => (
      <span style={{ width: 14, height: 14, borderRadius: 3, display: 'inline-block', flexShrink: 0, ...style }} />
   );

   return (
      <div>
         <div ref={ref} style={{ width: '100%', height }} />
         {/* Legend (HTML — one ColumnSeries can't drive a 3-item amCharts legend) */}
         <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 24, marginTop: 4, fontSize: 13, color: '#3F3F47', fontFamily: FONT }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Swatch style={{ background: YOU }} />You</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Swatch style={{ background: COMP }} />Competitors</span>
            {hasRange && (
               <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Swatch style={{ backgroundColor: 'rgba(154,230,180,0.18)', backgroundImage: `repeating-linear-gradient(45deg, ${RANGE_HATCH} 0 1.5px, transparent 1.5px 5px)`, border: `1px solid ${RANGE}` }} />
                  Suggested range
               </span>
            )}
         </div>
         {factor.placeholder && (
            <div style={{ fontSize: 11, color: '#9F9FA9', fontFamily: FONT, textAlign: 'right', marginTop: 2 }}>
               Competitor bars &amp; suggested range are sample data — real SERP data lands in the next phase
            </div>
         )}
      </div>
   );
};

export default AuditFactorChart;
