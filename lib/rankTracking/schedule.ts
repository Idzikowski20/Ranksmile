import type { ScheduleInterval } from '../types/rankTracking';

type ScheduledInterval = Exclude<ScheduleInterval, 'manual'>;

function endOfMonthWithTime(source: Date, monthOffset = 0): Date {
  const endOfMonth = new Date(
    Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + monthOffset + 1, 0),
  );
  endOfMonth.setUTCHours(
    source.getUTCHours(),
    source.getUTCMinutes(),
    source.getUTCSeconds(),
    source.getUTCMilliseconds(),
  );
  return endOfMonth;
}

export function isScheduledInterval(interval: ScheduleInterval): interval is ScheduledInterval {
  return interval !== 'manual';
}

export function computeNextCheckAt(
  interval: ScheduledInterval,
  everyNDays: number | null,
  previousNextCheckAt?: string | null,
): string {
  const now = Date.now();

  if (interval === 'every_n_days') {
    const days = Math.max(1, everyNDays ?? 7);
    if (previousNextCheckAt) {
      const anchor = new Date(previousNextCheckAt).getTime();
      const intervalMs = days * 86_400_000;
      const steps = Math.floor(Math.max(0, now - anchor) / intervalMs) + 1;
      return new Date(anchor + steps * intervalMs).toISOString();
    }
    const next = new Date();
    next.setUTCDate(next.getUTCDate() + days);
    return next.toISOString();
  }

  if (interval === 'monthly') {
    if (previousNextCheckAt) {
      const anchor = new Date(previousNextCheckAt);
      let monthOffset = 1;
      let nextDate = endOfMonthWithTime(anchor, monthOffset);
      while (nextDate.getTime() <= now) {
        monthOffset += 1;
        nextDate = endOfMonthWithTime(anchor, monthOffset);
      }
      return nextDate.toISOString();
    }
    const hour = 4 + Math.floor(Math.random() * 6);
    const minute = Math.floor(Math.random() * 60);
    const nextDate = endOfMonthWithTime(new Date());
    nextDate.setUTCHours(hour, minute, 0, 0);
    if (nextDate.getTime() <= now) {
      const following = endOfMonthWithTime(nextDate, 1);
      following.setUTCHours(hour, minute, 0, 0);
      return following.toISOString();
    }
    return nextDate.toISOString();
  }

  const daysAhead = interval === 'daily' ? 1 : 7;

  if (previousNextCheckAt) {
    const anchor = new Date(previousNextCheckAt).getTime();
    const intervalMs = daysAhead * 86_400_000;
    const steps = Math.floor(Math.max(0, now - anchor) / intervalMs) + 1;
    return new Date(anchor + steps * intervalMs).toISOString();
  }

  const nextDate = new Date();
  nextDate.setUTCDate(nextDate.getUTCDate() + daysAhead);
  const hour = 4 + Math.floor(Math.random() * 6);
  const minute = Math.floor(Math.random() * 60);
  nextDate.setUTCHours(hour, minute, 0, 0);
  return nextDate.toISOString();
}

export function scheduleLabel(interval: ScheduleInterval, everyNDays?: number | null): string {
  if (interval === 'daily') return 'Daily';
  if (interval === 'weekly') return 'Weekly';
  if (interval === 'monthly') return 'Monthly';
  if (interval === 'every_n_days') return `Every ${everyNDays ?? 7} days`;
  return 'Manual';
}

export function devicesLabel(devices: 'desktop' | 'mobile' | 'both'): string {
  if (devices === 'both') return 'Desktop + Mobile';
  return devices === 'desktop' ? 'Desktop' : 'Mobile';
}
