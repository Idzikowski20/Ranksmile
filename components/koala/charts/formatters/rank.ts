/** Internal chart formatter — do not import from features. Position: lower is better. */
export function formatRank(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—';
  if (value >= 100) return String(Math.round(value));
  return value.toFixed(1).replace(/\.0$/, '');
}
