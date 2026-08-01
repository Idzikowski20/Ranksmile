/** Internal chart formatter — do not import from features. */
export function formatPercent(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}%`;
}
