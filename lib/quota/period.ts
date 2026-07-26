import { ACTIVE_PERIOD_KEY, type MeterKind, type QuotaMeter, getMeterKind } from '../planLimits';

/** UTC calendar month key `YYYY-MM` for period_usage meters. */
export function calendarPeriodKey(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function periodKeyForMeter(meter: QuotaMeter, at: Date = new Date()): string {
  const kind: MeterKind = getMeterKind(meter);
  if (kind === 'period_usage') return calendarPeriodKey(at);
  return ACTIVE_PERIOD_KEY;
}
