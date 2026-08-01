import { formatCompactNumber } from './compactNumber';

/** Internal chart formatter — do not import from features. */
export function formatCurrency(value: number, currency = 'USD'): string {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) return `$${formatCompactNumber(value)}`;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: value < 10 ? 2 : 0,
    }).format(value);
  } catch {
    return `$${formatCompactNumber(value)}`;
  }
}
