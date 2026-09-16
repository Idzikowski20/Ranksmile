/**
 * Pure helpers for the weekly Automations kanban board: the Monday–Sunday window, day
 * grouping, range labels, and the status badge each card shows. No I/O, no React.
 */
import type { AutomationEvent, AutomationEventStatus, AutomationPublishMode } from '@/src/core/shared/types/automations';

const MONTHS_SHORT = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const WEEKDAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Monday of the week containing `date` (weeks start on Monday, matching the reference). */
export function weekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - dow);
  return d;
}

/** The seven Date objects of the week containing `date`, Monday first. */
export function weekDays(date: Date): Date[] {
  const start = weekStart(date);
  return Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

/** Inclusive [from, to] YYYY-MM-DD keys for the week, for the list query. */
export function weekRange(date: Date): { from: string; to: string } {
  const days = weekDays(date);
  return { from: toDateKey(days[0]), to: toDateKey(days[6]) };
}

/** "16 – 22 December 2024", or "28 Dec 2024 – 3 Jan 2025" across a month/year boundary. */
export function weekRangeLabel(date: Date): string {
  const days = weekDays(date);
  const a = days[0];
  const b = days[6];
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  if (sameMonth) return `${a.getDate()} – ${b.getDate()} ${MONTHS_SHORT[a.getMonth()]} ${a.getFullYear()}`;
  const aY = a.getFullYear() === b.getFullYear() ? '' : ` ${a.getFullYear()}`;
  return `${a.getDate()} ${MONTHS_SHORT[a.getMonth()].slice(0, 3)}${aY} – ${b.getDate()} ${MONTHS_SHORT[b.getMonth()].slice(0, 3)} ${b.getFullYear()}`;
}

/** Events keyed by their scheduled day (YYYY-MM-DD). */
export function groupEventsByDay(events: AutomationEvent[]): Map<string, AutomationEvent[]> {
  const map = new Map<string, AutomationEvent[]>();
  for (const ev of events) {
    const key = ev.scheduledDate.slice(0, 10);
    const list = map.get(key);
    if (list) list.push(ev);
    else map.set(key, [ev]);
  }
  return map;
}

export type BadgeTone = 'neutral' | 'warning' | 'success' | 'brand' | 'danger';
export type StatusBadge = { label: string; tone: BadgeTone };

/** The card's status badge — the coloured chip that stands in for the reference's project tag. */
export function statusBadge(status: AutomationEventStatus): StatusBadge {
  switch (status) {
    case 'failed': return { label: 'Failed', tone: 'danger' };
    case 'published': return { label: 'Published', tone: 'brand' };
    case 'generating': return { label: 'Generating', tone: 'warning' };
    case 'created': return { label: 'Draft ready', tone: 'success' };
    case 'scheduled':
    default: return { label: 'Scheduled', tone: 'neutral' };
  }
}

/** Small label for the publish intent shown under the title. */
export function publishLabel(mode: AutomationPublishMode): string {
  return mode === 'live' ? 'Publish live' : 'Keep as draft';
}
