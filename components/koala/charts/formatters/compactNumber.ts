/** Internal chart formatter — do not import from features. */
export function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (abs >= 1000) {
    const v = value / 1000;
    return `${v >= 10 || v <= -10 ? Math.round(v) : Number(v.toFixed(1))}K`;
  }
  return String(Math.round(value));
}
