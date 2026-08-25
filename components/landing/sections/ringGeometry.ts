/**
 * SVG ring-gauge geometry. Pure so the radius / circumference / dash-offset math
 * is regression-tested independently of the React/SVG markup that consumes it.
 *
 * `value` is a 0–100 percentage; `offset` is the stroke-dashoffset that leaves
 * `value`% of the circumference painted (0 → fully empty, 100 → fully drawn).
 */
export function ringGeometry(value: number, size: number, stroke: number): { r: number; c: number; offset: number } {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - value / 100);
  return { r, c, offset };
}

export default ringGeometry;
