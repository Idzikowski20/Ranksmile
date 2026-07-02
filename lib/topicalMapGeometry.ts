/**
 * Pure geometry + palette constants for the Topical Map radar canvas
 * (components/domains/TopicalMapCanvas.tsx). Every value here was
 * cross-checked field-by-field against SurferSEO's reference SVG markup:
 * ring radii step 44.44 (8 rings, r=44.44..355.55), axis rect spans
 * center±400 over an 800-unit rect, axis-label x/y offsets and their
 * `translate` adjustments, hex path `d` strings, and node fill/stroke
 * colors (e.g. rgb(99,13,227) === #630DE3 for "covered").
 */

export const MAP_VIEWBOX = { w: 1200, h: 760 };
export const MAP_CENTER = { x: MAP_VIEWBOX.w / 2, y: MAP_VIEWBOX.h / 2 };
export const MAP_AXIS_HALF_LENGTH = 400; // axis rect spans center ± 400 over an 800-long rect
export const MAP_NODE_RANGE = 340; // cluster.map.x/y ∈ [-1,1] scaled to this many SVG units
export const MAP_RING_STEP = 44.44; // radius step between the 8 concentric rings
export const MAP_RING_COUNT = 8;
export const MAP_HEX_SCALE = 1.71; // base hex scale before the per-cluster size multiplier

/** Ring stroke colors, outer→inner index 0..7 — verbatim from the reference SVG. */
export const MAP_RING_COLORS = [
   'rgb(59,113,88)', 'rgb(105,137,143)', 'rgb(151,160,199)', 'rgb(197,184,254)',
   'rgb(189,179,237)', 'rgb(182,174,220)', 'rgb(174,169,203)', 'rgb(167,164,186)',
];

export type AxisStop = { off: number; label: string; fill: string; adj: number };
/**
 * Axis tick stops. `off` is the signed distance from center along the axis;
 * `adj` is the label's `translate` shift — applied as-is on BOTH axes
 * (x-axis: `translate(${adj})`, y-axis: `translate(0 ${adj})` — no negation;
 * confirmed against the reference markup where off=-400/adj=35 renders
 * `translate(35)` on the x-axis and `translate(0 35)` on the y-axis).
 */
export const MAP_AXIS_STOPS: AxisStop[] = [
   { off: -400, label: 'Low', fill: '#52525C', adj: 35 },
   { off: -240, label: 'Medium', fill: '#8F69FC', adj: 0 },
   { off: -80, label: 'High', fill: '#169345', adj: 0 },
   { off: 80, label: 'High', fill: '#169345', adj: -25 },
   { off: 240, label: 'Medium', fill: '#8F69FC', adj: -45 },
   { off: 400, label: 'Low', fill: '#52525C', adj: -55 },
];

export const MAP_HEX_MAIN = 'M9.409,0L9.409,0L4.704,8.148L-4.704,8.148L-9.409,0L-4.704,-8.148L4.704,-8.148Z';
export const MAP_HEX_SATELLITE = 'M6.204,0L6.204,0L3.102,5.373L-3.102,5.373L-6.204,0L-3.102,-5.373L3.102,-5.373Z';
export const MAP_HEX_LEGEND = 'M7.341,0L7.341,0L3.67,6.357L-3.67,6.357L-7.341,0L-3.67,-6.357L3.67,-6.357Z';
/** Up to 3 satellite hexes cluster around the main node when a topic has >1 keyword. */
export const MAP_SATELLITE_OFFSETS: Array<[number, number]> = [[9.2, 16.2], [-14, 10], [6, -17]];

export const MAP_COVERAGE_FILL: Record<'covered' | 'not_covered' | 'recommended', { fill: string; stroke: string; strokeWidth: number }> = {
   covered: { fill: '#630DE3', stroke: '#0A0418', strokeWidth: 0.6 },
   not_covered: { fill: '#FFFFFF', stroke: '#0A0418', strokeWidth: 0.6 },
   recommended: { fill: '#FF6F77', stroke: '#A4001C', strokeWidth: 0.6 },
};

/** Ring radius for the i-th concentric ring (0-indexed, 0 = innermost). */
export const ringRadius = (i: number): number => (i + 1) * MAP_RING_STEP;

/** Absolute SVG coordinates for a cluster's node, from its normalized map.x/y ∈ [-1,1]. */
export const nodeCenter = (mapX: number, mapY: number): { cx: number; cy: number } => ({
   cx: MAP_CENTER.x + mapX * MAP_NODE_RANGE,
   cy: MAP_CENTER.y + mapY * MAP_NODE_RANGE,
});
