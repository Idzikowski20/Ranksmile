/**
 * Pure helpers for the weekly Automations kanban board: the Monday–Sunday window, labels,
 * day grouping, filtering, and the status badge each card shows. No I/O, no React.
 */
import type { AutomationEvent, AutomationEventStatus, AutomationPublishMode } from '@/src/core/shared/types/automations';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const WEEKDAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const short = (month: number) => MONTHS[month].slice(0, 3);

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Monday of the week containing `date` (weeks start on Monday, matching the calendar). */
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

/**
 * "16 - 22 December 2024"; across a month "30 Sep - 6 Oct 2024"; across a year
 * "30 Dec 2024 - 5 Jan 2025".
 */
export function weekRangeLabel(date: Date): string {
  const days = weekDays(date);
  const a = days[0];
  const b = days[6];
  if (a.getFullYear() !== b.getFullYear()) {
    return `${a.getDate()} ${short(a.getMonth())} ${a.getFullYear()} - ${b.getDate()} ${short(b.getMonth())} ${b.getFullYear()}`;
  }
  if (a.getMonth() !== b.getMonth()) {
    return `${a.getDate()} ${short(a.getMonth())} - ${b.getDate()} ${short(b.getMonth())} ${b.getFullYear()}`;
  }
  return `${a.getDate()} - ${b.getDate()} ${MONTHS[a.getMonth()]} ${a.getFullYear()}`;
}

/** Column header: "Monday, 16 Dec 2024". */
export function columnDateLabel(date: Date): string {
  const weekday = WEEKDAY_LABELS[(date.getDay() + 6) % 7];
  return `${weekday}, ${date.getDate()} ${short(date.getMonth())} ${date.getFullYear()}`;
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

export type BadgeColor = 'blue' | 'orange' | 'green' | 'purple' | 'red';
export type StatusBadge = { label: string; initial: string; color: BadgeColor };

/** The card's tag — a coloured letter avatar plus label, in the slot the calendar gives a project. */
export function statusBadge(status: AutomationEventStatus): StatusBadge {
  switch (status) {
    case 'failed': return { label: 'Failed', initial: 'F', color: 'red' };
    case 'published': return { label: 'Published', initial: 'P', color: 'purple' };
    case 'generating': return { label: 'Generating', initial: 'G', color: 'orange' };
    case 'created': return { label: 'Draft ready', initial: 'D', color: 'green' };
    case 'scheduled':
    default: return { label: 'Scheduled', initial: 'S', color: 'blue' };
  }
}

/** Small label for the publish intent shown under the title. */
export function publishLabel(mode: AutomationPublishMode): string {
  return mode === 'live' ? 'Publish live' : 'Keep as draft';
}

export type BoardFilters = {
  query?: string;
  status?: AutomationEventStatus;
  mode?: AutomationPublishMode;
};

/** Events matching the toolbar: search over title + keyword, status, publish mode. */
export function filterEvents(events: AutomationEvent[], filters: BoardFilters): AutomationEvent[] {
  const q = (filters.query || '').trim().toLowerCase();
  return events.filter((e) => {
    if (filters.status && e.status !== filters.status) return false;
    if (filters.mode && e.publishMode !== filters.mode) return false;
    if (q && !`${e.title} ${e.targetKeyword}`.toLowerCase().includes(q)) return false;
    return true;
  });
}
