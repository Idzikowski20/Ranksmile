/**
 * Pure helpers for the Automations content calendar: the visible window of days (today
 * onward), labels, day grouping, filtering, and each card's status badge. No I/O, no React.
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

/** How many day columns the board shows at once; the arrows page by this many days. */
export const WINDOW_DAYS = 4;

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function shiftDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** The visible days: `start` (usually today) and the ones after it. */
export function windowDays(start: Date, count = WINDOW_DAYS): Date[] {
  return Array.from({ length: count }, (_, i) => shiftDays(start, i));
}

/** Inclusive [from, to] YYYY-MM-DD keys for the visible days, for the list query. */
export function windowRange(start: Date): { from: string; to: string } {
  const days = windowDays(start);
  return { from: toDateKey(days[0]), to: toDateKey(days[days.length - 1]) };
}

/**
 * "17 - 20 September 2026"; across a month "29 Sep - 2 Oct 2026"; across a year
 * "30 Dec 2026 - 2 Jan 2027".
 */
export function windowRangeLabel(start: Date): string {
  const days = windowDays(start);
  const a = days[0];
  const b = days[days.length - 1];
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
    case 'publishing': return { label: 'Publishing', initial: 'P', color: 'orange' };
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
